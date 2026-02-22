"""
Eval Studio — Pydantic Schemas

All request/response models for the API layer.
Aligned with ORM models in app/models/models.py.
"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

# ─── 1. App Settings ──────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    """Partial update payload for settings."""
    system_prompt: Optional[str] = None
    low_score_threshold: Optional[float] = None

class SettingsResponse(BaseModel):
    """Response model for settings."""
    id: int
    system_prompt: Optional[str] = None
    low_score_threshold: float = 0.7
    updated_at: datetime

    class Config:
        from_attributes = True

# ─── 2. Evaluation Items ──────────────────────────────────────────

class EvaluationItemBase(BaseModel):
    query: str
    context: str
    response: str
    ground_truth: Optional[str] = ""
    scores: Optional[Dict[str, float]] = None
    reasoning: Optional[str] = None
    failure_type: Optional[str] = None
    hallucination_spans: Optional[List[Dict[str, Any]]] = None
    usage: Optional[Dict[str, int]] = None

class EvaluationItemCreate(EvaluationItemBase):
    run_id: str

class EvaluationItem(EvaluationItemBase):
    id: str
    run_id: str
    session_id: str

    class Config:
        from_attributes = True

# Alias for API responses (used by compare endpoint)
class ItemResponse(EvaluationItem):
    pass

# ─── 3. Datasets ──────────────────────────────────────────────────

class DatasetCreate(BaseModel):
    """Create dataset from JSON body — includes inline items."""
    name: str
    items: List[Dict[str, Any]] = []

class DatasetResponse(BaseModel):
    """Response model for datasets."""
    id: str
    name: str
    item_count: int = 0
    status: str = "ready"
    created_at: datetime

    class Config:
        from_attributes = True

# ─── 4. Evaluation Runs ───────────────────────────────────────────

class EvaluationRunCreate(BaseModel):
    dataset_id: str
    model: str
    metrics: List[str] = ["faithfulness", "relevance", "coherence"]
    system_prompt: Optional[str] = None

class EvaluationRun(BaseModel):
    id: str
    dataset_id: str
    dataset_name: str
    model: str
    metrics: List[str]
    status: str
    total_items: int = 0
    completed_items: int = 0
    average_scores: Optional[Dict[str, float]] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    session_id: str
    system_prompt: Optional[str] = None

    class Config:
        from_attributes = True

# Alias for API responses
class RunResponse(EvaluationRun):
    pass

# ─── 5. Playground ────────────────────────────────────────────────

class PlaygroundRequest(BaseModel):
    system_prompt: str
    query: str = ""
    context: str = ""
    response: str = ""
    model: str = "gpt-4"
    metric: str = ""

class PlaygroundResponse(BaseModel):
    score: float = 0.0
    reasoning: str = ""
    model: str = ""
    latency_ms: float = 0.0
    usage: Dict[str, int] = {}

# ─── 6. Compare (A/B Diff View) ──────────────────────────────────

class CompareResponse(BaseModel):
    base_run: RunResponse
    target_run: RunResponse
    base_items: List[ItemResponse]
    target_items: List[ItemResponse]
