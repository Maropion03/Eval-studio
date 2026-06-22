"""Async API tests via httpx ASGITransport with MOCK_LLM=1."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from app.main import app


def _new_client() -> httpx.AsyncClient:
    """A fresh client → fresh anonymous session cookie."""
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    )


# ── datasets listing / session cookie ─────────────────────────────


async def test_list_datasets_returns_starter(client, seeded_dataset):
    resp = await client.get("/api/datasets")
    assert resp.status_code == 200
    data = resp.json()
    ids = [d["id"] for d in data]
    assert seeded_dataset in ids
    starter = next(d for d in data if d["id"] == seeded_dataset)
    assert starter["is_starter"] is True
    # Session cookie was set on first request.
    assert "eval_studio_sid" in client.cookies
    assert client.cookies["eval_studio_sid"].startswith("ses_")


# ── settings ──────────────────────────────────────────────────────


async def test_settings_put_then_get_reflects_flags(client):
    put = await client.put(
        "/api/settings",
        json={"siliconflow_api_key": "sk-test-abc", "deepseek_api_key": "sk-ds"},
    )
    assert put.status_code == 200
    body = put.json()
    assert body["siliconflow_configured"] is True
    assert body["deepseek_configured"] is True
    assert body["openai_configured"] is False
    assert body["mock_llm"] is True

    get = await client.get("/api/settings")
    g = get.json()
    assert g["siliconflow_configured"] is True
    assert g["deepseek_configured"] is True
    assert g["mock_llm"] is True


# ── full experiment → run → report pipeline ───────────────────────


async def test_full_pipeline_experiment_run_report(client, seeded_dataset):
    # 1. create experiment
    exp_resp = await client.post(
        "/api/experiments",
        json={
            "title": "Mock pipeline test",
            "kind": "SELECT",
            "dataset_id": seeded_dataset,
            "variable_axes": {
                "prompts": [None],
                "models": ["deepseek-ai/DeepSeek-V4-Pro", "Qwen/Qwen2.5-7B-Instruct"],
                "params": {"temperature": 0.2},
            },
            "judge_dims": ["fact_accuracy", "hallucination_severity"],
        },
    )
    assert exp_resp.status_code == 200, exp_resp.text
    exp = exp_resp.json()
    assert exp["scenario"] == "financial_qa"
    assert exp["seq"] >= 1

    # 2. create + run
    run_resp = await client.post("/api/runs", json={"experiment_id": exp["id"]})
    assert run_resp.status_code == 200, run_resp.text
    run = run_resp.json()
    run_id = run["id"]
    assert run["status"] in {"queued", "running"}

    # 3. poll until done (mock completes fast)
    final = None
    for _ in range(120):
        await asyncio.sleep(0.05)
        r = await client.get(f"/api/runs/{run_id}")
        assert r.status_code == 200
        final = r.json()
        if final["status"] in {"done", "failed"}:
            break
    assert final is not None
    assert final["status"] == "done", f"run did not finish: {final}"
    # 2 models × 1 case × 1 prompt = 2 trials.
    assert final["trials_done"] == 2
    assert final["trial_count"] == 2

    # 4. report
    rep_resp = await client.get(f"/api/runs/{run_id}/report")
    assert rep_resp.status_code == 200, rep_resp.text
    rep = rep_resp.json()
    assert rep["run"]["status"] == "done"
    models = {c["model"] for c in rep["candidates"]}
    assert "deepseek-ai/DeepSeek-V4-Pro" in models
    assert "Qwen/Qwen2.5-7B-Instruct" in models
    for c in rep["candidates"]:
        assert 0.0 <= c["pass_rate"] <= 1.0
    # decision_book is composed by the mock writer.
    assert rep["decision_book"] is not None
    book = rep["decision_book"]
    assert "recommendation" in book
    assert "narratives" in book


async def test_create_run_requires_experiment(client):
    resp = await client.post("/api/runs", json={"experiment_id": None})
    assert resp.status_code == 400


async def test_create_experiment_unknown_dataset_404(client):
    resp = await client.post(
        "/api/experiments",
        json={
            "title": "bad",
            "kind": "SELECT",
            "dataset_id": "ds_doesnotexist",
            "variable_axes": {"models": ["gpt-4o"]},
            "judge_dims": ["fact_accuracy"],
        },
    )
    assert resp.status_code == 404


# ── upload / cases / delete ───────────────────────────────────────


_VALID_UPLOAD = {
    "scenario": "financial_qa",
    "cases": [
        {
            "case_id": "u-001",
            "input": {"question": "营收多少？", "context": "营业收入 10 亿元。"},
            "reference": {"must_contain_facts": ["营业收入 10 亿元"], "golden_answer": "10亿"},
            "risk_tier": "L2",
            "difficulty": "medium",
        }
    ],
}


async def test_upload_valid_then_cases_then_delete(client):
    files = {"file": ("ds.json", json.dumps(_VALID_UPLOAD).encode("utf-8"), "application/json")}
    up = await client.post("/api/datasets/upload", files=files, data={"name": "My Upload"})
    assert up.status_code == 201, up.text
    ds = up.json()
    assert ds["is_starter"] is False
    assert ds["name"] == "My Upload"
    assert ds["cases_count"] == 1
    assert ds["scenario"] == "financial_qa"
    ds_id = ds["id"]

    # cases visible to owning session
    cases_resp = await client.get(f"/api/datasets/{ds_id}/cases")
    assert cases_resp.status_code == 200
    cdata = cases_resp.json()
    assert cdata["total"] == 1
    assert cdata["cases"][0]["case_code"] == "u-001"
    assert cdata["cases"][0]["question"] == "营收多少？"

    # delete → 204
    dele = await client.delete(f"/api/datasets/{ds_id}")
    assert dele.status_code == 204

    # gone afterwards
    gone = await client.get(f"/api/datasets/{ds_id}/cases")
    assert gone.status_code == 404


async def test_upload_invalid_returns_422_with_errors(client):
    bad = {"cases": [{"input": {"context": "x"}, "reference": {}}]}  # missing question + ref
    files = {"file": ("bad.json", json.dumps(bad).encode("utf-8"), "application/json")}
    up = await client.post("/api/datasets/upload", files=files)
    assert up.status_code == 422
    detail = up.json()["detail"]
    assert "errors" in detail
    assert len(detail["errors"]) >= 1


async def test_upload_empty_file_returns_422(client):
    files = {"file": ("empty.json", b"   ", "application/json")}
    up = await client.post("/api/datasets/upload", files=files)
    assert up.status_code == 422
    assert "errors" in up.json()["detail"]


async def test_cross_session_cannot_read_upload():
    """A second session (fresh cookie) cannot read another session's upload."""
    files = {"file": ("ds.json", json.dumps(_VALID_UPLOAD).encode("utf-8"), "application/json")}

    async with _new_client() as owner:
        up = await owner.post("/api/datasets/upload", files=files)
        assert up.status_code == 201
        ds_id = up.json()["id"]
        # owner can see it
        assert (await owner.get(f"/api/datasets/{ds_id}/cases")).status_code == 200

    async with _new_client() as intruder:
        # fresh cookie → different session → 404
        resp = await intruder.get(f"/api/datasets/{ds_id}/cases")
        assert resp.status_code == 404
        # and it's not in their dataset list either
        listing = await intruder.get("/api/datasets")
        assert ds_id not in [d["id"] for d in listing.json()]
