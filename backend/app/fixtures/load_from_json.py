"""Load already-generated case JSON files into DB.

Run AFTER `python -m app.fixtures.seed --no-db` has produced fixtures/seed_*.json,
or when restoring datasets on a fresh database.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from sqlalchemy import delete, select

from app.db.session import AsyncSessionLocal
from app.fixtures.seed import DATASETS, FIXTURES_DIR
from app.models.models import Case, Dataset


async def main() -> None:
    async with AsyncSessionLocal() as db:
        for spec in DATASETS:
            path = FIXTURES_DIR / f"seed_{spec.scenario}.json"
            if not path.exists():
                print(f"⚠ {path.name} not found, skipping {spec.scenario}")
                continue

            data = json.loads(path.read_text(encoding="utf-8"))
            cases = data.get("cases", [])
            if not cases:
                print(f"⚠ {path.name} empty")
                continue

            # wipe existing starter for this scenario (idempotent)
            existing = (
                await db.execute(
                    select(Dataset.id).where(
                        Dataset.scenario == spec.scenario,
                        Dataset.is_starter.is_(True),
                    )
                )
            ).scalars().all()
            for ds_id in existing:
                await db.execute(delete(Dataset).where(Dataset.id == ds_id))
            await db.flush()

            ds = Dataset(
                session_id=None,
                code=spec.code,
                name=spec.name,
                scenario=spec.scenario,
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
            print(f"✓ {spec.name}: {len(cases)} cases → dataset {ds.id}")


if __name__ == "__main__":
    asyncio.run(main())
