"""
Eval Studio — Evaluation Runs API Endpoints
"""

from fastapi import APIRouter, Depends, BackgroundTasks, Header, HTTPException
from sqlalchemy.orm import Session
from typing import Any, Optional, List

from app.db.session import SessionLocal
from app.api.deps import get_db, get_session_id
from app.models.models import EvaluationRun, EvaluationItem, AppSettings, Dataset
from app.schemas.schemas import EvaluationRunCreate, EvaluationRun as RunSchema
from app.services.judge import run_evaluation_background

router = APIRouter(prefix="/runs", tags=["runs"])

# Default prompt if none is configured
DEFAULT_SYSTEM_PROMPT = """You are an expert AI judge. Evaluate the response based on the query and context provided.

Score the response on the following metrics and output valid JSON:
- faithfulness (0-1): How faithful is the response to the context?
- relevance (0-1): How relevant is the response to the query?
- coherence (1-5): How coherent and well-structured is the response?

Output format:
{"faithfulness": <float>, "relevance": <float>, "coherence": <float>, "reasoning": "<string>"}"""


@router.get("", response_model=List[RunSchema])
def list_runs(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    session_id: str = Depends(get_session_id),
):
    runs = (
        db.query(EvaluationRun)
        .filter(EvaluationRun.session_id == session_id)
        .order_by(EvaluationRun.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return runs


@router.post("", response_model=RunSchema, status_code=201)
def create_run(
    run_in: EvaluationRunCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_llm_key: Optional[str] = Header(None),
    x_llm_base_url: Optional[str] = Header(None),
    x_llm_model: Optional[str] = Header(None),
    session_id: str = Depends(get_session_id),
) -> Any:
    """Create a new evaluation run."""
    # 1. Determine Model (Header overrides Payload)
    target_model = x_llm_model if x_llm_model else run_in.model

    # 2. Look up dataset name from DB
    dataset = db.query(Dataset).filter(Dataset.id == run_in.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset '{run_in.dataset_id}' not found")

    # 3. Create DB Record
    run = EvaluationRun(
        dataset_id=run_in.dataset_id,
        dataset_name=dataset.name,
        model=target_model,
        metrics=run_in.metrics,
        system_prompt=run_in.system_prompt,
        status="running",
        session_id=session_id,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    print(f"📝 Created Run {run.id} for dataset '{dataset.name}' with model '{target_model}'")

    # 4. Trigger Background Task
    background_tasks.add_task(
        _run_evaluation_wrapper,
        run_id=run.id,
        run_system_prompt=run_in.system_prompt,
        api_key=x_llm_key,
        base_url=x_llm_base_url,
    )

    return run


@router.get("/{run_id}", response_model=RunSchema)
def get_run(
    run_id: str,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
):
    run = db.query(EvaluationRun).filter(
        EvaluationRun.id == run_id,
        EvaluationRun.session_id == session_id,
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/{run_id}/items")
def get_run_items(
    run_id: str,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 200,
    session_id: str = Depends(get_session_id),
):
    run = db.query(EvaluationRun).filter(
        EvaluationRun.id == run_id,
        EvaluationRun.session_id == session_id,
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    items = (
        db.query(EvaluationItem)
        .filter(EvaluationItem.run_id == run_id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items


# ─── Background Wrapper ───────────────────────────────────────────

def _run_evaluation_wrapper(
    run_id: str,
    run_system_prompt: Optional[str],
    api_key: Optional[str],
    base_url: Optional[str],
):
    """Wrapper to handle DB session lifecycle and resolve system prompt."""
    db = SessionLocal()
    try:
        # Resolve system prompt priority:
        # 1. Run's own system_prompt (from user's modal submission)
        # 2. AppSettings.system_prompt (global config)
        # 3. Built-in default
        effective_prompt = DEFAULT_SYSTEM_PROMPT

        settings_record = db.query(AppSettings).first()
        if settings_record and settings_record.system_prompt:
            effective_prompt = settings_record.system_prompt

        # Run-level prompt takes highest priority
        if run_system_prompt:
            effective_prompt = run_system_prompt

        print(f"🔧 Run {run_id}: Using prompt ({len(effective_prompt)} chars)")

        # Call the concurrent evaluation engine
        run_evaluation_background(
            db=db,
            run_id=run_id,
            system_prompt=effective_prompt,
            api_key=api_key,
            base_url=base_url,
        )
    except Exception as e:
        print(f"❌ Wrapper Error for Run {run_id}: {e}")
    finally:
        db.close()
