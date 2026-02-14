"""
Playground API endpoint — single-shot evaluation.
"""

from fastapi import APIRouter, Header

from app.schemas.schemas import PlaygroundRequest, PlaygroundResponse
from app.services.judge import evaluate_single

router = APIRouter(prefix="/playground", tags=["playground"])


@router.post("/evaluate", response_model=PlaygroundResponse)
async def playground_evaluate(
    payload: PlaygroundRequest,
    x_llm_key: str | None = Header(default=None),
    x_llm_model: str | None = Header(default=None),
    x_llm_base_url: str | None = Header(default=None),
):
    """
    Run a single evaluation — no DB storage.
    Used by the Playground page for interactive prompt debugging.
    """
    result = await evaluate_single(
        query=payload.query,
        context=payload.context,
        response=payload.response,
        model=x_llm_model if x_llm_model else payload.model,
        metric=payload.metric,
        system_prompt=payload.system_prompt,
        api_key=x_llm_key,
        api_base=x_llm_base_url,
    )

    return PlaygroundResponse(
        score=result["score"],
        reasoning=result["reasoning"],
        model=result["model"],
        latency_ms=result["latency_ms"],
        usage={
            "prompt_tokens": result["usage"]["prompt_tokens"],
            "completion_tokens": result["usage"]["completion_tokens"],
        },
    )
