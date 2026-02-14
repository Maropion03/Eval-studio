"""
End-to-end test script for Eval Studio Backend (Phase 1-3).
Run this while the server is running on port 8000.
"""

import requests
import time
import json
import tempfile
import os

BASE = "http://localhost:8000"


def test_health():
    r = requests.get(f"{BASE}/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    print("✅ /health OK")
    return data


def test_playground():
    r = requests.post(f"{BASE}/api/playground/evaluate", json={
        "system_prompt": "You are a fair judge. Evaluate {{metric}}.",
        "query": "How to reset password?",
        "context": "Click forgot password, enter email, click reset link.",
        "response": "Click forgot password and enter email.",
        "model": "gpt-4",
        "metric": "faithfulness",
    })
    assert r.status_code == 200
    data = r.json()
    assert "score" in data
    assert "reasoning" in data
    print(f"✅ /api/playground/evaluate → score={data['score']}, model={data['model']}")
    return data


def test_create_dataset_json():
    r = requests.post(f"{BASE}/api/datasets", json={
        "name": "JSON Body Dataset",
        "items": [
            {"query": "Q1", "context": "C1", "response": "R1", "ground_truth": "G1"},
            {"query": "Q2", "context": "C2", "response": "R2", "ground_truth": "G2"},
        ],
    })
    assert r.status_code == 201
    data = r.json()
    assert data["item_count"] == 2
    print(f"✅ POST /api/datasets (JSON body) → id={data['id']}, items={data['item_count']}")
    return data


def test_upload_dataset_jsonl():
    """Test JSONL file upload."""
    jsonl_content = "\n".join([
        json.dumps({"query": "密码重置", "context": "点击忘记密码", "response": "点击忘记密码链接", "ground_truth": "完整步骤"}),
        json.dumps({"query": "退货政策", "context": "30天退货", "response": "60天退货", "ground_truth": "30天"}),
        json.dumps({"query": "技术栈", "context": "React+Go+PG", "response": "React+Go+PG", "ground_truth": "React+Go+PG"}),
    ])

    # Create a temp .jsonl file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False, encoding="utf-8") as f:
        f.write(jsonl_content)
        tmp_path = f.name

    try:
        with open(tmp_path, "rb") as f:
            r = requests.post(
                f"{BASE}/api/datasets/upload",
                files={"file": ("test_data.jsonl", f, "application/octet-stream")},
                data={"name": "JSONL Upload Test"},
            )
        assert r.status_code == 201, f"Upload failed: {r.text}"
        data = r.json()
        assert data["item_count"] == 3
        assert data["name"] == "JSONL Upload Test"
        print(f"✅ POST /api/datasets/upload (JSONL) → id={data['id']}, items={data['item_count']}")
        return data
    finally:
        os.unlink(tmp_path)


def test_upload_dataset_json_file():
    """Test JSON array file upload."""
    json_content = json.dumps([
        {"query": "Q1", "context": "C1", "response": "R1"},
        {"query": "Q2", "context": "C2", "response": "R2"},
    ])

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        f.write(json_content)
        tmp_path = f.name

    try:
        with open(tmp_path, "rb") as f:
            r = requests.post(
                f"{BASE}/api/datasets/upload",
                files={"file": ("array_data.json", f, "application/json")},
            )
        assert r.status_code == 201, f"Upload failed: {r.text}"
        data = r.json()
        assert data["item_count"] == 2
        print(f"✅ POST /api/datasets/upload (JSON) → id={data['id']}, items={data['item_count']}")
        return data
    finally:
        os.unlink(tmp_path)


def test_dataset_items(dataset_id: str):
    r = requests.get(f"{BASE}/api/datasets/{dataset_id}/items")
    data = r.json()
    assert data["total"] > 0
    print(f"✅ GET /api/datasets/{dataset_id}/items → {data['total']} items")
    return data


def test_create_run(dataset_id: str) -> dict:
    r = requests.post(f"{BASE}/api/runs", json={
        "dataset_id": dataset_id,
        "model": "gpt-4",
        "metrics": ["faithfulness", "relevance", "coherence"],
    })
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "running"
    print(f"✅ POST /api/runs → id={data['id']}, status={data['status']}")
    return data


def test_poll_run(run_id: str) -> dict:
    for i in range(30):
        r = requests.get(f"{BASE}/api/runs/{run_id}")
        data = r.json()
        status = data["status"]
        completed = data["completed_items"]
        total = data["total_items"]
        print(f"   ⏳ Poll {i+1}: status={status}, progress={completed}/{total}")
        if status in ("completed", "failed"):
            break
        time.sleep(1)
    assert data["status"] == "completed", f"Run ended with status: {data['status']}"
    print(f"✅ Run completed: avg_scores={json.dumps(data['average_scores'])}")
    return data


def test_get_run_items(run_id: str) -> list:
    r = requests.get(f"{BASE}/api/runs/{run_id}/items")
    assert r.status_code == 200
    items = r.json()
    assert len(items) > 0
    for item in items:
        print(f"   📊 {item['query'][:25]}... → scores={json.dumps(item['scores'])}")
    print(f"✅ GET /api/runs/{run_id}/items → {len(items)} items")
    return items


def test_compare(run_a_id: str, run_b_id: str):
    r = requests.get(f"{BASE}/api/compare?baseId={run_a_id}&targetId={run_b_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["base_run"]["id"] == run_a_id
    assert data["target_run"]["id"] == run_b_id
    assert len(data["base_items"]) > 0
    assert len(data["target_items"]) > 0
    print(f"✅ GET /api/compare → base={len(data['base_items'])} items, target={len(data['target_items'])} items")
    return data


def test_settings():
    r = requests.get(f"{BASE}/api/settings")
    assert r.status_code == 200
    data = r.json()
    print(f"✅ GET /api/settings → threshold={data['low_score_threshold']}")

    r = requests.put(f"{BASE}/api/settings", json={
        "low_score_threshold": 0.65,
        "system_prompt": "Custom prompt for testing.",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["low_score_threshold"] == 0.65
    print(f"✅ PUT /api/settings → threshold={data['low_score_threshold']}")

    # Reset
    requests.put(f"{BASE}/api/settings", json={"low_score_threshold": 0.7})
    return data


def test_delete_dataset(dataset_id: str):
    r = requests.delete(f"{BASE}/api/datasets/{dataset_id}")
    assert r.status_code == 204
    print(f"✅ DELETE /api/datasets/{dataset_id}")


if __name__ == "__main__":
    print("=" * 60)
    print("Eval Studio Backend E2E Test (Phase 1-3)")
    print("=" * 60)

    # Phase 1: Basic CRUD
    test_health()

    # Phase 2: Evaluation engine
    test_playground()

    # Phase 3: JSONL Upload
    ds_json = test_create_dataset_json()
    ds_jsonl = test_upload_dataset_jsonl()
    ds_json_file = test_upload_dataset_json_file()
    test_dataset_items(ds_jsonl["id"])

    # Batch evaluation on uploaded dataset
    run_a = test_create_run(ds_jsonl["id"])
    run_a = test_poll_run(run_a["id"])
    test_get_run_items(run_a["id"])

    # Second run for comparison
    run_b = test_create_run(ds_jsonl["id"])
    run_b = test_poll_run(run_b["id"])

    # Phase 3: A/B Compare
    test_compare(run_a["id"], run_b["id"])

    # Settings
    test_settings()

    # Cleanup
    test_delete_dataset(ds_json["id"])
    test_delete_dataset(ds_json_file["id"])
    # Keep ds_jsonl for demo

    print("=" * 60)
    print("🎉 All Phase 1-3 tests passed!")
    print("=" * 60)
