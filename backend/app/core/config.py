"""
Judge-Opus Backend Configuration
Loads settings from .env file
"""

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # LLM API Keys
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Defaults
    default_model: str = "gpt-4"
    low_score_threshold: float = 0.7

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Paths
    base_dir: Path = Path(__file__).resolve().parent.parent.parent
    data_dir: Path = base_dir / "data"
    db_path: Path = data_dir / "judge_opus_sessions.db"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent.parent / ".env"),
        "env_file_encoding": "utf-8",
    }


settings = Settings()

# Ensure data directory exists
settings.data_dir.mkdir(parents=True, exist_ok=True)
