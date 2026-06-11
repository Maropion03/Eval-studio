"""Decision Book writer — runs after a Run completes.

Aggregates trial data → candidate scoreboard → invokes the WRITER_MODEL to
compose six Bureau-form sections (recommendation, tradeoff_snapshot,
stakeholder narratives, risks, cost_projection, key_failures).

The book is persisted to Run.decision_book and served by /api/runs/{id}.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass
from typing import Any

from app.services.llm_client import call_writer

log = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════════
#  Aggregation
# ════════════════════════════════════════════════════════════════════


@dataclass
class CandidateSummary:
    model: str                              # raw model id, e.g. deepseek-ai/DeepSeek-V3
    display_name: str                       # short name for the report
    trials: int
    pass_rate: float                        # fraction of trials with severity L0
    l1: int
    l2: int
    l3: int
    avg_latency_ms: float
    total_cost: float
    cost_per_trial: float
    pareto: bool = False                    # set later — frontier member


def _display_name(model: str) -> str:
    """Best-effort short label for a model id."""
    return model.split("/")[-1]


def aggregate_trials(trials: list[Any]) -> list[CandidateSummary]:
    """Group raw Trial rows by model and produce per-candidate metrics."""
    buckets: dict[str, list[Any]] = {}
    for t in trials:
        buckets.setdefault(t.model, []).append(t)

    out: list[CandidateSummary] = []
    for model, ts in buckets.items():
        n = len(ts)
        l0 = sum(1 for t in ts if t.severity == "L0")
        l1 = sum(1 for t in ts if t.severity == "L1")
        l2 = sum(1 for t in ts if t.severity == "L2")
        l3 = sum(1 for t in ts if t.severity == "L3")
        cost_total = sum(t.cost or 0 for t in ts)
        latencies = [t.latency_ms for t in ts if t.latency_ms]
        out.append(CandidateSummary(
            model=model,
            display_name=_display_name(model),
            trials=n,
            pass_rate=round(l0 / n, 4) if n else 0.0,
            l1=l1, l2=l2, l3=l3,
            avg_latency_ms=round(sum(latencies) / len(latencies), 1) if latencies else 0.0,
            total_cost=round(cost_total, 4),
            cost_per_trial=round(cost_total / n, 4) if n else 0.0,
        ))
    # Sort by pass_rate desc, then by cost asc — natural ranking.
    out.sort(key=lambda c: (-c.pass_rate, c.cost_per_trial))
    return out


def compute_pareto(candidates: list[CandidateSummary]) -> None:
    """Mark non-dominated points (lower cost AND higher pass_rate)."""
    for c in candidates:
        dominated = False
        for d in candidates:
            if d is c:
                continue
            # d dominates c if d is cheaper AND not worse on quality,
            # or higher pass AND not pricier.
            if d.cost_per_trial < c.cost_per_trial and d.pass_rate >= c.pass_rate:
                dominated = True
                break
            if d.pass_rate > c.pass_rate and d.cost_per_trial <= c.cost_per_trial:
                dominated = True
                break
        c.pareto = not dominated


def top_failures(trials: list[Any], n: int = 5) -> list[dict[str, Any]]:
    """Pick the most consequential failures — L3 first, then L2."""
    order = {"L3": 0, "L2": 1, "L1": 2, "L0": 3}
    losers = sorted(
        [t for t in trials if t.severity in ("L2", "L3")],
        key=lambda t: (order.get(t.severity, 9), -(t.cost or 0)),
    )[:n]
    return [{
        "trial_idx":  t.idx,
        "case_id":    t.case_id,
        "model":      t.model,
        "severity":   t.severity,
        "explanation": (t.judge_explanation or "")[:280],
        "output_excerpt": (t.output or "")[:240],
    } for t in losers]


# ════════════════════════════════════════════════════════════════════
#  Writer LLM prompt
# ════════════════════════════════════════════════════════════════════


WRITER_SYSTEM = (
    "You are a senior management consultant writing a Decision Book "
    "for an AI product team. Tone: precise, decisive, no hedging. "
    "Output STRICT JSON only — no prose, no markdown fences."
)


def _build_writer_prompt(
    *,
    experiment_title: str,
    scenario: str,
    candidates: list[CandidateSummary],
    failures: list[dict[str, Any]],
) -> str:
    cand_lines = [
        f"- {c.display_name}: trials={c.trials} pass_rate={c.pass_rate:.2%} "
        f"L1={c.l1} L2={c.l2} L3={c.l3} "
        f"avg_latency={c.avg_latency_ms:.0f}ms "
        f"cost/trial=¥{c.cost_per_trial:.4f} {'★PARETO' if c.pareto else ''}"
        for c in candidates
    ]
    fail_lines = [
        f"- {f['severity']} · {f['model']}: {f['explanation']}"
        for f in failures
    ]

    recommended = next((c.display_name for c in candidates if c.pareto), candidates[0].display_name if candidates else "—")

    return f"""# DECISION BOOK · GENERATE

