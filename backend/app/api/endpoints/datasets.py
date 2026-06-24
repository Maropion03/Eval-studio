from __future__ import annotations

import re
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_session, get_db_dep
from app.models.models import Case, Dataset
from app.models.models import Session as SessionRow
from app.schemas import DatasetOut
from app.services.dataset_io import DatasetParseError, parse_dataset

router = APIRouter(prefix="/datasets", tags=["datasets"])

MAX_UPLOAD_BYTES = 5_000_000
CONTEXT_PREVIEW = 2000


def _make_code(name: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").upper()[:18] or "UPLOAD"
    return f"{slug}·{uuid4().hex[:4]}"


@router.get("", response_model=list[DatasetOut])
async def list_datasets(
    db: AsyncSession = Depends(get_db_dep),
    sess: SessionRow = Depends(current_session),
) -> list[Dataset]:
    """Return starter datasets + this session's uploads."""
    stmt = select(Dataset).where(
        (Dataset.is_starter.is_(True)) | (Dataset.session_id == sess.id)
    ).order_by(Dataset.is_starter.desc(), Dataset.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return list(rows)


@router.post("/upload", response_model=DatasetOut, status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str | None = Form(None),
    db: AsyncSession = Depends(get_db_dep),
    sess: SessionRow = Depends(current_session),
) -> Dataset:
    """Upload a JSON / CSV dataset, validate against the case schema, persist
    it scoped to this session."""
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "file too large (max 5MB)")
    if not content.strip():
        raise HTTPException(422, {"message": "empty file", "errors": ["file is empty"]})

    try:
        scenario, cases = parse_dataset(file.filename or "upload.json", content)
    except DatasetParseError as e:
        raise HTTPException(422, {"message": "dataset validation failed", "errors": e.errors[:50]}) from e

    ds_name = (name or (file.filename or "Uploaded dataset")).strip()[:120] or "Uploaded dataset"
    avg_tokens = int(
        sum(len(c["input"]["question"]) + len(c["input"].get("context") or "") for c in cases) / len(cases)
    )
    l2plus = sum(1 for c in cases if c["risk_tier"] in ("L2", "L3"))

    # Retry once on the (unlikely) generated-code collision rather than 500.
    for attempt in range(2):
        ds = Dataset(
            session_id=sess.id,
            code=_make_code(ds_name),
            name=ds_name,
            scenario=scenario,
            blurb=f"Uploaded · {len(cases)} cases",
            source=file.filename,
            is_starter=False,
            cases_count=len(cases),
            avg_tokens=avg_tokens,
            typical_l2_rate=round(l2plus / len(cases) * 100, 1),
        )
        db.add(ds)
        await db.flush()
        for c in cases:
            db.add(Case(
                dataset_id=ds.id,
                case_code=c["case_code"],
                difficulty=c["difficulty"],
                risk_tier=c["risk_tier"],
                input=c["input"],
                reference=c["reference"],
                extra=c["metadata"],
            ))
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            if attempt == 1:
                raise HTTPException(409, "dataset code collision — please retry") from None
            continue
        await db.refresh(ds)
        return ds


@router.get("/{dataset_id}/cases")
async def list_cases(
    dataset_id: str,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db_dep),
    sess: SessionRow = Depends(current_session),
):
    """Cases of a dataset, for the inspect view. Starter datasets are public;
    uploads are visible only to their owning session."""
    ds = (await db.execute(select(Dataset).where(Dataset.id == dataset_id))).scalar_one_or_none()
    if ds is None or (not ds.is_starter and ds.session_id != sess.id):
        raise HTTPException(404, "dataset not found")

    total = (await db.execute(
        select(func.count()).select_from(Case).where(Case.dataset_id == dataset_id)
    )).scalar_one()
    rows = (await db.execute(
        select(Case)
        .where(Case.dataset_id == dataset_id)
        .order_by(Case.case_code)
        .limit(min(max(limit, 1), 500))
        .offset(max(offset, 0))
    )).scalars().all()

    return {
        "dataset_id": dataset_id,
        "name": ds.name,
        "scenario": ds.scenario,
        "total": total,
        "cases": [
            {
                "case_code": c.case_code,
                "difficulty": c.difficulty,
                "risk_tier": c.risk_tier,
                "question": (c.input or {}).get("question", ""),
                "context_preview": ((c.input or {}).get("context") or "")[:CONTEXT_PREVIEW],
                "reference": c.reference,
                "metadata": c.extra,
            }
            for c in rows
        ],
    }


@router.delete("/{dataset_id}", status_code=204)
async def delete_dataset(
    dataset_id: str,
    db: AsyncSession = Depends(get_db_dep),
    sess: SessionRow = Depends(current_session),
):
    """Delete an uploaded dataset owned by this session. Starter packs cannot
    be deleted."""
    ds = (await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.session_id == sess.id,
            Dataset.is_starter.is_(False),
        )
    )).scalar_one_or_none()
    if ds is None:
        raise HTTPException(404, "dataset not found or not deletable")
    await db.delete(ds)
    await db.commit()
