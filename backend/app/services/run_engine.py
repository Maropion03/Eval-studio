"""Run execution engine — orchestrates trials for a Run.

Lifecycle:
    1. POST /api/runs creates a queued Run row.
    2. The endpoint calls `start_run(run_id)` which spawns an asyncio task.
    3. The task iterates prompt × model × case, calls LLM + judge, persists
       Trial rows, and pushes events into the run's per-id queue.
    4. GET /api/runs/{id}/stream subscribes to that queue and emits SSE.

The queue is in-process; if we move to multi-worker deploy we'll swap it
for Redis pub/sub (out of scope for W1-W2).
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.models import Case, Dataset, Experiment, Run, RunStatus, Trial
from app.services.decision_writer import compose_decision_book
from app.services.judge_engine import judge_trial
from app.services.llm_client import chat

log = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════════
#  In-process event bus (single-worker)
# ════════════════════════════════════════════════════════════════════


_BUS: dict[str, asyncio.Queue[dict[str, Any]]] = {}
_TASKS: dict[str, asyncio.Task] = {}

# Trials cap per run (demo-friendly).
DEFAULT_MAX_TRIALS = 40
# Concurrent in-flight LLM calls per run.
TRIAL_CONCURRENCY = 4


def _get_queue(run_id: str) -> asyncio.Queue[dict[str, Any]]:
    q = _BUS.get(run_id)
    if q is None:
        q = asyncio.Queue(maxsize=2000)
        _BUS[run_id] = q
    return q


async def subscribe(run_id: str, timeout: float = 0.5):
    """Async iterator over events for one run, terminating after 'complete'."""
    q = _get_queue(run_id)
    while True:
        try:
            ev = await asyncio.wait_for(q.get(), timeout=timeout)
        except asyncio.TimeoutError:
            # Yield nothing — caller may use the lull to check client liveness.
            continue
        yield ev
        if ev.get("type") in {"complete", "error"}:
            break


def _emit(run_id: str, event: dict[str, Any]) -> None:
    q = _get_queue(run_id)
    try:
        q.put_nowait(event)
    except asyncio.QueueFull:
        log.warning("event queue full for run %s — dropping", run_id)


# ════════════════════════════════════════════════════════════════════
#  Per-trial worker
# ════════════════════════════════════════════════════════════════════


def _make_candidate_prompt(
    *,
    prompt_version: str | None,
    question: str,
    context: str,
) -> list[dict[str, str]]:
    """Compose the candidate model's input. We don't (yet) store full prompt
    templates per version — for W2 we use a generic 'follow the rubric' frame.
    Future: pull real prompt body from a PromptVersion row keyed by version id.
    """
    sys = (
        "You are answering an analyst's question grounded in the provided "
        "document. Cite numbers / clauses verbatim. If you don't know, say so. "
        "Do not give investment advice or speculation."
    )
    if prompt_version:
        sys += f" [variant {prompt_version}]"
    user = f"DOCUMENT:\n{context[:6000]}\n\nQUESTION: {question}"
    return [
        {"role": "system", "content": sys},
        {"role": "user", "content": user},
    ]


async def _run_one_trial(
    *,
    db: AsyncSession,
    run: Run,
    case: Case,
    prompt_version: str | None,
    model: str,
    params: dict[str, Any],
    judge_dims: list[str],
    byok_keys: dict[str, Any] | None,
    idx: int,
) -> Trial:
    """Execute one (prompt × model × case) trial: call candidate LLM, then judge."""
    started = datetime.now(timezone.utc)

    candidate_out = ""
    pt = ct = 0
    cost_cand = 0.0
    latency = 0
    candidate_err: str | None = None

    try:
        result = await chat(
            model=model,
            messages=_make_candidate_prompt(
                prompt_version=prompt_version,
                question=case.input["question"],
                context=case.input.get("context", ""),
            ),
            byok_keys=byok_keys,
            temperature=float(params.get("temperature", 0.2)),
            max_tokens=int(params.get("max_tokens", 1024)),
            mock_reference=case.reference,
        )
        candidate_out = result.content
        pt, ct = result.prompt_tokens, result.completion_tokens
        cost_cand = result.cost
        latency = result.latency_ms
    except Exception as e:  # noqa: BLE001
        candidate_err = str(e)[:400]
        log.warning("trial %d candidate failed: %s", idx, candidate_err)

    # Even when candidate failed, run judge over the empty output → severity L2/L3
    judge_res = await judge_trial(
        question=case.input["question"],
        context=case.input.get("context", ""),
        reference=case.reference,
        output=candidate_out,
        enabled_dims=judge_dims,
        byok_keys=byok_keys,
    )

    trial = Trial(
        run_id=run.id,
        case_id=case.id,
        idx=idx,
        prompt_version=prompt_version,
        model=model,
        params=params,
        output=candidate_out,
        prompt_tokens=pt,
        completion_tokens=ct,
        latency_ms=latency,
        cost=cost_cand,
        severity=judge_res.severity,
        scores=judge_res.scores,
        judge_explanation=judge_res.explanation,
        judge_error=candidate_err or judge_res.error,
    )
    db.add(trial)
    await db.commit()
    await db.refresh(trial)

    _ = started
    return trial


# ════════════════════════════════════════════════════════════════════
#  Run orchestrator
# ════════════════════════════════════════════════════════════════════


async def _execute_run(run_id: str, session_byok: dict[str, Any] | None) -> None:
    """Background task — runs the matrix, persists trials, emits events."""

    async with AsyncSessionLocal() as db:
        run = (await db.execute(select(Run).where(Run.id == run_id))).scalar_one_or_none()
        if run is None:
            _emit(run_id, {"type": "error", "message": "run not found"})
            return

        exp = (await db.execute(
            select(Experiment).where(Experiment.id == run.experiment_id)
        )).scalar_one()
        ds = (await db.execute(
            select(Dataset).where(Dataset.id == exp.dataset_id)
        )).scalar_one()
        cases: list[Case] = list(
            (await db.execute(
                select(Case).where(Case.dataset_id == ds.id).order_by(Case.case_code).limit(DEFAULT_MAX_TRIALS)
            )).scalars().all()
        )

        axes = exp.variable_axes or {}
        prompts: list[str | None] = list(axes.get("prompts") or [None])
        models: list[str] = list(axes.get("models") or [])
        params: dict[str, Any] = dict(axes.get("params") or {})
        judge_dims: list[str] = list(exp.judge_dims or ["fact_accuracy", "hallucination_severity"])

        if not models:
            _emit(run_id, {"type": "error", "message": "no models selected"})
            run.status = RunStatus.failed.value
            run.error = "no models selected"
            await db.commit()
            return

        total = len(prompts) * len(models) * len(cases)
        run.status = RunStatus.running.value
        run.started_at = datetime.now(timezone.utc)
        run.trial_count = total
        await db.commit()

        # Build trial work items
        work: list[tuple[Case, str | None, str, int]] = []
        idx = 0
        for p in prompts:
            for m in models:
                for c in cases:
                    idx += 1
                    work.append((c, p, m, idx))

        cost_total = 0.0
        done = 0
        sem = asyncio.Semaphore(TRIAL_CONCURRENCY)

        async def _slot(case: Case, prompt_v: str | None, model: str, i: int) -> Trial | None:
            async with sem:
                try:
                    async with AsyncSessionLocal() as inner_db:
                        # need fresh Run binding inside this nested session
                        fresh_run = (await inner_db.execute(
                            select(Run).where(Run.id == run.id)
                        )).scalar_one()
                        return await _run_one_trial(
                            db=inner_db, run=fresh_run, case=case,
                            prompt_version=prompt_v, model=model, params=params,
                            judge_dims=judge_dims, byok_keys=session_byok, idx=i,
                        )
                except Exception as e:  # noqa: BLE001
                    log.exception("trial %d crashed: %s", i, e)
                    return None

        # Run-to-completion with progress events + periodic commit
        tasks = [_slot(c, p, m, i) for (c, p, m, i) in work]
        COMMIT_EVERY = 5
        for fut in asyncio.as_completed(tasks):
            trial = await fut
            done += 1
            if trial is not None:
                cost_total += trial.cost
                _emit(run_id, {
                    "type":      "trial",
                    "idx":       trial.idx,
                    "model":     trial.model,
                    "case_code": next((c.case_code for c in cases if c.id == trial.case_id), None),
                    "severity":  trial.severity,
                    "cost":      round(trial.cost, 4),
                    "latency_ms":trial.latency_ms,
                    "done":      done,
                    "total":     total,
                    "cost_actual": round(cost_total, 4),
                })

            # Periodic commit so GET /runs/{id} reflects progress mid-flight,
            # and crashes don't lose visibility into how far we got.
            if done % COMMIT_EVERY == 0 or done == total:
                try:
                    async with AsyncSessionLocal() as progress_db:
                        r = (await progress_db.execute(select(Run).where(Run.id == run.id))).scalar_one()
                        r.trials_done = done
                        r.cost_actual = round(cost_total, 4)
                        await progress_db.commit()
                except Exception as e:  # noqa: BLE001
                    log.warning("progress commit failed at %d/%d: %s", done, total, e)

        # Decision Book — fetch all trials, compose via Writer LLM, persist
        decision_book: dict[str, Any] | None = None
        try:
            async with AsyncSessionLocal() as book_db:
                all_trials = list((
                    await book_db.execute(
                        select(Trial).where(Trial.run_id == run.id).order_by(Trial.idx)
                    )
                ).scalars().all())
                decision_book = await compose_decision_book(
                    experiment_title=exp.title,
                    scenario=exp.scenario,
                    trials=all_trials,
                    byok_keys=session_byok,
                )
        except Exception as e:  # noqa: BLE001
            log.warning("decision book compose failed: %s", e)

        # Mark complete + persist decision book
        async with AsyncSessionLocal() as final_db:
            r = (await final_db.execute(select(Run).where(Run.id == run.id))).scalar_one()
            r.status = RunStatus.done.value
            r.trials_done = done
            r.cost_actual = round(cost_total, 4)
            r.finished_at = datetime.now(timezone.utc)
            if decision_book is not None:
                r.decision_book = decision_book
            await final_db.commit()

        _emit(run_id, {
            "type": "complete",
            "done": done,
            "total": total,
            "cost_actual": round(cost_total, 4),
        })


# ════════════════════════════════════════════════════════════════════
#  Public API
# ════════════════════════════════════════════════════════════════════


def start_run(run_id: str, *, byok_keys: dict[str, Any] | None = None) -> None:
    """Kick off the run as a background task. Idempotent — second call is a no-op."""
    if run_id in _TASKS and not _TASKS[run_id].done():
        return
    _TASKS[run_id] = asyncio.create_task(_execute_run(run_id, byok_keys))


def is_running(run_id: str) -> bool:
    task = _TASKS.get(run_id)
    return task is not None and not task.done()
