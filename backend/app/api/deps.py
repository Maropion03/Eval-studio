
from fastapi import Header, HTTPException

async def get_session_id(x_session_id: str = Header(...)) -> str:
    """
    Extract session ID from header.
    Rejects requests without a valid session.
    """
    if not x_session_id:
        raise HTTPException(status_code=400, detail="Missing x-session-id header")
    return x_session_id
