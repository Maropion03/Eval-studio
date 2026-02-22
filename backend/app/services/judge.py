"""
Eval Studio — LLM Evaluation Service

Contains the core evaluation logic:
  1. evaluate_single — async single-shot evaluation (for Playground)
  2. run_evaluation_background — synchronous batch evaluation (for Runs)
"""

from litellm import acompletion
from sqlalchemy.orm import Session
from app.models.models import EvaluationRun, EvaluationItem, Dataset
import json
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# ─── Helper Functions ─────────────────────────────────────────────


def _parse_scores(content: str) -> Dict[str, float]:
    """Parse JSON scores from LLM response safely."""
    try:
        clean_content = content.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_content)
    except Exception:
        logger.warning(f"JSON Parse Failed. Content: {content[:80]}...")
        return {"faithfulness": 0.0, "relevance": 0.0, "coherence": 0.0}


# ─── 1. Single Evaluation (For Playground & Runs) ─────────────────


async def evaluate_single(
    system_prompt: str,
    query: str,
    context: str,
    model: str,
    response: str = "",
    metric: str = "",
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    """
    Run a single evaluation asynchronously.
    Used by the Playground AND runs.py (inside _run_evaluation).
    """
    if not api_key:
        raise ValueError("No API Key provided.")

    target_base_url = base_url if base_url else "https://api.siliconflow.cn/v1"

    # Construct user content
    user_content = f"Query: {query}\nContext: {context}"
    if response:
        user_content += f"\nResponse: {response}"
    if metric:
        user_content += f"\n\nPlease evaluate the following metric: {metric}"

    try:
        llm_response = await acompletion(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            api_key=api_key,
            base_url=target_base_url,
            custom_llm_provider="openai",
        )

        content = llm_response.choices[0].message.content
        scores = _parse_scores(content)

        return {
            "score": scores.get(metric, 0) if metric else 0,
            "response": content,
            "scores": scores,
            "reasoning": content,
            "model": model,
            "usage": dict(llm_response.usage) if hasattr(llm_response, "usage") and llm_response.usage else {},
            "latency_ms": 0,
        }
    except Exception as e:
        logger.error(f"Single Eval Failed: {e}")
        raise e


# ─── 2. Background Batch Evaluation ───────────────────────────────


def run_evaluation_background(
    db: Session,
    run_id: str,
    system_prompt: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
):
    """
    Run a full dataset evaluation in the background (synchronous).
    Called from runs.py via _run_evaluation_wrapper.
    """
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
    if not run:
        logger.error(f"Run {run_id} not found")
        return

    try:
        if not api_key:
            raise ValueError("No API Key provided! Please check Settings.")

        logger.info(f"[Eval] Starting Run {run_id}")

        # Get dataset items from raw_data (JSON column)
        dataset = db.query(Dataset).filter(Dataset.id == run.dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset {run.dataset_id} not found")

        items = dataset.raw_data or []

        run.total_items = len(items)
        db.commit()

        completed_count = 0
        total_faithfulness = 0.0
        total_relevance = 0.0
        total_coherence = 0.0

        target_base_url = base_url if base_url else "https://api.siliconflow.cn/v1"

        from litellm import completion

        for item_data in items:
            query = item_data.get("query", "")
            context = item_data.get("context", "")
            item_response = item_data.get("response", "")
            user_content = f"Query: {query}\nContext: {context}"
            if item_response:
                user_content += f"\nResponse: {item_response}"

            try:
                llm_result = completion(
                    model=run.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    api_key=api_key,
                    base_url=target_base_url,
                    custom_llm_provider="openai",
                )

                content = llm_result.choices[0].message.content
                scores = _parse_scores(content)

                eval_item = EvaluationItem(
                    run_id=run.id,
                    session_id=run.session_id,
                    query=query,
                    context=context,
                    response=item_response,
                    ground_truth=item_data.get("ground_truth", ""),
                    scores=scores,
                    reasoning=content,
                    usage=dict(llm_result.usage) if hasattr(llm_result, "usage") and llm_result.usage else {},
                )
                db.add(eval_item)

                total_faithfulness += scores.get("faithfulness", 0)
                total_relevance += scores.get("relevance", 0)
                total_coherence += scores.get("coherence", 0)
                completed_count += 1

                run.completed_items = completed_count
                db.commit()

            except Exception as e:
                logger.error(f"❌ LLM Call Failed for item: {e}")
                continue

        if completed_count > 0:
            run.average_scores = {
                "faithfulness": total_faithfulness / completed_count,
                "relevance": total_relevance / completed_count,
                "coherence": total_coherence / completed_count,
            }

        run.status = "completed"
        db.commit()

    except Exception as e:
        logger.error(f"🔥 Run Crashed: {e}")
        db.rollback()
        run.status = "failed"
        db.commit()
