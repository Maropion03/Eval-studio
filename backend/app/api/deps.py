"""FastAPI dependencies."""

from collections.abc import AsyncIterator

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import touch_session
from app.db.session import get_db
from app.models.models import Session as SessionRow


async def get_session_id(request: Request) -> str:
    return request.state.session_id


async def get_db_dep() -> AsyncIterator[AsyncSession]:
    async for db in get_db():
        yield db


async def current_session(
    request: Request,
    db: AsyncSession = Depends(get_db_dep),
) -> SessionRow:
    return await touch_session(db, request.state.session_id)
