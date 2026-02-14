"""
Judge Engine — LLM evaluation service using litellm.
Handles prompt construction, LLM calls, and response parsing.

Supports two modes:
 1. Real LLM — when valid API keys are set in .env
 2. Mock fallback — when no keys are configured (demo / development)
"""

import json
import os
import re
import time
import random
from typing import Optional

import litellm

from app.core.config import settings

# Suppress litellm debug noise
litellm.set_verbose = False

# Default system prompt if none provided
DEFAULT_SYSTEM_PROMPT = """你是一个公正的 AI 裁判。请通过以下步骤进行评分：

1. 提取 {{context}} 中的核心事实。
2. 对比 {{response}} 中的声明与 {{context}} 的事实。
3. 如果发现矛盾，标记为"幻觉"。
4. 根据 {{metric}} 的评分标准给出分数。
5. 最后输出 JSON 格式的评分和理由。

评分标准：
- Faithfulness (0-1): 1 = 完全忠实于 Context，0 = 完全编造
- Relevance (0-1): 1 = 完美回答 Query，0 = 完全无关
- Coherence (1-5): 5 = 逻辑清晰流畅，1 = 完全混乱

请以如下 JSON 格式输出：
{
  "score": <number>,
  "reasoning": "<string>"
}"""


def _has_api_keys() -> bool:
    """Check if at least one LLM API key is configured."""
    openai_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY", "")
    anthropic_key = settings.anthropic_api_key or os.getenv("ANTHROPIC_API_KEY", "")
    # Keys must be real, not the placeholder defaults
    has_openai = openai_key and not openai_key.startswith("sk-your-")
    has_anthropic = anthropic_key and not anthropic_key.startswith("sk-ant-your-")
    return has_openai or has_anthropic


def build_prompt(
    system_prompt: str,
    query: str,
    context: str,
    response: str,
    metric: str,
) -> list[dict]:
    """
    Replace {{variable}} placeholders in system prompt
    and build the message list for the LLM call.
    """
    filled = system_prompt
    filled = filled.replace("{{context}}", context)
    filled = filled.replace("{{response}}", response)
    filled = filled.replace("{{query}}", query)
    filled = filled.replace("{{metric}}", metric)

    user_message = f"""请评估以下内容的 {metric} 指标：

Query: {query}

Context: {context}

Response: {response}

请按照系统提示中的格式输出 JSON 结果。"""

    return [
        {"role": "system", "content": filled},
        {"role": "user", "content": user_message},
    ]


def parse_llm_output(raw_text: str) -> dict:
    """
    Parse the LLM output to extract score and reasoning.
    Handles both clean JSON and markdown-wrapped JSON.
    """
    # Try to find JSON block in markdown code fences
    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    if json_match:
        raw_text = json_match.group(1)

    # Try to find raw JSON object
    json_match = re.search(r"\{[^{}]*\"score\"[^{}]*\}", raw_text, re.DOTALL)
    if json_match:
        raw_text = json_match.group(0)

    try:
        result = json.loads(raw_text)
        score = float(result.get("score", 0))
        reasoning = str(result.get("reasoning", "No reasoning provided."))
        return {"score": score, "reasoning": reasoning}
    except (json.JSONDecodeError, ValueError, TypeError):
        return {"score": 0.0, "reasoning": f"Failed to parse LLM output: {raw_text[:200]}"}


async def evaluate_single(
    query: str,
    context: str,
    response: str,
    model: str = "gpt-4",
    metric: str = "faithfulness",
    system_prompt: Optional[str] = None,
    api_key: Optional[str] = None,
    api_base: Optional[str] = None,
) -> dict:
    """
    Evaluate a single item using litellm.
    Falls back to mock evaluation when no API keys are configured.
    Returns: {score, reasoning, model, latency_ms, usage}
    """
    # If no API keys configured (env or BYOK), use mock mode
    if not (api_key or _has_api_keys()):
        return _mock_evaluate(query, context, response, metric)

    try:
        prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
        messages = build_prompt(prompt, query, context, response, metric)

        start_time = time.time()

        # Configure litellm call
        kwargs = {
            "model": model,
            "messages": messages,
            "temperature": 0.0,
            "max_tokens": 500,
            "response_format": {"type": "json_object"},
        }

        # BYOK Logic
        if api_key:
            kwargs["api_key"] = api_key
            if api_base:
                kwargs["base_url"] = api_base
            
            # If using custom base_url with OpenAI-compatible endpoint, usually "openai/" prefix helps litellm
            # handle it correctly if logic assumes openai format.
            # But let's trust the user's provider selection or raw input for now.
            if api_base and not model.startswith("openai/") and "openai" in api_base:
                 kwargs["model"] = f"openai/{model}"

        llm_response = await litellm.acompletion(**kwargs)

        latency_ms = int((time.time() - start_time) * 1000)

        raw_content = llm_response.choices[0].message.content or ""
        parsed = parse_llm_output(raw_content)

        usage_data = {
            "prompt_tokens": getattr(llm_response.usage, "prompt_tokens", 0),
            "completion_tokens": getattr(llm_response.usage, "completion_tokens", 0),
        }

        return {
            "score": parsed["score"],
            "reasoning": parsed["reasoning"],
            "model": model,
            "latency_ms": latency_ms,
            "usage": usage_data,
        }

    except Exception as e:
        # LLM call failed — return error with details
        return {
            "score": 0.0,
            "reasoning": f"LLM call failed: {str(e)}",
            "model": model,
            "latency_ms": 0,
            "usage": {"prompt_tokens": 0, "completion_tokens": 0},
        }


