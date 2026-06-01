"""Judge engine (stub for Week 1 — full implementation in Week 2).

Will score a Trial across enabled judge dimensions:
    - fact_accuracy        : numeric/date/entity match against reference
    - hallucination_severity: L0-L3 tier via judge LLM + rules
    - citation_recall      : must_cite_sources coverage
    - forbidden_hit        : red-line phrase detection
    - pareto               : derived metric (computed run-level)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class JudgeResult:
    severity: str          # "L0".."L3"
    scores: dict[str, float]
    explanation: str
    error: str | None = None


async def judge_trial(
    *,
    output: str,
    reference: dict[str, Any],
    case_risk_tier: str,
    enabled_dims: list[str],
    byok_keys: dict[str, Any] | None = None,
) -> JudgeResult:
    """STUB — returns a deterministic placeholder result.
    Real implementation lands in Week 2."""
    # naive heuristic so the live page shows some variety during dev
    score = 0.92 if len(output) > 30 else 0.6
    sev = "L0" if score >= 0.85 else "L1" if score >= 0.7 else "L2"
    return JudgeResult(
        severity=sev,
        scores={d: score for d in enabled_dims},
        explanation="(stub) week 2 will implement judge LLM + rule engine",
    )
