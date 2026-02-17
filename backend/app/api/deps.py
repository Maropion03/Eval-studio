from typing import Generator, Optional
from fastapi import Header
from app.db.session import SessionLocal

def get_db() -> Generator:
    """
    Dependency to provide a database session.
    Ensures the session is closed after the request is finished.
    """
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

def get_session_id(x_session_id: Optional[str] = Header(None)) -> str:
    """
    Dependency to extract the Session ID from headers.
    Returns a default value if not provided (for dev/local mode).
    """
    # In a real app, you might want to generate a UUID here if missing,
    # or enforce that the frontend always sends it.
    return x_session_id or "default-session"
