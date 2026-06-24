from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_session, get_db_dep
from app.core.config import get_settings
from app.models.models import Session as SessionRow
from app.schemas import SettingsIn, SettingsOut

router = APIRouter(prefix="/settings", tags=["settings"])

cfg = get_settings()


@router.get("", response_model=SettingsOut)
async def get_session_settings(sess: SessionRow = Depends(current_session)) -> SettingsOut:
    keys = sess.api_keys or {}
    return SettingsOut(
        siliconflow_configured=bool(keys.get("siliconflow")),
        deepseek_configured=bool(keys.get("deepseek")),
        openai_configured=bool(keys.get("openai")),
        server_fallback_siliconflow=bool(cfg.siliconflow_api_key),
        mock_llm=cfg.mock_llm,
    )


@router.put("", response_model=SettingsOut)
async def put_session_settings(
    body: SettingsIn,
    db: AsyncSession = Depends(get_db_dep),
    sess: SessionRow = Depends(current_session),
) -> SettingsOut:
    keys = dict(sess.api_keys or {})
    if body.siliconflow_api_key is not None:
        keys["siliconflow"] = body.siliconflow_api_key.strip() or None
    if body.deepseek_api_key is not None:
        keys["deepseek"] = body.deepseek_api_key.strip() or None
    if body.openai_api_key is not None:
        keys["openai"] = body.openai_api_key.strip() or None
    # remove falsy keys
    keys = {k: v for k, v in keys.items() if v}
    sess.api_keys = keys
    await db.commit()

    return SettingsOut(
        siliconflow_configured=bool(keys.get("siliconflow")),
        deepseek_configured=bool(keys.get("deepseek")),
        openai_configured=bool(keys.get("openai")),
        server_fallback_siliconflow=bool(cfg.siliconflow_api_key),
        mock_llm=cfg.mock_llm,
    )
