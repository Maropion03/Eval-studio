from litellm import completion
from sqlalchemy.orm import Session
from app.models.models import EvaluationRun, EvaluationItem, Dataset
import json
import logging
from typing import Optional

# Keep helpers like _calculate_score if they exist, but here we replace the file content.
# The user's provided code replaces the core logic. 
# I will include necessary imports and the full function as requested.

def run_evaluation_background(
    db: Session, 
    run_id: str, 
    system_prompt: str, 
    api_key: Optional[str] = None, 
    base_url: Optional[str] = None
):
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
    if not run:
        return

    try:
        # 1. Validate Credentials
        if not api_key:
            raise ValueError("❌ No API Key provided! Please check Settings.")
            
        # Mask API Key for logging
        masked_key = f"{api_key[:8]}..." if api_key and len(api_key) > 8 else "N/A"
        print(f"[Eval] Starting Run {run_id}")
        print(f"[Eval] Provider Config - BaseURL: {base_url}, Key: {masked_key}")

        dataset = db.query(Dataset).filter(Dataset.id == run.dataset_id).first()
        if not dataset:
             raise ValueError(f"Dataset {run.dataset_id} not found")
             
        items = dataset.get_items()
        
        run.total_items = len(items)
        db.commit()

        completed_count = 0
        total_faithfulness = 0.0
        total_relevance = 0.0
        total_coherence = 0.0

        # Default fallback for SiliconFlow
        target_base_url = base_url if base_url else "https://api.siliconflow.cn/v1"

        for item_data in items:
            query = item_data.get("query", "")
            context = item_data.get("context", "")
            user_content = f"Query: {query}\nContext: {context}"
            
            try:
                # 2. Real LLM Call (No Mock Fallback)
                response = completion(
                    model=run.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    api_key=api_key,
                    base_url=target_base_url,
                    custom_llm_provider="openai" # Force OpenAI protocol as requested
                )
                
                content = response.choices[0].message.content
                
                # 3. Score Parsing
                scores = {"faithfulness": 0.0, "relevance": 0.0, "coherence": 0.0}
                try:
                    # Naive JSON parser
                    clean_content = content.replace("```json", "").replace("```", "").strip()
                    parsed = json.loads(clean_content)
                    scores = parsed
                except:
                    print(f"[Eval] JSON Parse Failed for item. Content: {content[:50]}...")

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
                
                total_faithfulness += float(scores.get('faithfulness', 0))
                total_relevance += float(scores.get('relevance', 0))
                total_coherence += float(scores.get('coherence', 0))
                completed_count += 1
                
                run.completed_items = completed_count
                db.commit()

            except Exception as e:
                print(f"❌ LLM Call Failed: {e}")
                # Don't mock, just skip this item or fail hard depending on preference.
                # Here we skip to avoid crashing the whole run, but we log it visibly.
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
        db.rollback() # <--- CRITICAL FIX: Clean the dirty session
        run.status = "failed"
        db.commit()