## CONTEXT
Experiment: {experiment_title}
Scenario:   {scenario}

## CANDIDATE SCOREBOARD
{chr(10).join(cand_lines)}

Pareto recommendation: {recommended}

## NOTABLE FAILURES (severity-ordered)
{chr(10).join(fail_lines) if fail_lines else "(none — all trials passed)"}

## YOUR JOB

Return STRICT JSON with this shape:

{{
  "recommendation": {{
    "model": "<display_name>",
    "headline": "<one-line decision>",
    "pull_quote": "<one-line italic-worthy line>"
  }},
  "tradeoff_paragraph": "<one paragraph quantifying the cost vs accuracy tradeoff — must reference concrete numbers from the scoreboard>",
  "annual_spend_table": {{
    "assumptions": "<one sentence stating the call-volume assumption>",
    "rows": [
      {{"model": "<display>", "yuan_per_year": <integer in CNY>}}
    ]
  }},
  "narratives": {{
    "boss":        {{"title": "<sentence>", "body": "<3-5 sentences focused on ROI / cost / time-to-ship>"}},
    "compliance":  {{"title": "<sentence>", "body": "<3-5 sentences focused on L2 risk + mitigation>"}},
    "engineering": {{"title": "<sentence>", "body": "<3-5 sentences listing concrete migration steps>"}}
  }},
  "risks": [
    {{"severity": "L1|L2", "risk": "<short Chinese OK>", "mitigation": "<short>"}}
  ]
}}

## RULES
- Be specific. Quote numbers from the scoreboard.
- Recommend ONE model and defend it crisply.
- If L2/L3 events exist, the compliance narrative MUST mention a concrete
  mitigation (routing rule, fallback model, manual review gate, …).
- Engineering narrative MUST list 3-4 concrete steps.
- Risks list: 2-3 entries minimum, each with a real mitigation.
"""


# ════════════════════════════════════════════════════════════════════
#  JSON extraction
# ════════════════════════════════════════════════════════════════════


_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


def _parse_json(text: str) -> dict[str, Any]:
    raw = text.strip()
    m = _FENCE.search(raw)
    if m:
        raw = m.group(1).strip()
    return json.loads(raw)


# ════════════════════════════════════════════════════════════════════
#  Public entry
# ════════════════════════════════════════════════════════════════════


async def compose_decision_book(
    *,
    experiment_title: str,
    scenario: str,
    trials: list[Any],
    byok_keys: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Returns the decision book JSON, ready to persist to Run.decision_book.

    Always returns a structurally-valid dict: on writer LLM failure we
    fall back to a deterministic skeleton built from aggregates only.
    """
    candidates = aggregate_trials(trials)
    compute_pareto(candidates)
    failures = top_failures(trials)

    scoreboard = [asdict(c) for c in candidates]
    failures_view = failures

    if not candidates:
        return {
            "recommendation": {"model": "—", "headline": "No trials completed.",
                               "pull_quote": "Re-run with at least one model + dataset selected."},
            "tradeoff_paragraph": "",
            "annual_spend_table": {"assumptions": "", "rows": []},
            "narratives": {
                "boss":        {"title": "", "body": ""},
                "compliance":  {"title": "", "body": ""},
                "engineering": {"title": "", "body": ""},
            },
            "risks": [],
            "scoreboard": scoreboard,
            "failures":   failures_view,
            "_source":    "skeleton (no trials)",
        }

    try:
        prompt = _build_writer_prompt(
            experiment_title=experiment_title, scenario=scenario,
            candidates=candidates, failures=failures,
        )
        result = await call_writer(
            messages=[
                {"role": "system", "content": WRITER_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            byok_keys=byok_keys,
        )
        book = _parse_json(result.content)
        book["scoreboard"] = scoreboard
        book["failures"]   = failures_view
        book["_source"]    = "writer_llm"
        return book

    except Exception as e:  # noqa: BLE001
        log.warning("writer LLM failed: %s", e)
        rec = candidates[0]
        return {
            "recommendation": {
                "model": rec.display_name,
                "headline": f"Adopt {rec.display_name} — leads pass rate at {rec.pass_rate:.1%}.",
                "pull_quote": f"{rec.pass_rate:.1%} pass rate at ¥{rec.cost_per_trial:.4f}/trial.",
            },
            "tradeoff_paragraph": "(writer LLM unavailable — see scoreboard for raw numbers)",
            "annual_spend_table": {"assumptions": "", "rows": []},
            "narratives": {
                "boss":        {"title": "", "body": ""},
                "compliance":  {"title": "", "body": ""},
                "engineering": {"title": "", "body": ""},
            },
            "risks": [],
            "scoreboard": scoreboard,
            "failures":   failures_view,
            "_source":    f"skeleton (writer error: {str(e)[:120]})",
        }
