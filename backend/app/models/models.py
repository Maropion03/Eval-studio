"""
Eval Studio — SQLAlchemy ORM Models
Mirrors the frontend types.ts definitions.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Text,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def generate_uuid() -> str:
    return str(uuid.uuid4())[:8]


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, default=lambda: f"ds-{generate_uuid()}")
    session_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    item_count = Column(Integer, default=0)
    status = Column(String, default="ready")  # ready | evaluating | completed
    raw_data = Column(JSON, nullable=True)  # Parsed JSONL rows
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    runs = relationship("EvaluationRun", back_populates="dataset", cascade="all, delete-orphan")


class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"

    id = Column(String, primary_key=True, default=lambda: f"run-{generate_uuid()}")
    session_id = Column(String, index=True, nullable=False)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    dataset_name = Column(String, nullable=False)
    model = Column(String, nullable=False)
    metrics = Column(JSON, default=list)  # ["faithfulness", "relevance", "coherence"]
    system_prompt = Column(Text, nullable=True)
    status = Column(String, default="running")  # running | completed | failed
    total_items = Column(Integer, default=0)
    completed_items = Column(Integer, default=0)  # For progress tracking
    average_scores = Column(JSON, nullable=True)  # {faithfulness, relevance, coherence}
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    dataset = relationship("Dataset", back_populates="runs")
    items = relationship("EvaluationItem", back_populates="run", cascade="all, delete-orphan")


class EvaluationItem(Base):
    __tablename__ = "evaluation_items"

    id = Column(String, primary_key=True, default=lambda: f"eval-{generate_uuid()}")
    session_id = Column(String, index=True, nullable=False)
    run_id = Column(String, ForeignKey("evaluation_runs.id"), nullable=False)
    query = Column(Text, nullable=False)
    context = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    ground_truth = Column(Text, default="")
    scores = Column(JSON, nullable=True)  # {faithfulness, relevance, coherence}
    reasoning = Column(Text, nullable=True)
    failure_type = Column(String, nullable=True)  # Retrieval_Failure | Reasoning_Error | Safety_Refusal
    hallucination_spans = Column(JSON, nullable=True)  # [{start, end, text}]
    usage = Column(JSON, nullable=True)  # {prompt_tokens, completion_tokens}

    # Relationships
    run = relationship("EvaluationRun", back_populates="items")


class AppSettings(Base):
    """Singleton table for global app configuration."""
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, default=1)
    system_prompt = Column(Text, nullable=True)
    low_score_threshold = Column(Float, default=0.7)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
