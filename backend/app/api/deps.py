"""
Eval Studio — Dependencies

Shared FastAPI dependencies for database sessions and request context.
"""

from typing import Generator, Optional
from fastapi import Header
from app.db.session import SessionLocal


def get_db() -> Generator:
    """
    Dependency to provide a database session.
    Ensures the session is closed after the request is finished.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_session_id(x_session_id: Optional[str] = Header(None)) -> str:
    """
    Dependency to extract the Session ID from headers.
    Returns a default value if not provided (for dev/local mode).
    """
    return x_session_id or "default-session"
