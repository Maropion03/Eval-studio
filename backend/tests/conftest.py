"""Pytest fixtures for the Eval Studio v2 backend test suite.

CRITICAL: env vars are set at module import time — BEFORE any `app.*` import —
because `app.core.config.get_settings()` is `lru_cache`d and
`app.db.session` builds the async engine at import time. Setting these here
guarantees the test process uses an isolated temp SQLite DB with MOCK_LLM on,
never the dev server's DB at backend/data/eval-studio.db.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

# ── isolate the test environment (must run before importing the app) ──
_TMP_DB = Path(tempfile.gettempdir()) / "eval_studio_test.db"
# Start from a clean file each session.
if _TMP_DB.exists():
    _TMP_DB.unlink()

os.environ["MOCK_LLM"] = "1"
os.environ["DEBUG"] = "1"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TMP_DB}"
# Avoid SQL log spam.
os.environ["SQL_ECHO"] = "0"
# Generous rate limit so API tests don't trip slowapi.
os.environ["RATE_LIMIT_PER_HOUR"] = "100000"

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402

# Now safe to import the app — engine + settings bind to the temp DB.
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import models  # noqa: E402,F401  (import for table registration)


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_schema():
    """Build the schema on the isolated temp engine once per session."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest_asyncio.fixture
async def client():
    """In-process ASGI client. Reusing one client keeps one session cookie,
    so requests stay within a single anonymous session."""
    import httpx

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as ac:
        yield ac


@pytest_asyncio.fixture
async def seeded_dataset():
    """Insert one tiny starter dataset + one case directly into the test DB.

    Returns the dataset id. Used by API tests that need GET /api/datasets to
    return at least one starter pack and a runnable case.
    """
    from app.db.session import AsyncSessionLocal
    from app.models.models import Case, Dataset

    async with AsyncSessionLocal() as db:
        ds = Dataset(
            session_id=None,
            code="TEST·FIN",
            name="Test Financial QA",
            scenario="financial_qa",
            blurb="tiny starter for tests",
            source="test-fixture",
            is_starter=True,
            cases_count=1,
            avg_tokens=120,
            typical_l2_rate=0.0,
        )
        db.add(ds)
        await db.flush()
        db.add(
            Case(
                dataset_id=ds.id,
                case_code="test-001",
                difficulty="medium",
                risk_tier="L1",
                input={
                    "question": "公司2023年营业收入是多少？",
                    "context": (
                        "DOCUMENT 公司2023年实现营业收入 45.67 亿元，"
                        "同比增长12.3%；营业成本 28.34 亿元。"
                    ),
                    "extra": {},
                },
                reference={
                    "must_contain_facts": ["营业收入 45.67 亿元", "营业成本 28.34 亿元"],
                    "must_cite_sources": [],
                    "forbidden_claims": ["投资建议"],
                    "golden_answer": "公司2023年营业收入为45.67亿元。",
                    "scoring_rubric": "需包含营业收入数值。",
                },
                extra=None,
            )
        )
        await db.commit()
        ds_id = ds.id

    yield ds_id

    # Cleanup so a re-run doesn't trip the (session_id, code) unique constraint.
    async with AsyncSessionLocal() as db:
        from sqlalchemy import delete

        await db.execute(delete(Dataset).where(Dataset.id == ds_id))
        await db.commit()
