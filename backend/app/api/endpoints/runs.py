"""Run endpoints — POST creates + spawns the engine task; /stream subscribes."""

from __future__ import annotations

import asyncio

import orjson
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.deps import current_session, get_db_dep
from app.models.models import Dataset, Experiment, Run, RunStatus
from app.models.models import Session as SessionRow
from app.schemas import NewRunIn, RunOut
from app.services import run_engine

router = APIRouter(prefix="/runs", tags=["runs"])


def _matrix_size(variable_axes: dict, case_count: int) -> int:
    n = len(variable_axes.get("prompts") or [None])
    m = len(variable_axes.get("models") or [])
    return max(1, n) * max(1, m) * case_count


@router.post("", response_model=RunOut)
async def create_run(
    body: NewRunIn,
    db: AsyncSession = Depends(get_db_dep),
    sess: SessionRow = Depends(current_session),
) -> Run:
    """Create a Run row and kick off the engine in the background."""
    if not body.experiment_id:
        raise HTTPException(400, "experiment_id is required (POST /experiments first)")

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

    ds = (await db.execute(select(Dataset).where(Dataset.id == exp.dataset_id))).scalar_one()
    # Engine caps to DEFAULT_MAX_TRIALS cases per run for demo cost control.
    effective_cases = min(ds.cases_count, run_engine.DEFAULT_MAX_TRIALS)
    trial_count = _matrix_size(exp.variable_axes, effective_cases)

    run = Run(
        experiment_id=exp.id,
        status=RunStatus.queued.value,
        trial_count=trial_count,
        trials_done=0,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Kick off background execution. BYOK keys carried via session row.
    run_engine.start_run(run.id, byok_keys=sess.api_keys or {})
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
    """SSE stream of the run's live events. Subscribes to run_engine's in-process
    event bus. Auto-completes after the engine emits 'complete'."""
    run = (
        await db.execute(
            select(Run)
            .join(Experiment, Run.experiment_id == Experiment.id)
            .where(Run.id == run_id, Experiment.session_id == sess.id)
        )
    ).scalar_one_or_none()
    if run is None:
        raise HTTPException(404, "run not found")

    # If a client refreshes after completion, no events will be re-played.
    # Re-emit a synthetic 'complete' so the UI flips to its done state.
    if run.status == RunStatus.done.value:
        async def replay():
            yield {
                "event": "complete",
                "data": orjson.dumps({
                    "type": "complete",
                    "done": run.trials_done,
                    "total": run.trial_count,
                    "cost_actual": run.cost_actual,
                }).decode(),
            }
        return EventSourceResponse(replay())

    async def event_generator():
        async for ev in run_engine.subscribe(run_id):
            if await request.is_disconnected():
                break
            evtype = ev.get("type", "trial")
            yield {"event": evtype, "data": orjson.dumps(ev).decode()}

    return EventSourceResponse(event_generator())
