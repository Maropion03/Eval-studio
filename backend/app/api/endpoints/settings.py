"""
Settings API endpoints — global app configuration.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import AppSettings
from app.schemas.schemas import SettingsResponse, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create(db: Session) -> AppSettings:
    """Get the singleton settings row, creating it if it doesn't exist."""
    row = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not row:
        row = AppSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    """Get current app settings."""
    row = _get_or_create(db)
    return row


@router.put("", response_model=SettingsResponse)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    """Update app settings (partial update)."""
    row = _get_or_create(db)

    if payload.system_prompt is not None:
        row.system_prompt = payload.system_prompt
    if payload.low_score_threshold is not None:
        row.low_score_threshold = payload.low_score_threshold

    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return row
