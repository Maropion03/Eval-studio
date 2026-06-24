from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            Path(__file__).resolve().parents[2] / ".env.local",
            Path(__file__).resolve().parents[2] / ".env",
        ),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── LLM providers ──
    siliconflow_api_key: str | None = None
    siliconflow_base_url: str = "https://api.siliconflow.cn/v1"
    deepseek_api_key: str | None = None
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    openai_api_key: str | None = None

    # ── Fixed inference roles ──
    judge_model: str = "deepseek-ai/DeepSeek-V4-Pro"
    writer_model: str = "deepseek-ai/DeepSeek-V4-Pro"

    # ── DB ──
    # Empty → fall back to local SQLite for dev
    database_url: str | None = None

    # ── App ──
    debug: bool = False
    # SQL statement echo — decoupled from debug so local http dev (which needs
    # debug=1 for non-secure session cookies) doesn't spam the logs.
    sql_echo: bool = False
    # Deterministic offline LLM. When on, the whole pipeline runs keyless with
    # stable results — for local demos and the test suite. Off in production.
    mock_llm: bool = False
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    session_cookie_name: str = "eval_studio_sid"
    session_ttl_seconds: int = 86400
    rate_limit_per_hour: int = Field(default=50, ge=1)

    @property
    def effective_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        # local fallback — SQLite file at backend/data/eval-studio.db
        data_dir = Path(__file__).resolve().parents[2] / "data"
        data_dir.mkdir(exist_ok=True)
        return f"sqlite+aiosqlite:///{data_dir / 'eval-studio.db'}"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
