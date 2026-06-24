"""Parse + validate uploaded dataset files (JSON / CSV) into normalized cases.

Mirrors docs/dataset-schema.json. Accepts the native seed shape
(``{"scenario": ..., "cases": [...]}`` or a bare array) and a flat CSV where
list-valued reference fields are separated by ``||``, ``;`` or newlines.
"""

from __future__ import annotations

import csv
import io
import json
from typing import Any

DIFFICULTIES = {"easy", "medium", "hard"}
RISK_TIERS = {"L0", "L1", "L2", "L3"}
SCENARIOS = {"financial_qa", "compliance_audit", "research_summary", "fraud_detection", "custom"}

MAX_CASES = 500


class DatasetParseError(Exception):
    """Raised with a list of human-readable validation errors."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors[:5]))


def _norm_list(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    s = str(v).strip()
    if not s:
        return []
    for sep in ("||", "\n", ";", "|"):
        if sep in s:
            return [p.strip() for p in s.split(sep) if p.strip()]
    return [s]


def _validate_case(raw: dict, idx: int, default_scenario: str) -> tuple[dict | None, list[str]]:
    errs: list[str] = []
    n = idx + 1

    inp = raw.get("input") if isinstance(raw.get("input"), dict) else {}
    question = inp.get("question") or raw.get("question")
    if not question or not str(question).strip():
        errs.append(f"case #{n}: missing input.question")
    context = inp.get("context") or raw.get("context") or ""
    extra = inp.get("extra") if isinstance(inp.get("extra"), dict) else None

    ref = raw.get("reference") if isinstance(raw.get("reference"), dict) else {}
    must_facts = _norm_list(ref.get("must_contain_facts") or raw.get("must_contain_facts"))
    must_src = _norm_list(ref.get("must_cite_sources") or raw.get("must_cite_sources"))
    forbidden = _norm_list(ref.get("forbidden_claims") or raw.get("forbidden_claims"))
    golden = str(ref.get("golden_answer") or raw.get("golden_answer") or "").strip()
    rubric = str(ref.get("scoring_rubric") or raw.get("scoring_rubric") or "").strip()
    if not (must_facts or must_src or forbidden or golden):
        errs.append(
            f"case #{n}: reference needs at least one of "
            "must_contain_facts / must_cite_sources / forbidden_claims / golden_answer"
        )

    difficulty = str(raw.get("difficulty") or "medium").lower()
    if difficulty not in DIFFICULTIES:
        errs.append(f"case #{n}: invalid difficulty '{difficulty}' (easy/medium/hard)")
    risk = str(raw.get("risk_tier") or "L1").upper()
    if risk not in RISK_TIERS:
        errs.append(f"case #{n}: invalid risk_tier '{risk}' (L0..L3)")

    scenario = str(raw.get("scenario") or default_scenario or "custom")
    if scenario not in SCENARIOS:
        scenario = "custom"
    case_code = str(raw.get("case_id") or raw.get("case_code") or f"case-{n:03d}").strip()

    if errs:
        return None, errs
    return {
        "case_code": case_code,
        "scenario": scenario,
        "difficulty": difficulty,
        "risk_tier": risk,
        "input": {"question": str(question).strip(), "context": str(context), "extra": extra},
        "reference": {
            "must_contain_facts": must_facts,
            "must_cite_sources": must_src,
            "forbidden_claims": forbidden,
            "golden_answer": golden,
            "scoring_rubric": rubric,
        },
        "metadata": raw.get("metadata") if isinstance(raw.get("metadata"), dict) else None,
    }, []


def parse_dataset(filename: str, content: bytes) -> tuple[str, list[dict]]:
    """Parse + validate. Returns (dataset_scenario, normalized_cases).

    Raises DatasetParseError(errors) if the file is malformed or any case fails.
    """
    text = content.decode("utf-8-sig", errors="replace")
    is_csv = (filename or "").lower().endswith(".csv")

    default_scenario = "custom"
    raw_cases: list[Any]
    if is_csv:
        try:
            reader = csv.DictReader(io.StringIO(text))
            fields = {(f or "").strip().lower() for f in (reader.fieldnames or [])}
            if not ({"question", "input.question", "input"} & fields):
                raise DatasetParseError(
                    ["CSV must have a 'question' column (header row missing or malformed)"]
                )
            raw_cases = [dict(r) for r in reader]
        except csv.Error as e:
            raise DatasetParseError([f"invalid CSV: {e}"]) from e
    else:
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise DatasetParseError([f"invalid JSON: {e}"]) from e
        if isinstance(data, dict):
            default_scenario = str(data.get("scenario") or "custom")
            raw_cases = data.get("cases") or []
        elif isinstance(data, list):
            raw_cases = data
        else:
            raise DatasetParseError(["JSON must be an array of cases or an object with a 'cases' array"])

    if not raw_cases:
        raise DatasetParseError(["no cases found in file"])
    if len(raw_cases) > MAX_CASES:
        raise DatasetParseError([f"too many cases ({len(raw_cases)}); max {MAX_CASES} per upload"])

    cases: list[dict] = []
    errors: list[str] = []
    for i, rc in enumerate(raw_cases):
        if not isinstance(rc, dict):
            errors.append(f"case #{i + 1}: not an object")
            continue
        case, errs = _validate_case(rc, i, default_scenario)
        if errs:
            errors.extend(errs)
        elif case is not None:
            cases.append(case)

    if errors:
        raise DatasetParseError(errors)

    seen: set[str] = set()
    dupes: list[str] = []
    for c in cases:
        code = c["case_code"]
        if code in seen:
            dupes.append(code)
        seen.add(code)
    if dupes:
        uniq = sorted(set(dupes))
        raise DatasetParseError([f"duplicate case_id/case_code: {', '.join(uniq[:10])}"])

    scenarios = {c["scenario"] for c in cases}
    scenario = scenarios.pop() if len(scenarios) == 1 else "custom"
    return scenario, cases
