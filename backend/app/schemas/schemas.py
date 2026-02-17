from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

# ─── 1. App Settings ──────────────────────────────────────────────
class AppSettingsBase(BaseModel):
    system_prompt: Optional[str] = None
    low_score_threshold: float = 0.6

class AppSettingsCreate(AppSettingsBase):
    pass

class AppSettings(AppSettingsBase):
    id: int
    updated_at: datetime

    class Config:
        from_attributes = True

# ─── 2. Evaluation Items ──────────────────────────────────────────
class EvaluationItemBase(BaseModel):
    query: str
    context: str
    response: str
    ground_truth: Optional[str] = None
    scores: Dict[str, float]
    reasoning: Optional[str] = None
    usage: Dict[str, int] = {}

class EvaluationItemCreate(EvaluationItemBase):
    run_id: str

class EvaluationItem(EvaluationItemBase):
    id: int
    run_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# ─── 3. Datasets ──────────────────────────────────────────────────
class DatasetBase(BaseModel):
    name: str

class DatasetCreate(DatasetBase):
    pass

class Dataset(DatasetBase):
    id: str
    created_at: datetime
    file_path: str
    item_count: int = 0
    status: str = "ready"

    class Config:
        from_attributes = True

# Alias for API responses
class DatasetResponse(Dataset):
    pass

# ─── 4. Evaluation Runs ───────────────────────────────────────────
class EvaluationRunBase(BaseModel):
    dataset_id: str
    model: str
    metrics: List[str] = ["faithfulness", "relevance", "coherence"]

class EvaluationRunCreate(EvaluationRunBase):
    pass

class EvaluationRun(EvaluationRunBase):
    id: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    status: str
    total_items: int = 0
    completed_items: int = 0
    average_scores: Optional[Dict[str, float]] = None
    session_id: str

    class Config:
        from_attributes = True

# Alias for API responses
class RunResponse(EvaluationRun):
    pass

# ─── 5. Playground ────────────────────────────────────────────────
class PlaygroundRequest(BaseModel):
    system_prompt: str
    user_input: str
    context: str
    model: str

class PlaygroundResponse(BaseModel):
    response: str
    scores: Dict[str, float]
    usage: Dict[str, int]
    latency_ms: float

# ─── 6. Compare (Diff View) ───────────────────────────────────────
# Define ItemResponse alias for Compare
class ItemResponse(EvaluationItem):
    pass

class CompareResponse(BaseModel):
    run_a: RunResponse
    run_b: RunResponse
    items_a: List[ItemResponse]
    items_b: List[ItemResponse]
    common_items_count: int
