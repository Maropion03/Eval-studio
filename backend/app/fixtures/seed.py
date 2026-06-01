"""Dataset seeder.

Usage:
    # smoke test — 2 cases per scenario, JSON only, no DB write
    python -m app.fixtures.seed --smoke

    # full bulk — 40/30/30/40, writes JSON fixtures AND inserts into DB
    python -m app.fixtures.seed

    # custom counts
    python -m app.fixtures.seed --financial 5 --compliance 5 --research 5 --fraud 5
"""

from __future__ import annotations

import argparse
import asyncio
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import delete

from app.db.session import AsyncSessionLocal
from app.fixtures.generators import generate_case
from app.models.models import Case, Dataset

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"
FIXTURES_DIR.mkdir(parents=True, exist_ok=True)


# ════════════════════════════════════════════════════════════════════
#  Static metadata per dataset (consistent with Step1Dataset cards on UI)
# ════════════════════════════════════════════════════════════════════


@dataclass
class DatasetSpec:
    scenario: str
    code: str
    name: str
    blurb: str
    source: str
    avg_tokens: int
    typical_l2_rate: float


DATASETS: list[DatasetSpec] = [
    DatasetSpec(
        scenario="financial_qa",
        code="FIN·QA",
        name="Financial QA",
        blurb="Number-dense QA over Chinese A-share quarterly / annual reports. "
              "Stresses fact-accuracy on amounts, dates, ratio precision.",
        source="上市公司年报抽样 · 5 issuer",
        avg_tokens=420,
        typical_l2_rate=3.5,
    ),
    DatasetSpec(
        scenario="compliance_audit",
        code="COMP·AUD",
        name="Compliance Audit",
        blurb="Clause citation + violation classification. Hard floor: must cite "
              "the right regulation, no soft answers.",
        source="CSRC public penalty decisions",
        avg_tokens=680,
        typical_l2_rate=12.2,
    ),
    DatasetSpec(
        scenario="research_summary",
        code="RES·SUM",
        name="Research Summary",
        blurb="Long-context summarization of sell-side research. Tests faithfulness "
              "to source conclusions and recommendation framing.",
        source="Equity research reports 2024-25",
        avg_tokens=5400,
        typical_l2_rate=5.0,
    ),
    DatasetSpec(
        scenario="fraud_detection",
        code="FRD·DET",
        name="Fraud Detection",
        blurb="Multi-signal anomaly identification. Tests boundary judgment on "
              "related-party concealment.",
        source="Synthesized from financial fraud research dataset",
        avg_tokens=1240,
        typical_l2_rate=7.5,
    ),
]


# ════════════════════════════════════════════════════════════════════
#  Concurrent generation with bounded parallelism + per-task error trap
# ════════════════════════════════════════════════════════════════════


async def _gen_with_retry(scenario: str, seq: int, attempts: int = 3) -> dict[str, Any] | None:
    last_err: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return await generate_case(scenario, seq)
        except Exception as e:  # noqa: BLE001
            last_err = e
            print(f"  ⚠ {scenario} #{seq:03d} attempt {attempt}/{attempts} failed: {e}")
            await asyncio.sleep(1.2 * attempt)
    print(f"  ✗ {scenario} #{seq:03d} GAVE UP: {last_err}")
    return None


async def _generate_batch(scenario: str, count: int, concurrency: int = 8) -> list[dict[str, Any]]:
    sem = asyncio.Semaphore(concurrency)

    async def _slot(seq: int) -> dict[str, Any] | None:
        async with sem:
            print(f"  → {scenario} #{seq:03d}")
            return await _gen_with_retry(scenario, seq)

    tasks = [_slot(seq) for seq in range(1, count + 1)]
    results = await asyncio.gather(*tasks)
    return [r for r in results if r is not None]


# ════════════════════════════════════════════════════════════════════
#  DB seeding
# ════════════════════════════════════════════════════════════════════


async def _write_to_db(scenario: str, spec: DatasetSpec, cases: list[dict[str, Any]]) -> str:
    async with AsyncSessionLocal() as db:
        # wipe existing starter dataset for this scenario (idempotent re-seed)
        existing = (
            (await db.execute(
                Dataset.__table__.select().where(
                    Dataset.scenario == scenario,
                    Dataset.is_starter.is_(True),
                )
            )).fetchall()
        )
        for row in existing:
            await db.execute(delete(Dataset).where(Dataset.id == row.id))
        await db.flush()

        ds = Dataset(
            session_id=None,
            code=spec.code,
            name=spec.name,
            scenario=scenario,
            blurb=spec.blurb,
            source=spec.source,
            is_starter=True,
            cases_count=len(cases),
            avg_tokens=spec.avg_tokens,
            typical_l2_rate=spec.typical_l2_rate,
        )
        db.add(ds)
        await db.flush()

        for c in cases:
            db.add(Case(
                dataset_id=ds.id,
                case_code=c["case_code"],
                difficulty=c.get("difficulty", "medium"),
                risk_tier=c.get("risk_tier", "L1"),
                input=c["input"],
                reference=c["reference"],
                extra=c.get("metadata"),
            ))
        await db.commit()
        return ds.id


def _write_to_json(scenario: str, cases: list[dict[str, Any]], suffix: str = "") -> Path:
    out = FIXTURES_DIR / f"seed_{scenario}{suffix}.json"
    out.write_text(
        json.dumps({"scenario": scenario, "cases": cases}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return out


# ════════════════════════════════════════════════════════════════════
#  Entry
# ════════════════════════════════════════════════════════════════════


async def main(counts: dict[str, int], *, smoke: bool, no_db: bool) -> None:
    suffix = "_smoke" if smoke else ""

    for spec in DATASETS:
        n = counts[spec.scenario]
        if n <= 0:
            continue
        print(f"\n══ {spec.name} · {n} cases ══")

        cases = await _generate_batch(spec.scenario, n)
        if len(cases) < n:
            print(f"  ⚠ produced {len(cases)}/{n} (some failed)")

        json_path = _write_to_json(spec.scenario, cases, suffix=suffix)
        print(f"  ✓ wrote {len(cases)} cases → {json_path.name}")

        if not no_db and not smoke:
            ds_id = await _write_to_db(spec.scenario, spec, cases)
            print(f"  ✓ DB row {ds_id} ({len(cases)} cases)")


def cli() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--smoke", action="store_true", help="2 cases per scenario, JSON only")
    ap.add_argument("--no-db", action="store_true", help="skip DB insert")
    ap.add_argument("--financial",  type=int, default=40)
    ap.add_argument("--compliance", type=int, default=30)
    ap.add_argument("--research",   type=int, default=30)
    ap.add_argument("--fraud",      type=int, default=40)
    args = ap.parse_args()

    if args.smoke:
        counts = {
            "financial_qa": 2, "compliance_audit": 2,
            "research_summary": 2, "fraud_detection": 2,
        }
    else:
        counts = {
            "financial_qa":     args.financial,
            "compliance_audit": args.compliance,
            "research_summary": args.research,
            "fraud_detection":  args.fraud,
        }

    asyncio.run(main(counts, smoke=args.smoke, no_db=args.no_db))


if __name__ == "__main__":
    cli()
