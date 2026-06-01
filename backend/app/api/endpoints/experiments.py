from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_session, get_db_dep
from app.models.models import Dataset, Experiment
from app.models.models import Session as SessionRow
from app.schemas import CreateExperimentIn, ExperimentOut

router = APIRouter(prefix="/experiments", tags=["experiments"])


@router.get("", response_model=list[ExperimentOut])
async def list_experiments(
    db: AsyncSession = Depends(get_db_dep),
    sess: SessionRow = Depends(current_session),
) -> list[Experiment]:
    stmt = (
        select(Experiment)
        .where(Experiment.session_id == sess.id)
        .order_by(Experiment.seq.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=ExperimentOut)
async def create_experiment(
    body: CreateExperimentIn,
    db: AsyncSession = Depends(get_db_dep),
    sess: SessionRow = Depends(current_session),
) -> Experiment:
    ds = (await db.execute(select(Dataset).where(Dataset.id == body.dataset_id))).scalar_one_or_none()
    if ds is None:
        raise HTTPException(status_code=404, detail=f"dataset {body.dataset_id} not found")

    # Per-session monotonic seq
    next_seq = (
        await db.execute(
            select(func.coalesce(func.max(Experiment.seq), 0) + 1).where(
                Experiment.session_id == sess.id
            )
        )
    ).scalar_one()

    exp = Experiment(
        session_id=sess.id,
        seq=int(next_seq),
        title=body.title,
        kind=body.kind,
        scenario=ds.scenario,
        dataset_id=ds.id,
        variable_axes=body.variable_axes,
        judge_dims=body.judge_dims,
    )
    db.add(exp)
    await db.commit()
    await db.refresh(exp)
    return exp


@router.get("/{experiment_id}", response_model=ExperimentOut)
async def get_experiment(
    experiment_id: str,
    db: AsyncSession = Depends(get_db_dep),
    sess: SessionRow = Depends(current_session),
) -> Experiment:
    exp = (
        await db.execute(
            select(Experiment).where(
                Experiment.id == experiment_id,
                Experiment.session_id == sess.id,
            )
        )
    ).scalar_one_or_none()
    if exp is None:
        raise HTTPException(status_code=404, detail="experiment not found")
    return exp
