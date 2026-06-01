"""Rate limit setup — slowapi keyed by session_id."""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.config import get_settings

settings = get_settings()


def session_key(request: Request) -> str:
    sid = getattr(request.state, "session_id", None)
    if sid:
        return sid
    return get_remote_address(request)


limiter = Limiter(key_func=session_key, default_limits=[])