def _mock_evaluate(query: str, context: str, response: str, metric: str) -> dict:
    """
    Deterministic-ish mock evaluation for demo mode.
    Produces realistic scores based on simple text overlap heuristics.
    """
    import time as _time

    start = _time.time()

    # Simple heuristic: check word overlap between context and response
    context_words = set(context.lower().split())
    response_words = set(response.lower().split())

    if context_words:
        overlap_ratio = len(context_words & response_words) / len(context_words)
    else:
        overlap_ratio = 0.5

    # Add some noise
    noise = random.uniform(-0.15, 0.15)

    if metric == "faithfulness":
        base_score = min(1.0, max(0.0, overlap_ratio + noise))
    elif metric == "relevance":
        query_words = set(query.lower().split())
        if query_words:
            q_overlap = len(query_words & response_words) / len(query_words)
        else:
            q_overlap = 0.5
        base_score = min(1.0, max(0.0, q_overlap + noise))
    elif metric == "coherence":
        # Coherence is 1-5 scale
        base_score = min(5.0, max(1.0, 3.0 + overlap_ratio * 2 + noise))
    else:
        base_score = round(random.uniform(0.3, 1.0), 2)

    score = round(base_score, 2)

    # Generate tier-based reasoning
    if metric == "coherence":
        tier = "high" if score >= 4 else "mid" if score >= 2.5 else "low"
    else:
        tier = "high" if score >= 0.8 else "mid" if score >= 0.5 else "low"

    reasonings = {
        "high": f"The response demonstrates strong {metric}. Key claims are well-supported by the provided context with minimal deviation.",
        "mid": f"The response shows moderate {metric}. Some claims are supported but several details lack grounding in the source context.",
        "low": f"The response scores low on {metric}. Multiple claims diverge significantly from or contradict the provided context.",
    }

    latency = int((_time.time() - start) * 1000) + random.randint(150, 600)

    return {
        "score": score,
        "reasoning": f"[Mock] {reasonings[tier]}",
        "model": "mock-judge",
        "latency_ms": latency,
        "usage": {
            "prompt_tokens": random.randint(300, 600),
            "completion_tokens": random.randint(50, 150),
        },
    }


async def evaluate_batch(
    items: list[dict],
    model: str,
    metrics: list[str],
    system_prompt: Optional[str] = None,
    on_progress: Optional[callable] = None,
) -> list[dict]:
    """
    Evaluate a batch of items sequentially.
    Calls on_progress(completed_count, total, current_result) after each item.
    """
    results = []
    total = len(items)

    for i, item in enumerate(items):
        item_scores = {}
        item_reasoning_parts = []
        total_usage = {"prompt_tokens": 0, "completion_tokens": 0}

        for metric in metrics:
            result = await evaluate_single(
                query=item.get("query", ""),
                context=item.get("context", ""),
                response=item.get("response", ""),
                model=model,
                metric=metric,
                system_prompt=system_prompt,
            )
            item_scores[metric] = result["score"]
            item_reasoning_parts.append(f"[{metric}] {result['reasoning']}")
            total_usage["prompt_tokens"] += result["usage"]["prompt_tokens"]
            total_usage["completion_tokens"] += result["usage"]["completion_tokens"]

        combined = {
            "query": item.get("query", ""),
            "context": item.get("context", ""),
            "response": item.get("response", ""),
            "ground_truth": item.get("ground_truth", ""),
            "scores": item_scores,
            "reasoning": "\n\n".join(item_reasoning_parts),
            "usage": total_usage,
        }

        # Determine failure type based on scores
        low_threshold = settings.low_score_threshold
        if item_scores.get("faithfulness", 1) < low_threshold:
            combined["failure_type"] = "Reasoning_Error"
        elif item_scores.get("relevance", 1) < low_threshold:
            combined["failure_type"] = "Retrieval_Failure"

        results.append(combined)

        if on_progress:
            on_progress(i + 1, total, combined)

    return results
