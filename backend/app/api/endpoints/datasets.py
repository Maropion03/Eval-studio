from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_session, get_db_dep
from app.models.models import Dataset, Session as SessionRow
from app.schemas import DatasetOut

router = APIRouter(prefix="/datasets", tags=["datasets"])


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
