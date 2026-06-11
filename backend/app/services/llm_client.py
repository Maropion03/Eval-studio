"""Single async LLM client over LiteLLM.

Resolves API key with priority:
    1. Session-supplied BYOK key (from sessions.api_keys JSON)
    2. Server-owned env key (SILICONFLOW_API_KEY etc.) — fallback for dev / showcase

Model id convention follows LiteLLM's prefixing:
    siliconflow/<model>     → SiliconFlow OpenAI-compatible
    deepseek/<model>        → DeepSeek native
    openai/<model>          → OpenAI
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import litellm
from litellm import acompletion
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import get_settings

settings = get_settings()
litellm.drop_params = True  # silently drop unsupported params per provider


# ──────────────────────────────────────────────────────────────────
#  Per-1k pricing table (approximate, in CNY) — used for cost estimate.
#  Real cost will be back-filled from usage tokens after completion.
# ──────────────────────────────────────────────────────────────────

PRICING_PER_1K: dict[str, float] = {
    # SiliconFlow
    "deepseek-ai/DeepSeek-V4-Pro":          1.20,
    "deepseek-ai/DeepSeek-V4-Flash":        0.30,
    "deepseek-ai/DeepSeek-V3.2":            1.00,
    "Pro/deepseek-ai/DeepSeek-V3.2":        1.20,
    "deepseek-ai/DeepSeek-V3":              1.00,
    "Pro/deepseek-ai/DeepSeek-V3":          1.20,
    "deepseek-ai/DeepSeek-R1":              2.20,
    "Qwen/Qwen2.5-72B-Instruct":            0.85,
    "Qwen/Qwen2.5-7B-Instruct":             0.05,
    # DeepSeek native
    "deepseek-chat":                        0.50,
    "deepseek-reasoner":                    2.00,
    # OpenAI
    "gpt-4o":                               5.00,
    "gpt-4o-mini":                          0.45,
}


def cost_for(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Naive average pricing — same rate input/output. Good enough for dev demo."""
    rate = PRICING_PER_1K.get(model, 1.0)
    return (prompt_tokens + completion_tokens) / 1000 * rate


# ──────────────────────────────────────────────────────────────────


@dataclass
class CompletionResult:
    content: str
    prompt_tokens: int
    completion_tokens: int
    latency_ms: int
    model: str
    cost: float
    raw: dict[str, Any]


def resolve_provider_and_key(
    model: str,
    byok_keys: dict[str, Any] | None,
) -> tuple[str, str, str | None]:
    """Return (provider_prefix, api_key, api_base).

    `model` may already be prefixed (e.g. "siliconflow/deepseek-ai/DeepSeek-V4-Pro")
    or bare (e.g. "deepseek-ai/DeepSeek-V4-Pro" — assumed SiliconFlow if it contains '/').
    """

    byok_keys = byok_keys or {}

    # Heuristic provider detection
    lower = model.lower()
    if model.startswith("siliconflow/") or "deepseek-ai/" in model or model.startswith("Pro/deepseek-ai/") or model.startswith("Qwen/"):
        provider = "siliconflow"
        key = byok_keys.get("siliconflow") or settings.siliconflow_api_key
        base = settings.siliconflow_base_url
    elif model.startswith("deepseek/") or lower in {"deepseek-chat", "deepseek-reasoner"}:
        provider = "deepseek"
        key = byok_keys.get("deepseek") or settings.deepseek_api_key
        base = settings.deepseek_base_url
    elif model.startswith("openai/") or lower.startswith("gpt-"):
        provider = "openai"
        key = byok_keys.get("openai") or settings.openai_api_key
        base = None
    else:
        # default: assume SiliconFlow
        provider = "siliconflow"
        key = byok_keys.get("siliconflow") or settings.siliconflow_api_key
        base = settings.siliconflow_base_url

    if not key:
        raise RuntimeError(
            f"No API key available for model '{model}' (provider '{provider}'). "
            f"Configure server env or BYOK in Settings."
        )

    return provider, key, base


def normalize_model_for_litellm(model: str) -> str:
    """LiteLLM uses 'openai/<id>' to address any OpenAI-compatible endpoint.
    For SiliconFlow we route via openai/<model_id> + custom api_base.
    """
    if model.startswith("openai/"):
        return model
    if model.startswith("deepseek/"):
        return model
    # SiliconFlow / others → expose as openai/<...>
    return f"openai/{model}"


# ──────────────────────────────────────────────────────────────────


async def chat(
    model: str,
    messages: list[dict[str, str]],
    *,
    byok_keys: dict[str, Any] | None = None,
    temperature: float = 0.2,
    max_tokens: int | None = 1024,
    extra_params: dict[str, Any] | None = None,
) -> CompletionResult:
    """Single async chat completion via LiteLLM with retry + cost calc."""

    provider, key, base = resolve_provider_and_key(model, byok_keys)
    routed_model = normalize_model_for_litellm(model)

    params: dict[str, Any] = {
        "model": routed_model,
        "messages": messages,
        "api_key": key,
        "temperature": temperature,
    }
    if base:
        params["api_base"] = base
    if max_tokens is not None:
        params["max_tokens"] = max_tokens
    if extra_params:
        params.update(extra_params)

    start = time.perf_counter()

    async for attempt in AsyncRetrying(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.6, min=0.4, max=4.0),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    ):
        with attempt:
            response = await acompletion(**params)
    latency_ms = int((time.perf_counter() - start) * 1000)

    # LiteLLM returns OpenAI-shaped object
    choice = response["choices"][0]
    content = choice["message"]["content"] or ""

    usage = response.get("usage") or {}
    pt = int(usage.get("prompt_tokens", 0))
    ct = int(usage.get("completion_tokens", 0))

    return CompletionResult(
        content=content,
        prompt_tokens=pt,
        completion_tokens=ct,
        latency_ms=latency_ms,
        model=model,
        cost=cost_for(model, pt, ct),
        raw=dict(response) if not isinstance(response, dict) else response,
    )


# Convenience for the two fixed roles
async def call_judge(messages: list[dict[str, str]], byok_keys: dict[str, Any] | None = None) -> CompletionResult:
    return await chat(settings.judge_model, messages, byok_keys=byok_keys, temperature=0.0, max_tokens=1024)


async def call_writer(messages: list[dict[str, str]], byok_keys: dict[str, Any] | None = None) -> CompletionResult:
    return await chat(settings.writer_model, messages, byok_keys=byok_keys, temperature=0.4, max_tokens=2048)


__all__ = [
    "CompletionResult",
    "chat",
    "call_judge",
    "call_writer",
    "cost_for",
    "PRICING_PER_1K",
]
