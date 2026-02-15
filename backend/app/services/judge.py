from litellm import completion
from sqlalchemy.orm import Session
from app.models.models import EvaluationRun, EvaluationItem, Dataset
import json
import logging
from typing import Optional, Dict, Any

# ─── Helper Functions ─────────────────────────────────────────────

def _parse_scores(content: str) -> Dict[str, float]:
    """Helper to parse JSON scores from LLM response safely."""
    try:
        clean_content = content.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_content)
    except:
        print(f"[Eval] JSON Parse Failed. Content: {content[:50]}...")
        return {"faithfulness": 0.0, "relevance": 0.0, "coherence": 0.0}

# ─── 1. Single Evaluation (For Playground) ────────────────────────

def evaluate_single(
    system_prompt: str,
    query: str,
    context: str,
    model: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Run a single evaluation synchronously. Used by the Playground.
    """
    if not api_key:
         raise ValueError("No API Key provided.")

    target_base_url = base_url if base_url else "https://api.siliconflow.cn/v1"
    user_content = f"Query: {query}\nContext: {context}"

    try:
        # CRITICAL: Force 'openai' provider for SiliconFlow compatibility
        response = completion(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            api_key=api_key,
            base_url=target_base_url,
            custom_llm_provider="openai" 
        )

        content = response.choices[0].message.content
        scores = _parse_scores(content)

        return {
            "response": content,
            "scores": scores,
            "usage": dict(response.usage) if hasattr(response, 'usage') else {},
            "latency_ms": 0 # Placeholder
        }
    except Exception as e:
        print(f"Single Eval Failed: {e}")
        raise e

# ─── 2. Background Batch Evaluation (For Runs) ────────────────────

def run_evaluation_background(
    db: Session, 
    run_id: str, 
    system_prompt: str, 
    api_key: Optional[str] = None, 
    base_url: Optional[str] = None
):
    """
    Run a full dataset evaluation in the background.
    """
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
    if not run:
        return

    try:
        if not api_key:
            raise ValueError("No API Key provided! Please check Settings.")
            
        print(f"[Eval] Starting Run {run_id}")
        
        dataset = db.query(Dataset).filter(Dataset.id == run.dataset_id).first()
        items = dataset.get_items()
        
        run.total_items = len(items)
        db.commit()

        completed_count = 0
        total_faithfulness = 0.0
        total_relevance = 0.0
        total_coherence = 0.0

        target_base_url = base_url if base_url else "https://api.siliconflow.cn/v1"

        for item_data in items:
            query = item_data.get("query", "")
            context = item_data.get("context", "")
            user_content = f"Query: {query}\nContext: {context}"
            
            try:
                # CRITICAL: Force 'openai' provider here too
                response = completion(
                    model=run.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    api_key=api_key,
                    base_url=target_base_url,
                    custom_llm_provider="openai"
                )
                
                content = response.choices[0].message.content
                scores = _parse_scores(content)

                eval_item = EvaluationItem(
                    run_id=run.id,
                    query=query,
                    context=context,
                    # Ensure response is stored as string
                    response=content if isinstance(content, str) else json.dumps(content),
                    ground_truth=item_data.get("ground_truth", ""),
                    scores=scores,
                    usage=dict(response.usage) if hasattr(response, 'usage') else {}
                )
                db.add(eval_item)
                
                total_faithfulness += scores.get('faithfulness', 0)
                total_relevance += scores.get('relevance', 0)
                total_coherence += scores.get('coherence', 0)
                completed_count += 1
                
                run.completed_items = completed_count
                db.commit()

            except Exception as e:
                print(f"❌ LLM Call Failed for item: {e}")
                continue

        if completed_count > 0:
            run.average_scores = {
                "faithfulness": total_faithfulness / completed_count,
                "relevance": total_relevance / completed_count,
                "coherence": total_coherence / completed_count
            }
        
        run.status = "completed"
        db.commit()

    except Exception as e:
        print(f"🔥 Run Crashed: {e}")
        db.rollback() 
        run.status = "failed"
        db.commit()
