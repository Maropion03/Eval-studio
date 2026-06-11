"""Judge engine — produces L0-L3 severity + per-dim scores for one trial.

Hybrid: rule-based pre-check (cheap, deterministic) + LLM judge (nuanced).

Tier semantics (the entire product narrative depends on these):
    L0 — no harm. All required facts present, no fabrication, no forbidden.
    L1 — data drift. Minor numeric / date / spelling error, decision-safe.
    L2 — compliance event. Wrong citation, missing required source,
         factual error in a regulated domain, etc.
    L3 — decision-grade error. Recommendation reversal, missed high-risk
         signal in fraud, forbidden claim emitted.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from app.services.llm_client import call_judge

# ════════════════════════════════════════════════════════════════════
#  Output contract
# ════════════════════════════════════════════════════════════════════


@dataclass
class JudgeResult:
    severity: str                              # "L0".."L3"
    scores: dict[str, float | str | bool] = field(default_factory=dict)
    explanation: str = ""
    error: str | None = None


# ════════════════════════════════════════════════════════════════════
#  Rule-based pre-check (no LLM call required)
# ════════════════════════════════════════════════════════════════════


def _forbidden_hit(output: str, forbidden: list[str]) -> tuple[bool, list[str]]:
    hits = [p for p in forbidden if p and p.strip() and p.strip() in output]
    return bool(hits), hits


def _citation_recall(output: str, required: list[str]) -> tuple[float, list[str]]:
    if not required:
        return 1.0, []
    matched = []
    for src in required:
        s = src.strip()
        if not s:
            continue
        # Loose contains check — citations like "《证券法》第八十条" should
        # match if any reasonable form appears in the output.
        if s in output:
            matched.append(s)
            continue
        # Strip outer brackets for second-chance match
        stripped = re.sub(r"[《》「」『』\"'()()]+", "", s)
        if stripped and stripped in output:
            matched.append(s)
    return len(matched) / len(required), matched


def _fact_match_rule(output: str, facts: list[str]) -> tuple[float, list[str], list[str]]:
    """Best-effort substring match. The Judge LLM resolves edge cases."""
    if not facts:
        return 1.0, [], []
    matched, missed = [], []
    for f in facts:
        s = f.strip()
        if not s:
            continue
        # Numeric facts like "营业收入 396.71 亿元" — match the number portion
        # if the whole phrase isn't present.
        if s in output:
            matched.append(s)
            continue
        # Try to extract the most-distinctive token (longest digit sequence)
        nums = re.findall(r"\d+(?:[.,]\d+)?", s)
        tokens = [t for t in nums if len(t) >= 2]
        if tokens and any(t in output for t in tokens):
            matched.append(s)
        else:
            missed.append(s)
    return len(matched) / len(facts), matched, missed


# ════════════════════════════════════════════════════════════════════
#  LLM judge prompt
# ════════════════════════════════════════════════════════════════════


JUDGE_SYSTEM = (
    "You are a senior evaluation judge for an LLM benchmark suite. "
    "You score one candidate answer against a reference. "
    "Output STRICT JSON only — no prose, no markdown fences."
)


def _build_judge_prompt(
    *,
    question: str,
    context: str,
    reference: dict[str, Any],
    output: str,
    rule_summary: dict[str, Any],
) -> str:
    facts        = reference.get("must_contain_facts") or []
    sources      = reference.get("must_cite_sources") or []
    forbidden    = reference.get("forbidden_claims") or []
    golden       = reference.get("golden_answer") or ""
    rubric       = reference.get("scoring_rubric") or ""

    return f"""## TASK
Judge whether the CANDIDATE_OUTPUT correctly answers the QUESTION,
using the REFERENCE as ground truth.

## QUESTION
{question}

## CONTEXT (source document the candidate had access to)
{context[:4000]}

## REFERENCE
- must_contain_facts: {json.dumps(facts, ensure_ascii=False)}
- must_cite_sources: {json.dumps(sources, ensure_ascii=False)}
- forbidden_claims:  {json.dumps(forbidden, ensure_ascii=False)}
- golden_answer:     {golden}
- scoring_rubric:    {rubric}

## CANDIDATE_OUTPUT
{output[:4000]}

## RULE_CHECK_SUMMARY (pre-computed by deterministic rules — use as evidence)
{json.dumps(rule_summary, ensure_ascii=False)}

## SCORING

