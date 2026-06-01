"""Run endpoints.

Week 1 scope:
    - POST /runs            create a queued Run row (no execution yet)
    - GET  /runs/{id}       fetch run + computed report
    - GET  /runs/{id}/stream stub SSE (placeholder events) — real execution
                            engine lands in Week 2.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import orjson
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.deps import current_session, get_db_dep
from app.models.models import (
    Case,
    Dataset,
    Experiment,
    Run,
    RunStatus,
)
from app.models.models import Session as SessionRow
from app.schemas import NewRunIn, RunOut, TrialEvent

router = APIRouter(prefix="/runs", tags=["runs"])


def _matrix_size(variable_axes: dict, case_count: int) -> int:
    n = len(variable_axes.get("prompts", []) or [None])
    m = len(variable_axes.get("models", []) or [])
    return max(1, n) * max(1, m) * case_count


@router.post("", response_model=RunOut)
async def create_run(
    body: NewRunIn,
    db: AsyncSession = Depends(get_db_dep),
    sess: SessionRow = Depends(current_session),
) -> Run:
    """Create a Run row in 'queued' state. Real execution kicked off
    by a background task (Week 2)."""
    if not body.experiment_id and not body.inline_experiment:
        raise HTTPException(400, "either experiment_id or inline_experiment is required")

    if body.experiment_id:
        exp: Experiment | None = (
            await db.execute(
                select(Experiment).where(
                    Experiment.id == body.experiment_id,
                    Experiment.session_id == sess.id,
                )
            )
        ).scalar_one_or_none()
        if exp is None:
            raise HTTPException(404, "experiment not found")
    else:
        # Defer this branch — full inline-experiment creation happens via
        # /experiments first; clients should not skip it.
        raise HTTPException(400, "inline_experiment creation not implemented in W1; "
                                 "POST /experiments first then POST /runs")

    ds = (await db.execute(select(Dataset).where(Dataset.id == exp.dataset_id))).scalar_one()
    trial_count = _matrix_size(exp.variable_axes, ds.cases_count)

    run = Run(
        experiment_id=exp.id,
        status=RunStatus.queued.value,
        trial_count=trial_count,
        trials_done=0,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


@router.get("/{run_id}", response_model=RunOut)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db_dep),
    sess: SessionRow = Depends(current_session),
) -> Run:
    run = (
        await db.execute(
            select(Run)
            .join(Experiment, Run.experiment_id == Experiment.id)
            .where(Run.id == run_id, Experiment.session_id == sess.id)
        )
    ).scalar_one_or_none()
    if run is None:
        raise HTTPException(404, "run not found")
    return run


@router.get("/{run_id}/stream")
async def stream_run(
    run_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_dep),
    sess: SessionRow = Depends(current_session),
):
    """SSE stream. Week 1 = placeholder events. Week 2 wires up the real
    execution engine + per-trial broadcast."""

    run = (
        await db.execute(
            select(Run)
            .join(Experiment, Run.experiment_id == Experiment.id)
            .where(Run.id == run_id, Experiment.session_id == sess.id)
        )
    ).scalar_one_or_none()
    if run is None:
        raise HTTPException(404, "run not found")

    total = run.trial_count

    async def event_generator():
        # mark start
        run.status = RunStatus.running.value
        run.started_at = datetime.now(timezone.utc)
        await db.commit()

        for i in range(1, total + 1):
            if await request.is_disconnected():
                break
            event = TrialEvent(
                type="trial",
                idx=i,
                model="(stub)",
                case_code=f"case-{i:03d}",
                severity="L0",
                cost=0.02,
                latency_ms=300,
                done=i,
                total=total,
            )
            yield {"event": "trial", "data": orjson.dumps(event.model_dump()).decode()}
            await asyncio.sleep(0.18)

        # complete
        run.status = RunStatus.done.value
        run.trials_done = total
        run.finished_at = datetime.now(timezone.utc)
        await db.commit()

        yield {
            "event": "complete",
            "data": orjson.dumps({"type": "complete", "done": total, "total": total}).decode(),
        }

    return EventSourceResponse(event_generator())
