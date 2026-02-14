"""
Evaluation Runs API endpoints.
Triggers background tasks for LLM evaluation.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_session_id
from app.models.models import EvaluationRun, Dataset, EvaluationItem
from app.schemas.schemas import RunCreate, RunResponse, ItemResponse
from app.services.judge import evaluate_single

router = APIRouter(prefix="/runs", tags=["runs"])

DEFAULT_SYSTEM_PROMPT = """
You are an expert judge evaluating AI model outputs.
Your task is to score the response based on the provided metric.
Score explicitly from 0.0 to 1.0.
"""





@router.post("", response_model=RunResponse, status_code=201)
def create_run(
    payload: RunCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
    x_llm_key: str | None = Header(default=None),
    x_llm_model: str | None = Header(default=None),
    x_llm_base_url: str | None = Header(default=None),
):
    """Start a new evaluation run."""
    dataset = db.query(Dataset).filter(Dataset.id == payload.dataset_id, Dataset.session_id == session_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Determine model: Header (Custom) > Payload (Preset)
    final_model = x_llm_model if x_llm_model else payload.model

    run = EvaluationRun(
        session_id=session_id,
        dataset_id=dataset.id,
        dataset_name=dataset.name,
        model=final_model,
        metrics=payload.metrics,
        system_prompt=payload.system_prompt or DEFAULT_SYSTEM_PROMPT,
        status="running",
        total_items=dataset.item_count,
        completed_items=0,
        average_scores=None,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # Trigger Background Task
    background_tasks.add_task(
        _run_evaluation,
        run_id=run.id,
        items=dataset.raw_data,
        model=final_model,
        metrics=payload.metrics,
        system_prompt=run.system_prompt,
        api_key=x_llm_key,
        api_base=x_llm_base_url,
    )

    return run


@router.get("", response_model=list[RunResponse])
def list_runs(
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
):
    """List all evaluation runs for current session."""
    runs = db.query(EvaluationRun).filter(EvaluationRun.session_id == session_id).order_by(EvaluationRun.created_at.desc()).all()
    return runs


@router.get("/{run_id}", response_model=RunResponse)
def get_run(
    run_id: str,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
):
    """Get a single run by ID."""
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id, EvaluationRun.session_id == session_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/{run_id}/items", response_model=list[ItemResponse])
def get_run_items(
    run_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
):
    """Get detailed results for a run."""
    # Ensure run belongs to session
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id, EvaluationRun.session_id == session_id).first()
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


# ── Background Task ─────────────────────────────

async def _run_evaluation(
    run_id: str,
    items: list[dict],
    model: str,
    metrics: list[str],
    system_prompt: str,
    api_key: str | None = None,
    api_base: str | None = None,
):
    """
    Background task: evaluate each item sequentially,
    update progress in the database after each item.
    """
    db = SessionLocal()

    try:
        all_scores = {"faithfulness": [], "relevance": [], "coherence": []}

        for i, item_data in enumerate(items):
            item_scores = {}
            reasoning_parts = []
            total_usage = {"prompt_tokens": 0, "completion_tokens": 0}

            for metric in metrics:
                result = await evaluate_single(
                    query=item_data.get("query", ""),
                    context=item_data.get("context", ""),
                    response=item_data.get("response", ""),
                    model=model,
                    metric=metric,
                    system_prompt=system_prompt,
                    api_key=api_key,
                    api_base=api_base,
                )
                item_scores[metric] = result["score"]
                reasoning_parts.append(f"[{metric}] {result['reasoning']}")
                total_usage["prompt_tokens"] += result["usage"]["prompt_tokens"]
                total_usage["completion_tokens"] += result["usage"]["completion_tokens"]

            # Determine failure type
            failure_type = None
            threshold = settings.low_score_threshold
            if item_scores.get("faithfulness", 1) < threshold:
                failure_type = "Reasoning_Error"
            elif item_scores.get("relevance", 1) < threshold:
                failure_type = "Retrieval_Failure"

            # Save evaluation item
            eval_item = EvaluationItem(
                run_id=run_id,
                query=item_data.get("query", ""),
                context=item_data.get("context", ""),
                response=item_data.get("response", ""),
                ground_truth=item_data.get("ground_truth", ""),
                scores=item_scores,
                reasoning="\n\n".join(reasoning_parts),
                failure_type=failure_type,
                usage=total_usage,
            )
            db.add(eval_item)

            # Track scores for averaging
            for metric in metrics:
                if metric in all_scores:
                    all_scores[metric].append(item_scores.get(metric, 0))

            # Update run progress
            run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
            if run:
                run.completed_items = i + 1
                db.commit()

        # Finalize: compute averages and mark complete
        run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
        if run:
            avg_scores = {}
            for metric, scores_list in all_scores.items():
                if scores_list:
                    avg_scores[metric] = round(sum(scores_list) / len(scores_list), 4)
            run.average_scores = avg_scores
            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            db.commit()

    except Exception as e:
        # Mark run as failed
        run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
        if run:
            run.status = "failed"
            db.commit()
        print(f"[ERROR] Evaluation failed for run {run_id}: {e}")

    finally:
        db.close()
