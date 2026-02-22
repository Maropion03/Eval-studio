"""
Eval Studio — A/B Comparison API endpoint.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.models import EvaluationRun, EvaluationItem
from app.schemas.schemas import CompareResponse, RunResponse, ItemResponse

router = APIRouter(prefix="/compare", tags=["compare"])


@router.get("", response_model=CompareResponse)
def compare_runs(
    baseId: str,
    targetId: str,
    db: Session = Depends(get_db),
):
    """
    Compare two evaluation runs side by side.
    Returns both runs' metadata and their evaluation items.
    """
    base_run = db.query(EvaluationRun).filter(EvaluationRun.id == baseId).first()
    target_run = db.query(EvaluationRun).filter(EvaluationRun.id == targetId).first()

    if not base_run:
        raise HTTPException(status_code=404, detail=f"Base run '{baseId}' not found")
    if not target_run:
        raise HTTPException(status_code=404, detail=f"Target run '{targetId}' not found")

    base_items = (
        db.query(EvaluationItem)
        .filter(EvaluationItem.run_id == baseId)
        .all()
    )
    target_items = (
        db.query(EvaluationItem)
        .filter(EvaluationItem.run_id == targetId)
        .all()
    )

    return CompareResponse(
        base_run=RunResponse.model_validate(base_run),
        target_run=RunResponse.model_validate(target_run),
        base_items=[ItemResponse.model_validate(item) for item in base_items],
        target_items=[ItemResponse.model_validate(item) for item in target_items],
    )
