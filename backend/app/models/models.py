"""SQLAlchemy 2.0 declarative models.

Eval Studio v2 — six tables:

    Session ─< Experiment ─< Run ─< Trial
                      │             │
                      └─ Dataset ─< Case (referenced by Trial via case_id)
"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# ────────────────────────────────────────────────────────────────────
#  Enums (Python side — stored as String in DB for portability)
# ────────────────────────────────────────────────────────────────────


class Scenario(str, Enum):
    financial_qa = "financial_qa"
    compliance_audit = "compliance_audit"
    research_summary = "research_summary"
    fraud_detection = "fraud_detection"
    custom = "custom"


class Severity(str, Enum):
    L0 = "L0"
    L1 = "L1"
    L2 = "L2"
    L3 = "L3"


class RunStatus(str, Enum):
    draft = "draft"
    queued = "queued"
    running = "running"
    done = "done"
    failed = "failed"
    cancelled = "cancelled"


class ExperimentKind(str, Enum):
    PROMPT = "PROMPT"      # prompt regression
    MODEL = "MODEL"        # model upgrade audit
    PARAM = "PARAM"        # parameter sweep
    SELECT = "SELECT"      # model selection


# ────────────────────────────────────────────────────────────────────


def gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:10]}"


# ────────────────────────────────────────────────────────────────────
#  Tables
# ────────────────────────────────────────────────────────────────────


class Session(Base):
    """Anonymous BYOK session — owns experiments + holds user-supplied API keys.
    Reset on cookie expiry. No real auth."""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: gen_id("ses"))
    label: Mapped[str | None] = mapped_column(String(64))

    # Per-provider keys, stored on the server side per session (in-memory cache friendly).
    # JSON: {"siliconflow": "sk-...", "deepseek": "sk-...", "openai": "sk-..."}
    api_keys: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    experiments: Mapped[list["Experiment"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class Dataset(Base):
    """A named collection of test cases. Either a built-in starter pack
    or a user-uploaded JSON/CSV file."""

    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: gen_id("ds"))
    session_id: Mapped[str | None] = mapped_column(ForeignKey("sessions.id"), index=True)

    code: Mapped[str] = mapped_column(String(48))             # e.g. "FIN·QA"
    name: Mapped[str] = mapped_column(String(120))
    scenario: Mapped[str] = mapped_column(String(40))         # Scenario enum value
    blurb: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(Text)
    is_starter: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    cases_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_tokens: Mapped[int] = mapped_column(Integer, default=0)
    typical_l2_rate: Mapped[float] = mapped_column(Float, default=0.0)

    cases: Mapped[list["Case"]] = relationship(
        back_populates="dataset", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("session_id", "code", name="uq_dataset_session_code"),)


class Case(Base):
    """One evaluation case — the unit of work inside a dataset."""

    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: gen_id("case"))
    dataset_id: Mapped[str] = mapped_column(ForeignKey("datasets.id"), index=True)

    case_code: Mapped[str] = mapped_column(String(48))        # e.g. "fin-qa-001"
    difficulty: Mapped[str] = mapped_column(String(16), default="medium")
    risk_tier: Mapped[str] = mapped_column(String(8), default="L1")

    # Raw input / reference / metadata — matches docs/dataset-schema.json
    input: Mapped[dict[str, Any]] = mapped_column(JSON)
    reference: Mapped[dict[str, Any]] = mapped_column(JSON)
    extra: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON)

    dataset: Mapped["Dataset"] = relationship(back_populates="cases")


class Experiment(Base):
    """Experiment intent: 'compare these variables on this dataset using these judges'."""

    __tablename__ = "experiments"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: gen_id("exp"))
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)

    seq: Mapped[int] = mapped_column(Integer)                # short human number, # within session
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(16))            # ExperimentKind enum
    scenario: Mapped[str] = mapped_column(String(40))        # convenience copy from dataset

    dataset_id: Mapped[str] = mapped_column(ForeignKey("datasets.id"))

    # Variable axes config: {"prompts": ["v3","v4"], "models": ["gpt-4o",...], "params": {"temperature": 0.2}}
    variable_axes: Mapped[dict[str, Any]] = mapped_column(JSON)

    # Enabled judge dimensions: ["fact_accuracy","hallucination_severity","citation_recall","forbidden_hit","pareto"]
    judge_dims: Mapped[list[str]] = mapped_column(JSON)

    session: Mapped["Session"] = relationship(back_populates="experiments")
    runs: Mapped[list["Run"]] = relationship(
        back_populates="experiment", cascade="all, delete-orphan"
    )


class Run(Base):
    """One execution of an experiment — produces trials."""

    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: gen_id("run"))
    experiment_id: Mapped[str] = mapped_column(ForeignKey("experiments.id"), index=True)

    status: Mapped[str] = mapped_column(String(16), default=RunStatus.queued.value, index=True)

    trial_count: Mapped[int] = mapped_column(Integer, default=0)
    trials_done: Mapped[int] = mapped_column(Integer, default=0)

    cost_estimated: Mapped[float] = mapped_column(Float, default=0.0)
    cost_actual: Mapped[float] = mapped_column(Float, default=0.0)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Final report rolled up post-completion. Decision book copy etc.
    report: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    decision_book: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)

    experiment: Mapped["Experiment"] = relationship(back_populates="runs")
    trials: Mapped[list["Trial"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


class Trial(Base):
    """The unit cell: one (prompt × model × case) execution + judgement."""

    __tablename__ = "trials"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: gen_id("trial"))
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id"), index=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), index=True)

    idx: Mapped[int] = mapped_column(Integer)                # 1..N within the run

    # The variant being tested at this cell
    prompt_version: Mapped[str | None] = mapped_column(String(32))
    model: Mapped[str] = mapped_column(String(120))
    params: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    # Inference results
    output: Mapped[str | None] = mapped_column(Text)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    cost: Mapped[float] = mapped_column(Float, default=0.0)

    # Judgement
    severity: Mapped[str | None] = mapped_column(String(8))                # Severity enum, null until judged
    scores: Mapped[dict[str, Any] | None] = mapped_column(JSON)            # per-judge dim scores
    judge_explanation: Mapped[str | None] = mapped_column(Text)
    judge_error: Mapped[str | None] = mapped_column(Text)

    run: Mapped["Run"] = relationship(back_populates="trials")
    case: Mapped["Case"] = relationship()
