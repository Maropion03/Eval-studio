"""Pydantic v2 request / response schemas (loose mirrors of SQLA models)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class _Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Datasets ───────────────────────────────────────────────


class DatasetOut(_Out):
    id: str
    code: str
    name: str
    scenario: str
    blurb: str | None = None
    source: str | None = None
    is_starter: bool
    cases_count: int
    avg_tokens: int
    typical_l2_rate: float


# ── Experiments ────────────────────────────────────────────


class CreateExperimentIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    kind: Literal["PROMPT", "MODEL", "PARAM", "SELECT"]
    dataset_id: str
    variable_axes: dict[str, Any]
    judge_dims: list[str]


class ExperimentOut(_Out):
    id: str
    seq: int
    title: str
    kind: str
    scenario: str
    dataset_id: str
    variable_axes: dict[str, Any]
    judge_dims: list[str]
    created_at: datetime


# ── Runs ───────────────────────────────────────────────────


class NewRunIn(BaseModel):
    """When user clicks START RUN — either reuses an experiment or creates ad-hoc."""

    experiment_id: str | None = None
    inline_experiment: CreateExperimentIn | None = None


class TrialEvent(BaseModel):
    """One SSE event payload — what live page receives per trial."""

    type: Literal["trial", "progress", "complete", "error"] = "trial"
    idx: int = 0
    model: str | None = None
    case_code: str | None = None
    severity: str | None = None
    cost: float = 0.0
    latency_ms: int = 0

    # for type == 'progress' / 'complete'
    done: int = 0
    total: int = 0
    cost_actual: float = 0.0

    # for type == 'error'
    message: str | None = None


class RunOut(_Out):
    id: str
    experiment_id: str
    status: str
    trial_count: int
    trials_done: int
    cost_estimated: float
    cost_actual: float
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error: str | None = None


# ── Settings (BYOK) ────────────────────────────────────────


class SettingsIn(BaseModel):
    siliconflow_api_key: str | None = None
    deepseek_api_key: str | None = None
    openai_api_key: str | None = None


class SettingsOut(BaseModel):
    siliconflow_configured: bool
    deepseek_configured: bool
    openai_configured: bool
    # server has its own dev key as fallback?
    server_fallback_siliconflow: bool
    # deterministic offline LLM active — runs don't hit real providers
    mock_llm: bool = False
