"""
Eval Studio — LLM Evaluation Service

Contains the core evaluation logic:
  1. evaluate_single — async single-shot evaluation (for Playground)
  2. run_evaluation_background — concurrent batch evaluation (for Runs)
"""

import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, Dict, Any

from litellm import acompletion, completion
from sqlalchemy.orm import Session

from app.models.models import EvaluationRun, EvaluationItem, Dataset

logger = logging.getLogger(__name__)

# Concurrency config — max parallel LLM calls
MAX_CONCURRENT_CALLS = 5

# ─── Helper Functions ─────────────────────────────────────────────


def _parse_scores(content: str) -> Dict[str, float]:
    """Parse JSON scores from LLM response safely."""
    try:
        clean_content = content.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_content)
        # Handle both flat {"faithfulness": 0.8} and nested {"scores": {...}} formats
        if isinstance(data, dict):
            if "scores" in data and isinstance(data["scores"], dict):
                return data["scores"]
            return data
        return {"faithfulness": 0.0, "relevance": 0.0, "coherence": 0.0}
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
    Used by the Playground endpoint.
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


# ─── 2. Background Batch Evaluation (Concurrent) ─────────────────


def _evaluate_one_item(
    item_data: dict,
    model: str,
    system_prompt: str,
    api_key: str,
    base_url: str,
    index: int,
) -> Dict[str, Any]:
    """
    Evaluate a single item synchronously.
    Designed to be called from ThreadPoolExecutor.
    Returns a dict with scores, reasoning, usage, and the original item_data.
    """
    query = item_data.get("query", "")
    context = item_data.get("context", "")
    item_response = item_data.get("response", "")

    user_content = f"Query: {query}\nContext: {context}"
    if item_response:
        user_content += f"\nResponse: {item_response}"

    try:
        llm_result = completion(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            api_key=api_key,
            base_url=base_url,
            custom_llm_provider="openai",
        )

        content = llm_result.choices[0].message.content
        scores = _parse_scores(content)

        print(f"  ✅ Item {index + 1}: scores={json.dumps(scores, ensure_ascii=False)}")

        return {
            "success": True,
            "index": index,
            "item_data": item_data,
            "scores": scores,
            "reasoning": content,
            "usage": dict(llm_result.usage) if hasattr(llm_result, "usage") and llm_result.usage else {},
        }
    except Exception as e:
        print(f"  ❌ Item {index + 1} Failed: {e}")
        return {
            "success": False,
            "index": index,
            "item_data": item_data,
            "error": str(e),
        }


def run_evaluation_background(
    db: Session,
    run_id: str,
    system_prompt: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
):
    """
    Run a full dataset evaluation in the background with concurrent LLM calls.
    Uses ThreadPoolExecutor to process up to MAX_CONCURRENT_CALLS items in parallel.
    """
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
    if not run:
        logger.error(f"Run {run_id} not found")
        return

    try:
        if not api_key:
            raise ValueError("No API Key provided! Please check Settings.")

        # Get dataset items
        dataset = db.query(Dataset).filter(Dataset.id == run.dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset {run.dataset_id} not found")

        items = dataset.raw_data or []
        run.total_items = len(items)
        db.commit()

        target_base_url = base_url if base_url else "https://api.siliconflow.cn/v1"

        print(f"🚀 Run {run_id}: Evaluating {len(items)} items (concurrency={MAX_CONCURRENT_CALLS})")

        completed_count = 0
        total_faithfulness = 0.0
        total_relevance = 0.0
        total_coherence = 0.0

        # Use ThreadPoolExecutor for concurrent LLM calls
        with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_CALLS) as executor:
            futures = {
                executor.submit(
                    _evaluate_one_item,
                    item_data=item_data,
                    model=run.model,
                    system_prompt=system_prompt,
                    api_key=api_key,
                    base_url=target_base_url,
                    index=i,
                ): i
                for i, item_data in enumerate(items)
            }

            for future in as_completed(futures):
                result = future.result()

                if result["success"]:
                    item_data = result["item_data"]
                    scores = result["scores"]

                    eval_item = EvaluationItem(
                        run_id=run.id,
                        session_id=run.session_id,
                        query=item_data.get("query", ""),
                        context=item_data.get("context", ""),
                        response=item_data.get("response", ""),
                        ground_truth=item_data.get("ground_truth", ""),
                        scores=scores,
                        reasoning=result["reasoning"],
                        usage=result["usage"],
                    )
                    db.add(eval_item)

                    total_faithfulness += scores.get("faithfulness", 0)
                    total_relevance += scores.get("relevance", 0)
                    total_coherence += scores.get("coherence", 0)
                    completed_count += 1

                    run.completed_items = completed_count
                    db.commit()

                    print(f"  📊 Progress: {completed_count}/{len(items)}")

        if completed_count > 0:
            run.average_scores = {
                "faithfulness": round(total_faithfulness / completed_count, 4),
                "relevance": round(total_relevance / completed_count, 4),
                "coherence": round(total_coherence / completed_count, 4),
            }

        run.status = "completed"
        db.commit()
        print(f"✅ Run {run_id}: Completed! avg_scores={json.dumps(run.average_scores, ensure_ascii=False)}")

    except Exception as e:
        print(f"🔥 Run {run_id} Crashed: {e}")
        logger.error(f"Run Crashed: {e}")
        db.rollback()
        run.status = "failed"
        db.commit()
