"""
Pydantic schemas for request/response validation.
Matches the frontend TypeScript interfaces in mockData.ts.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Shared Sub-schemas ──────────────────────────

class Scores(BaseModel):
    faithfulness: float = 0.0
    relevance: float = 0.0
    coherence: float = 0.0


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0


class HallucinationSpan(BaseModel):
    start: int
    end: int
    text: str


# ── Dataset ─────────────────────────────────────

class DatasetCreate(BaseModel):
    name: str
    items: list[dict] = Field(default_factory=list, description="Parsed JSONL rows")


class DatasetResponse(BaseModel):
    id: str
    name: str
    item_count: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Evaluation Run ──────────────────────────────

class RunCreate(BaseModel):
    dataset_id: str
    model: str = "gpt-4"
    metrics: list[str] = Field(default_factory=lambda: ["faithfulness", "relevance", "coherence"])
    system_prompt: Optional[str] = None


class RunResponse(BaseModel):
    id: str
    dataset_id: str
    dataset_name: str
    model: str
    metrics: list[str]
    status: str
    total_items: int
    completed_items: int = 0
    average_scores: Optional[Scores] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RunProgress(BaseModel):
    run_id: str
    status: str
    completed_items: int
    total_items: int
    current_item_id: Optional[str] = None


# ── Evaluation Item ─────────────────────────────

class ItemResponse(BaseModel):
    id: str
    run_id: str
    query: str
    context: str
    response: str
    ground_truth: str
    scores: Optional[Scores] = None
    reasoning: Optional[str] = None
    failure_type: Optional[str] = None
    hallucination_spans: Optional[list[HallucinationSpan]] = None
    usage: Optional[TokenUsage] = None

    model_config = {"from_attributes": True}


# ── Playground ──────────────────────────────────

class PlaygroundRequest(BaseModel):
    system_prompt: str
    query: str
    context: str
    response: str
    model: str = "gpt-4"
    metric: str = "faithfulness"


class PlaygroundResponse(BaseModel):
    score: float
    reasoning: str
    model: str
    latency_ms: int
    usage: TokenUsage


# ── Compare ─────────────────────────────────────

class CompareResponse(BaseModel):
    base_run: RunResponse
    target_run: RunResponse
    base_items: list[ItemResponse]
    target_items: list[ItemResponse]


# ── Settings ────────────────────────────────────

class SettingsResponse(BaseModel):
    system_prompt: Optional[str] = None
    low_score_threshold: float = 0.7

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    system_prompt: Optional[str] = None
    low_score_threshold: Optional[float] = None
