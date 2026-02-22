"""
Eval Studio — Playground API endpoint (single-shot evaluation).
"""

from fastapi import APIRouter, Header
from typing import Optional

from app.schemas.schemas import PlaygroundRequest, PlaygroundResponse
from app.services.judge import evaluate_single

router = APIRouter(prefix="/playground", tags=["playground"])


@router.post("/evaluate", response_model=PlaygroundResponse)
async def playground_evaluate(
    payload: PlaygroundRequest,
    x_llm_key: Optional[str] = Header(default=None),
    x_llm_model: Optional[str] = Header(default=None),
    x_llm_base_url: Optional[str] = Header(default=None),
):
    """
    Run a single evaluation — no DB storage.
    Used by the Playground page for interactive prompt debugging.
    """
    result = await evaluate_single(
        system_prompt=payload.system_prompt,
        query=payload.query,
        context=payload.context,
        response=payload.response,
        model=x_llm_model if x_llm_model else payload.model,
        metric=payload.metric,
        api_key=x_llm_key,
        base_url=x_llm_base_url,
    )

    return PlaygroundResponse(
        score=result.get("score", 0.0),
        reasoning=result.get("reasoning", ""),
        model=result.get("model", payload.model),
        latency_ms=result.get("latency_ms", 0.0),
        usage=result.get("usage", {}),
    )
