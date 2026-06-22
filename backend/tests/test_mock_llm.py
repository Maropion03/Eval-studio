"""Unit tests for app.services.mock_llm — deterministic offline LLM stand-in."""

from __future__ import annotations

import json

from app.services.judge_engine import JUDGE_SYSTEM, _build_judge_prompt
from app.services.mock_llm import mock_completion

CANDIDATE_SYS = (
    "You are answering an analyst's question grounded in the provided document."
)
JUDGE_SYS = JUDGE_SYSTEM  # contains "evaluation judge"
WRITER_SYS = (
    "You are a senior management consultant writing a Decision Book for an AI "
    "product team."
)

REFERENCE = {
    "must_contain_facts": [
        "营业收入 45.67 亿元",
        "营业成本 28.34 亿元",
        "毛利率 37.9%",
        "净利润 6.78 亿元",
        "现金流 5.43 亿元",
    ],
    "must_cite_sources": [],
    "forbidden_claims": ["投资建议"],
    "golden_answer": "公司毛利率为37.9%。",
    "scoring_rubric": "需包含毛利率。",
}

CANDIDATE_USER = (
    "DOCUMENT:\n公司2023年实现营业收入 45.67 亿元，营业成本 28.34 亿元。\n\n"
    "QUESTION: 营业收入是多少？"
)


def _candidate(model: str, user: str = CANDIDATE_USER):
    return mock_completion(
        model,
        [{"role": "system", "content": CANDIDATE_SYS}, {"role": "user", "content": user}],
        REFERENCE,
    )


def _coverage(answer: str) -> int:
    """How many required facts appear in the answer."""
    return sum(1 for f in REFERENCE["must_contain_facts"] if f in answer)


# ── role routing ──────────────────────────────────────────────────


def test_routes_to_candidate_by_default():
    out = _candidate("Qwen/Qwen2.5-72B-Instruct")
    assert out.startswith("根据文档")


def test_routes_to_judge_by_system_prompt():
    prompt = _build_judge_prompt(
        question="Q",
        context="ctx",
        reference=REFERENCE,
        output="根据文档，完整回答如下：营业收入 45.67 亿元。",
        rule_summary={"forbidden_hit": False, "citation_recall": 1.0, "fact_match_rule": 1.0},
    )
    out = mock_completion(
        "deepseek-ai/DeepSeek-V4-Pro",
        [{"role": "system", "content": JUDGE_SYS}, {"role": "user", "content": prompt}],
    )
    parsed = json.loads(out)
    assert parsed["severity"] in {"L0", "L1", "L2", "L3"}
    assert "scores" in parsed


def test_routes_to_writer_by_system_prompt():
    user = (
        "## CANDIDATE SCOREBOARD\n"
        "- DeepSeek-V4-Pro: trials=10 pass_rate=90.00% L1=1 L2=0 L3=0 "
        "avg_latency=200ms cost/trial=¥0.0100 ★PARETO\n\n"
        "Pareto recommendation: DeepSeek-V4-Pro\n"
    )
    out = mock_completion(
        "deepseek-ai/DeepSeek-V4-Pro",
        [{"role": "system", "content": WRITER_SYS}, {"role": "user", "content": user}],
    )
    book = json.loads(out)
    for key in ("recommendation", "tradeoff_paragraph", "annual_spend_table", "narratives", "risks"):
        assert key in book
    assert book["recommendation"]["model"] == "DeepSeek-V4-Pro"
    for who in ("boss", "compliance", "engineering"):
        assert "title" in book["narratives"][who]
        assert "body" in book["narratives"][who]


# ── determinism ───────────────────────────────────────────────────


def test_candidate_deterministic():
    a = _candidate("deepseek-ai/DeepSeek-V4-Pro")
    b = _candidate("deepseek-ai/DeepSeek-V4-Pro")
    assert a == b


def test_judge_deterministic():
    prompt = _build_judge_prompt(
        question="Q",
        context="ctx",
        reference=REFERENCE,
        output="x",
        rule_summary={"forbidden_hit": False, "citation_recall": 1.0, "fact_match_rule": 0.5},
    )
    msgs = [{"role": "system", "content": JUDGE_SYS}, {"role": "user", "content": prompt}]
    assert mock_completion("m", msgs) == mock_completion("m", msgs)


# ── candidate quality scaling ─────────────────────────────────────


def test_quality_scaling_strong_vs_weak_statistical():
    """A high-quality model should, on average across many cases, cover more
    required facts than a weak one given the same reference."""
    strong = "deepseek-ai/DeepSeek-V4-Pro"
    weak = "Qwen/Qwen2.5-7B-Instruct"

    strong_total = 0
    weak_total = 0
    n = 80
    for i in range(n):
        user = CANDIDATE_USER + f" [case {i}]"
        strong_total += _coverage(_candidate(strong, user))
        weak_total += _coverage(_candidate(weak, user))

    # Strong model is wired to q=0.93, weak to q=0.60 → strong covers strictly
    # more facts in aggregate.
    assert strong_total > weak_total


def test_quality_scaling_is_deterministic_per_case():
    strong = "deepseek-ai/DeepSeek-V4-Pro"
    user = CANDIDATE_USER + " [case 7]"
    assert _candidate(strong, user) == _candidate(strong, user)


# ── judge severity mapping ────────────────────────────────────────


def _judge_with(rule_summary: dict, output: str = "answer", reference: dict | None = None):
    prompt = _build_judge_prompt(
        question="Q",
        context="ctx",
        reference=reference or REFERENCE,
        output=output,
        rule_summary=rule_summary,
    )
    out = mock_completion(
        "deepseek-ai/DeepSeek-V4-Pro",
        [{"role": "system", "content": JUDGE_SYS}, {"role": "user", "content": prompt}],
    )
    return json.loads(out)


def test_judge_forbidden_hit_is_L3():
    parsed = _judge_with({"forbidden_hit": True, "citation_recall": 1.0, "fact_match_rule": 1.0})
    assert parsed["severity"] == "L3"
    assert parsed["scores"]["forbidden_hit"] is True


def test_judge_low_citation_recall_with_sources_is_L2():
    ref = dict(REFERENCE, must_cite_sources=["《证券法》第八十条"])
    parsed = _judge_with(
        {"forbidden_hit": False, "citation_recall": 0.2, "fact_match_rule": 1.0},
        reference=ref,
    )
    assert parsed["severity"] == "L2"


def test_judge_high_fact_match_is_L0():
    parsed = _judge_with({"forbidden_hit": False, "citation_recall": 1.0, "fact_match_rule": 1.0})
    assert parsed["severity"] == "L0"


def test_judge_mid_fact_match_is_L1():
    parsed = _judge_with({"forbidden_hit": False, "citation_recall": 1.0, "fact_match_rule": 0.7})
    assert parsed["severity"] == "L1"


def test_judge_low_fact_match_is_L2():
    parsed = _judge_with({"forbidden_hit": False, "citation_recall": 1.0, "fact_match_rule": 0.3})
    assert parsed["severity"] == "L2"


def test_judge_scores_keys_present():
    parsed = _judge_with({"forbidden_hit": False, "citation_recall": 0.9, "fact_match_rule": 0.95})
    for k in ("fact_accuracy", "hallucination_severity", "citation_recall", "forbidden_hit"):
        assert k in parsed["scores"]