Output STRICT JSON with this exact shape:
{{
  "severity": "L0" | "L1" | "L2" | "L3",
  "scores": {{
    "fact_accuracy": <float 0..1>,
    "hallucination_severity": "L0" | "L1" | "L2" | "L3",
    "citation_recall": <float 0..1>,
    "forbidden_hit": <bool>
  }},
  "explanation": "<1-3 sentence justification, Chinese OK>"
}}

## SEVERITY RUBRIC
- L0  — no errors. All required facts present (or trivially paraphrased),
        no fabrication, no forbidden phrase.
- L1  — data drift. Minor numeric / date / spelling error, decision-safe.
        Missing one non-critical fact.
- L2  — compliance event. Wrong citation, missing a required source,
        factual error in a regulated domain, weasel-phrase that violates
        the scoring rubric.
- L3  — decision-grade error. Recommendation reversal, missed an L3-level
        red flag (fraud), forbidden_hit triggered, or hallucinated entity.

If RULE_CHECK_SUMMARY reports forbidden_hit=true, severity MUST be ≥ L2.
If citation_recall < 0.5 on a compliance scenario, severity MUST be ≥ L2.
"""


# ════════════════════════════════════════════════════════════════════
#  Main entry
# ════════════════════════════════════════════════════════════════════


_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


def _parse_json(text: str) -> dict[str, Any]:
    raw = text.strip()
    m = _FENCE.search(raw)
    if m:
        raw = m.group(1).strip()
    return json.loads(raw)


def _bump(sev: str, floor: str) -> str:
    order = ["L0", "L1", "L2", "L3"]
    return sev if order.index(sev) >= order.index(floor) else floor


async def judge_trial(
    *,
    question: str,
    context: str,
    reference: dict[str, Any],
    output: str,
    enabled_dims: list[str],
    byok_keys: dict[str, Any] | None = None,
) -> JudgeResult:
    """Score one trial. Always runs rule checks; calls Judge LLM unless every
    enabled dimension is rule-only (forbidden_hit + citation_recall)."""

    forbidden = reference.get("forbidden_claims") or []
    sources   = reference.get("must_cite_sources") or []
    facts     = reference.get("must_contain_facts") or []

    f_hit, f_hits = _forbidden_hit(output, forbidden)
    c_recall, c_matched = _citation_recall(output, sources)
    fact_rule, fact_matched, fact_missed = _fact_match_rule(output, facts)

    rule_summary = {
        "forbidden_hit": f_hit,
        "forbidden_hit_phrases": f_hits,
        "citation_recall": round(c_recall, 3),
        "citation_matched": c_matched,
        "fact_match_rule": round(fact_rule, 3),
        "fact_matched": fact_matched,
        "fact_missed": fact_missed,
    }

    # ── Cheap floor decisions (avoid an LLM call when we already know it's bad) ──
    rule_floor = "L0"
    if f_hit:
        rule_floor = "L3"  # forbidden phrase always escalates
    elif sources and c_recall < 0.5:
        rule_floor = "L2"

    # ── LLM judge for nuanced scoring ──
    try:
        prompt = _build_judge_prompt(
            question=question, context=context, reference=reference,
            output=output, rule_summary=rule_summary,
        )
        result = await call_judge(
            messages=[
                {"role": "system", "content": JUDGE_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            byok_keys=byok_keys,
        )
        parsed = _parse_json(result.content)

        sev = str(parsed.get("severity", "L1"))
        if sev not in {"L0", "L1", "L2", "L3"}:
            sev = "L1"
        sev = _bump(sev, rule_floor)

        scores = dict(parsed.get("scores") or {})
        # Always overlay rule truths on top of LLM claims
        scores["forbidden_hit"] = f_hit
        scores["citation_recall"] = round(c_recall, 3)
        if "fact_accuracy" not in scores:
            scores["fact_accuracy"] = round(fact_rule, 3)

        return JudgeResult(
            severity=sev,
            scores=scores,
            explanation=str(parsed.get("explanation", ""))[:600],
        )

    except Exception as e:  # noqa: BLE001
        # Fall back to rule-only scoring so the run doesn't crash
        sev = rule_floor
        if sev == "L0" and fact_rule < 0.6:
            sev = "L1"
        return JudgeResult(
            severity=sev,
            scores={
                "fact_accuracy": round(fact_rule, 3),
                "hallucination_severity": sev,
                "citation_recall": round(c_recall, 3),
                "forbidden_hit": f_hit,
            },
            explanation=f"(judge LLM failed — rule fallback) {str(e)[:200]}",
            error=str(e)[:300],
        )
