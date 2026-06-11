"""Session middleware — assigns + reads an anonymous session_id cookie.

No real auth. Each browser gets a random opaque id that scopes their experiments
and BYOK API keys server-side. Cookie TTL controls expiry.
"""

from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable
from uuid import uuid4

from fastapi import Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.models.models import Session as SessionRow

settings = get_settings()


class SessionMiddleware(BaseHTTPMiddleware):
    """Attach `request.state.session_id` and ensure cookie is set on response."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        sid = request.cookies.get(settings.session_cookie_name)
        new_session = False
        if not sid or not sid.startswith("ses_"):
            sid = f"ses_{uuid4().hex[:16]}"
            new_session = True

        request.state.session_id = sid

        response = await call_next(request)

        if new_session:
            response.set_cookie(
                key=settings.session_cookie_name,
                value=sid,
                max_age=settings.session_ttl_seconds,
                httponly=True,
                samesite="lax",
                secure=not settings.debug,
            )
        return response


async def touch_session(db: AsyncSession, session_id: str) -> SessionRow:
    """Get-or-create the session row, refresh last_seen. Cached implicitly by SQLAlchemy."""
    row: SessionRow | None = (
        await db.execute(select(SessionRow).where(SessionRow.id == session_id))
    ).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if row is None:
        row = SessionRow(id=session_id, last_seen=now, api_keys={})
        db.add(row)
    else:
        row.last_seen = now
    await db.commit()
    return row


def session_expired(row: SessionRow) -> bool:
    if row.last_seen is None:
        return True
    expiry = row.last_seen + timedelta(seconds=settings.session_ttl_seconds)
    return datetime.now(timezone.utc) > expiry
