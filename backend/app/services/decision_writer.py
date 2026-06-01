"""Decision-book writer (stub for Week 1 — full implementation in Week 3).

Will call WRITER_MODEL post-run to compose the 6-section Bureau-form
decision book: recommendation, tradeoff snapshot, three stakeholder narratives,
risk list."""

from __future__ import annotations

from typing import Any


async def compose_decision_book(
    *,
    experiment_title: str,
    candidates_summary: list[dict[str, Any]],
    failures_summary: list[dict[str, Any]],
    byok_keys: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """STUB — returns placeholder sections."""
    return {
        "recommendation": {
            "model": candidates_summary[0]["name"] if candidates_summary else "—",
            "headline": "(stub) week 3 will compose this via WRITER_MODEL",
            "pull_quote": "",
        },
        "narratives": {
            "boss": {"caps": "FOR · LEADERSHIP", "title": "(stub)", "body": ""},
            "compliance": {"caps": "FOR · COMPLIANCE", "title": "(stub)", "body": ""},
            "engineering": {"caps": "FOR · ENGINEERING", "title": "(stub)", "body": ""},
        },
        "risks": [],
        "cost_projection": {},
    }
