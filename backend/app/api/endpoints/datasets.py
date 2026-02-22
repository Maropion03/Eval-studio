"""
Eval Studio — Datasets API Endpoints

Supports JSON body creation and JSONL/JSON file upload.
"""

import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_session_id
from app.models.models import Dataset
from app.schemas.schemas import DatasetCreate, DatasetResponse

router = APIRouter(prefix="/datasets", tags=["datasets"])

# ── Auto-Seeding: The "Demo Data" Logic ──────────────────

DEMO_DATA = [
    {
        "query": "Calculate the 10th Fibonacci number in Python.",
        "context": "The Fibonacci sequence is a series of numbers where a number is the addition of the last two numbers, starting with 0 and 1.",
        "response": "def fib(n):\n    if n <= 1: return n\n    return fib(n-1) + fib(n-2)\n\nprint(fib(10))",
        "ground_truth": "The 10th Fibonacci number is 55. The provided code is correct but inefficient for large n.",
    },
    {
        "query": "How do I center a div?",
        "context": "CSS Flexbox and Grid are modern layout modules.",
        "response": "div { margin: 0 auto; }",
        "ground_truth": "To center a div horizontally and vertically, use flexbox:\n.parent { display: flex; justify-content: center; align-items: center; }",
    },
    {
        "query": "Explain quantum entanglement.",
        "context": "Quantum entanglement is a physical phenomenon that occurs when a group of particles are generated, interact, or share spatial proximity in a way such that the quantum state of each particle of the group cannot be described independently of the state of the others.",
        "response": "It's when particles are connected in a way that the state of one instantly influences the other, regardless of distance.",
        "ground_truth": "Correct. It implies non-local correlations between particle properties.",
    },
]


def seed_demo_data(db: Session, session_id: str):
    """Create a default demo dataset for a new session."""
    dataset = Dataset(
        id=f"ds-demo-{session_id[:8]}",
        session_id=session_id,
        name="Demo Dataset (General Knowledge)",
        item_count=len(DEMO_DATA),
        raw_data=DEMO_DATA,
        status="ready",
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


# ── Endpoints ────────────────────────────────────────────


@router.get("", response_model=list[DatasetResponse])
def list_datasets(
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
):
    """
    List all datasets for the current session.
    Auto-seeds demo data if the session is empty.
    """
    datasets = (
        db.query(Dataset)
        .filter(Dataset.session_id == session_id)
        .order_by(Dataset.created_at.desc())
        .all()
    )

    # Auto-Seed if empty
    if not datasets:
        demo_ds = seed_demo_data(db, session_id)
        return [demo_ds]

    return datasets


@router.post("", response_model=DatasetResponse, status_code=201)
def create_dataset(
    payload: DatasetCreate,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
):
    """Create a new dataset from JSON body."""
    dataset = Dataset(
        session_id=session_id,
        name=payload.name,
        item_count=len(payload.items),
        raw_data=payload.items,
        status="ready",
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


@router.post("/upload", response_model=DatasetResponse, status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(None),
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
):
    """
    Upload a JSONL/JSON file to create a dataset.
    Each line/item should be a JSON object with: query, context, response, ground_truth.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if not file.filename.endswith((".jsonl", ".json")):
        raise HTTPException(
            status_code=400,
            detail="Only .jsonl and .json files are supported",
        )

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    items = []
    errors = []

    # Parse content: Try JSON Array first, then fallback to JSON Lines
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            items = parsed
        elif isinstance(parsed, dict) and "items" in parsed and isinstance(parsed["items"], list):
            items = parsed["items"]
        else:
            raise ValueError("Not a JSON array")
    except (json.JSONDecodeError, ValueError):
        # Strategy 2: JSON Lines (NDJSON)
        items = []
        lines = text.strip().split("\n")
        for i, line in enumerate(lines, 1):
            line = line.strip()
            if not line:
                continue
            try:
                items.append(json.loads(line))
            except json.JSONDecodeError as e:
                errors.append(f"Line {i}: {str(e)}")

    if errors:
        raise HTTPException(
            status_code=400,
            detail=f"JSONL parse errors: {'; '.join(errors[:3])}...",
        )

    if not items:
        raise HTTPException(status_code=400, detail="File contains no items")

    # Validate required fields
    required_fields = {"query", "context", "response"}
    for i, item in enumerate(items):
        missing = required_fields - set(item.keys())
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Item {i+1} missing required fields: {', '.join(missing)}",
            )

    dataset_name = name or file.filename.rsplit(".", 1)[0]

    dataset = Dataset(
        session_id=session_id,
        name=dataset_name,
        item_count=len(items),
        raw_data=items,
        status="ready",
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
):
    """Get a single dataset by ID (Scoped to Session)."""
    dataset = (
        db.query(Dataset)
        .filter(Dataset.id == dataset_id, Dataset.session_id == session_id)
        .first()
    )
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.get("/{dataset_id}/items")
def get_dataset_items(
    dataset_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
):
    """Get the raw data rows of a dataset (paginated)."""
    dataset = (
        db.query(Dataset)
        .filter(Dataset.id == dataset_id, Dataset.session_id == session_id)
        .first()
    )
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    items = dataset.raw_data or []
    return {
        "total": len(items),
        "items": items[skip : skip + limit],
    }


@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
):
    """Delete a dataset and all associated runs."""
    dataset = (
        db.query(Dataset)
        .filter(Dataset.id == dataset_id, Dataset.session_id == session_id)
        .first()
    )
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    db.delete(dataset)
    db.commit()
    return None
