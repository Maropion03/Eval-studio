"""Tests for app.services.judge_engine — pure rule functions + judge_trial (MOCK)."""

from __future__ import annotations

import pytest

from app.services.judge_engine import (
    _bump,
    _citation_recall,
    _fact_match_rule,
    _forbidden_hit,
    judge_trial,
)


# ── _forbidden_hit ────────────────────────────────────────────────


def test_forbidden_hit_detects_phrase():
    hit, hits = _forbidden_hit("这是投资建议，请买入。", ["投资建议", "保证收益"])
    assert hit is True
    assert hits == ["投资建议"]


def test_forbidden_hit_none():
    hit, hits = _forbidden_hit("纯事实陈述。", ["投资建议"])
    assert hit is False
    assert hits == []


def test_forbidden_hit_empty_list():
    hit, hits = _forbidden_hit("anything", [])
    assert hit is False
    assert hits == []


# ── _citation_recall ──────────────────────────────────────────────


def test_citation_recall_no_required_is_full():
    recall, matched = _citation_recall("output", [])
    assert recall == 1.0
    assert matched == []


def test_citation_recall_partial():
    recall, matched = _citation_recall(
        "依据《证券法》第八十条的规定。",
        ["《证券法》第八十条", "《公司法》第一条"],
    )
    assert recall == 0.5
    assert matched == ["《证券法》第八十条"]


def test_citation_recall_bracket_stripped_match():
    # Output has the bare form without book-title brackets.
    recall, matched = _citation_recall(
        "依据 证券法第八十条 的规定。",
        ["《证券法第八十条》"],
    )
    assert recall == 1.0


# ── _fact_match_rule ──────────────────────────────────────────────


def test_fact_match_rule_no_facts_is_full():
    score, matched, missed = _fact_match_rule("out", [])
    assert score == 1.0
    assert matched == []
    assert missed == []


def test_fact_match_rule_exact_substring():
    score, matched, missed = _fact_match_rule(
        "营业收入 45.67 亿元，营业成本 28.34 亿元。",
        ["营业收入 45.67 亿元", "营业成本 28.34 亿元"],
    )
    assert score == 1.0
    assert set(matched) == {"营业收入 45.67 亿元", "营业成本 28.34 亿元"}


def test_fact_match_rule_numeric_token_fallback():
    # Whole phrase not present, but the distinctive number is.
    score, matched, missed = _fact_match_rule(
        "营收为 45.67 哦",
        ["营业收入 45.67 亿元"],
    )
    assert score == 1.0
    assert matched == ["营业收入 45.67 亿元"]


def test_fact_match_rule_missed():
    score, matched, missed = _fact_match_rule(
        "完全无关的内容。",
        ["营业收入 45.67 亿元", "毛利率 37.9%"],
    )
    assert score == 0.0
    assert set(missed) == {"营业收入 45.67 亿元", "毛利率 37.9%"}


# ── _bump ─────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "sev,floor,expected",
    [
        ("L0", "L2", "L2"),
        ("L1", "L0", "L1"),
        ("L3", "L2", "L3"),
        ("L2", "L2", "L2"),
        ("L0", "L0", "L0"),
    ],
)
def test_bump(sev, floor, expected):
    assert _bump(sev, floor) == expected


# ── judge_trial (MOCK mode) ───────────────────────────────────────


async def test_judge_trial_clean_answer_is_low_severity():
    reference = {
        "must_contain_facts": ["营业收入 45.67 亿元"],
        "must_cite_sources": [],
        "forbidden_claims": ["投资建议"],
        "golden_answer": "营业收入45.67亿元。",
        "scoring_rubric": "",
    }
    res = await judge_trial(
        question="营业收入是多少？",
        context="公司2023年营业收入 45.67 亿元。",
        reference=reference,
        output="根据文档，完整回答如下：营业收入 45.67 亿元。",
        enabled_dims=["fact_accuracy", "hallucination_severity"],
    )
    assert res.severity in {"L0", "L1", "L2", "L3"}
    assert res.severity in {"L0", "L1"}  # all facts present, no forbidden
    for k in ("fact_accuracy", "citation_recall", "forbidden_hit"):
        assert k in res.scores
    assert res.error is None


async def test_judge_trial_forbidden_floor_is_L3():
    reference = {
        "must_contain_facts": ["营业收入 45.67 亿元"],
        "must_cite_sources": [],
        "forbidden_claims": ["投资建议"],
        "golden_answer": "",
        "scoring_rubric": "",
    }
    res = await judge_trial(
        question="Q",
        context="ctx",
        reference=reference,
        output="这是投资建议：请买入。",
        enabled_dims=["forbidden_hit"],
    )
    assert res.severity == "L3"
    assert res.scores["forbidden_hit"] is True


async def test_judge_trial_missing_citation_floor_is_at_least_L2():
    reference = {
        "must_contain_facts": [],
        "must_cite_sources": ["《证券法》第八十条", "《公司法》第一条"],
        "forbidden_claims": [],
        "golden_answer": "",
        "scoring_rubric": "",
    }
    res = await judge_trial(
        question="Q",
        context="ctx",
        reference=reference,
        output="一个完全没有引用任何来源的回答。",
        enabled_dims=["citation_recall"],
    )
    # citation_recall == 0 < 0.5 with sources present → floor L2.
    assert res.severity in {"L2", "L3"}
    assert res.scores["citation_recall"] == 0.0
