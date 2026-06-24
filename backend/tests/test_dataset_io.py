"""Unit tests for app.services.dataset_io.parse_dataset."""

from __future__ import annotations

import json

import pytest

from app.services.dataset_io import MAX_CASES, DatasetParseError, parse_dataset


def _b(obj) -> bytes:
    if isinstance(obj, (dict, list)):
        return json.dumps(obj, ensure_ascii=False).encode("utf-8")
    return obj.encode("utf-8")


# ── valid inputs ──────────────────────────────────────────────────


def test_valid_native_json_object():
    payload = {
        "scenario": "financial_qa",
        "cases": [
            {
                "case_id": "c1",
                "input": {"question": "Q?", "context": "ctx"},
                "reference": {"must_contain_facts": ["a", "b"]},
                "difficulty": "hard",
                "risk_tier": "L2",
            }
        ],
    }
    scenario, cases = parse_dataset("d.json", _b(payload))
    assert scenario == "financial_qa"
    assert len(cases) == 1
    c = cases[0]
    assert c["case_code"] == "c1"
    assert c["input"]["question"] == "Q?"
    assert c["difficulty"] == "hard"
    assert c["risk_tier"] == "L2"
    assert c["reference"]["must_contain_facts"] == ["a", "b"]


def test_valid_bare_json_array():
    payload = [
        {"input": {"question": "Q1"}, "reference": {"golden_answer": "A1"}},
        {"input": {"question": "Q2"}, "reference": {"golden_answer": "A2"}},
    ]
    scenario, cases = parse_dataset("arr.json", _b(payload))
    assert len(cases) == 2
    # Default scenario when none provided → custom inference.
    assert scenario == "custom"


def test_valid_csv_semicolon_facts():
    csv_text = (
        "question,must_contain_facts,risk_tier,difficulty\n"
        "What is revenue?,fact one;fact two;fact three,L1,easy\n"
    )
    scenario, cases = parse_dataset("d.csv", csv_text.encode("utf-8"))
    assert len(cases) == 1
    assert cases[0]["reference"]["must_contain_facts"] == [
        "fact one",
        "fact two",
        "fact three",
    ]
    assert cases[0]["difficulty"] == "easy"
    assert cases[0]["risk_tier"] == "L1"


# ── validation errors ─────────────────────────────────────────────


def test_missing_question_raises():
    payload = {"cases": [{"input": {"context": "x"}, "reference": {"golden_answer": "A"}}]}
    with pytest.raises(DatasetParseError) as ei:
        parse_dataset("d.json", _b(payload))
    assert any("input.question" in e for e in ei.value.errors)


def test_reference_with_no_fields_raises():
    payload = {"cases": [{"input": {"question": "Q"}, "reference": {}}]}
    with pytest.raises(DatasetParseError) as ei:
        parse_dataset("d.json", _b(payload))
    assert any("reference needs at least one" in e for e in ei.value.errors)


def test_invalid_difficulty_raises():
    payload = {
        "cases": [
            {
                "input": {"question": "Q"},
                "reference": {"golden_answer": "A"},
                "difficulty": "trivial",
            }
        ]
    }
    with pytest.raises(DatasetParseError) as ei:
        parse_dataset("d.json", _b(payload))
    assert any("invalid difficulty" in e for e in ei.value.errors)


def test_invalid_risk_tier_raises():
    payload = {
        "cases": [
            {
                "input": {"question": "Q"},
                "reference": {"golden_answer": "A"},
                "risk_tier": "L9",
            }
        ]
    }
    with pytest.raises(DatasetParseError) as ei:
        parse_dataset("d.json", _b(payload))
    assert any("invalid risk_tier" in e for e in ei.value.errors)


def test_too_many_cases_raises():
    cases = [
        {"input": {"question": f"Q{i}"}, "reference": {"golden_answer": "A"}}
        for i in range(MAX_CASES + 1)
    ]
    payload = {"cases": cases}
    with pytest.raises(DatasetParseError) as ei:
        parse_dataset("d.json", _b(payload))
    assert any("too many cases" in e for e in ei.value.errors)


def test_invalid_json_raises():
    with pytest.raises(DatasetParseError) as ei:
        parse_dataset("d.json", b"{not valid json")
    assert any("invalid JSON" in e for e in ei.value.errors)


def test_empty_file_raises():
    with pytest.raises(DatasetParseError) as ei:
        parse_dataset("d.json", _b({"cases": []}))
    assert any("no cases" in e for e in ei.value.errors)


def test_non_object_case_raises():
    payload = ["just a string", {"input": {"question": "Q"}, "reference": {"golden_answer": "A"}}]
    with pytest.raises(DatasetParseError) as ei:
        parse_dataset("d.json", _b(payload))
    assert any("not an object" in e for e in ei.value.errors)


def test_json_scalar_raises():
    with pytest.raises(DatasetParseError) as ei:
        parse_dataset("d.json", b"42")
    assert any("array of cases" in e or "no cases" in e for e in ei.value.errors)


# ── scenario inference ────────────────────────────────────────────


def test_scenario_inference_all_same():
    payload = {
        "cases": [
            {
                "input": {"question": "Q1"},
                "reference": {"golden_answer": "A"},
                "scenario": "compliance_audit",
            },
            {
                "input": {"question": "Q2"},
                "reference": {"golden_answer": "A"},
                "scenario": "compliance_audit",
            },
        ]
    }
    scenario, cases = parse_dataset("d.json", _b(payload))
    assert scenario == "compliance_audit"


def test_scenario_inference_mixed_is_custom():
    payload = {
        "cases": [
            {
                "input": {"question": "Q1"},
                "reference": {"golden_answer": "A"},
                "scenario": "financial_qa",
            },
            {
                "input": {"question": "Q2"},
                "reference": {"golden_answer": "A"},
                "scenario": "fraud_detection",
            },
        ]
    }
    scenario, cases = parse_dataset("d.json", _b(payload))
    assert scenario == "custom"


def test_unknown_scenario_coerced_to_custom():
    payload = {
        "cases": [
            {
                "input": {"question": "Q1"},
                "reference": {"golden_answer": "A"},
                "scenario": "made_up_scenario",
            }
        ]
    }
    scenario, cases = parse_dataset("d.json", _b(payload))
    assert cases[0]["scenario"] == "custom"
    assert scenario == "custom"
