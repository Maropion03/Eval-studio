# Eval Studio v2 · User Guide

**Eval Studio** is a Prompt-regression testbench for AI PMs. You configure a
matrix experiment (Dataset × Variables × Judges), watch trials stream live, and
get a printable **Decision Book** an engineer, a compliance lead, and a CEO can
each read without translation.

This guide covers the four pages and the end-to-end workflow.

---

## 🚀 Quick Start

```bash
# 1 · Backend  (creates SQLite locally; runs keyless in mock mode)
cd backend
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python -e ".[dev]"
cp .env.example .env.local            # see "Running keyless" below
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m app.fixtures.load_from_json   # load the 4 starter datasets
.venv/bin/uvicorn app.main:app --reload --port 8000

# 2 · Frontend
npm install
npm run dev          # http://localhost:5173
```

### Running keyless (mock mode)

Set `MOCK_LLM=1` in `backend/.env.local` and the **entire pipeline runs with no
API key** — a deterministic offline model stands in for the candidate, judge,
and Decision-Book writer. This is ideal for demos, local development, and the
test suite. Results are realistic and repeatable (stronger model ids earn higher
pass rates). The Settings page shows a **MOCK MODE ACTIVE** banner while it's on.

For live model calls, set `MOCK_LLM=0` and supply a key — either a server key in
`.env.local` (`SILICONFLOW_API_KEY=…`) or per-session via the **Settings** page
(BYOK).

---

## 📚 The four pages

### 1 · Experiments (`/`)
The run ledger. Every experiment is one row with a sparkline of its key metric,
a status (`draft`/`running`/`done`/`failed`), Δ vs baseline, and cost. This is
your home base — start here, open any run, replay or share.

### 2 · New Run (`/new`)
A 3-step wizard:
- **Step 1 — Dataset**: pick a starter pack or one of your uploads.
- **Step 2 — Variables**: choose the axis you're testing — prompt versions,
  candidate models, and/or params (temperature). The N × M matrix is generated
  for you, with a live cost/ETA estimate.
- **Step 3 — Judges**: enable the business judge dimensions (below), then launch.

### 3 · Datasets (`/datasets`)
- **Starter pack** — 4 scenarios (Financial QA, Compliance Audit, Research
  Summary, Fraud Detection).
- **Inspect** — click any dataset to browse its cases: context, question,
  must-contain facts, must-cite sources, red-line forbidden claims, golden answer.
- **Upload** — drop a `.json` or `.csv` file. It's validated against the case
  schema on the way in; validation errors are listed per-case. Uploaded datasets
  are scoped to your session and can be deleted. (Schema: `docs/dataset-schema.json`.)

### 4 · Settings (`/settings`)
BYOK (bring your own key). Per-provider keys for SiliconFlow / DeepSeek / OpenAI,
held server-side against your anonymous session only. Each provider shows a
`CONFIGURED` / `NOT SET` indicator and can be cleared.

---

## 🧮 Methodology — business judge dimensions

Eval Studio replaces engineer-shaped metrics (Faithfulness / Relevance /
Coherence) with dimensions a product team can act on:

| Dimension | Meaning |
|---|---|
| `fact_accuracy` | Numeric / date / entity match — required facts must appear |
| `hallucination_severity` | **L0–L3** severity grade (the product IP) |
| `citation_recall` | Coverage of must-cite sources (compliance scenarios) |
| `forbidden_hit` | Red-line phrase detection |
| `pareto` | Derived — places each model on the cost-vs-accuracy frontier |

**Severity tiers** drive the whole narrative:
- **L0** — no harm. Facts present, no fabrication, no red line.
- **L1** — data drift. Minor numeric/date error, decision-safe.
- **L2** — compliance event. Wrong citation, missing source, regulated-domain error.
- **L3** — decision-grade error. Recommendation reversal, missed red flag, forbidden claim.

Scoring is hybrid: deterministic rule checks (facts/citations/forbidden) set a
floor, and a Judge LLM grades the nuance. If the Judge call fails, scoring falls
back to rules so a run never crashes.

---

## 📊 Run Report (`/runs/:id`)

Three tabs:
- **A · Matrix** — model × slice scoreboard with L0–L3 severity and Δ vs baseline.
- **B · Analysis** — Pareto scatter, radar, severity stacked bar.
- **C · Decision Book** — a Bureau-form memo: recommendation, cost/accuracy
  tradeoff, three stakeholder narratives (leadership / compliance / engineering),
  known risks, and a failure-case appendix. For a real run this is generated from
  your actual results.

**Export PDF** (top right of the report) jumps to the Decision Book and hands off
to your browser's *Save as PDF* — all the terminal chrome is hidden, so you get a
clean cream memo your CEO would print.

---

## ❓ FAQ

**Where is my data stored?**
Locally in `backend/data/eval-studio.db` (SQLite) unless `DATABASE_URL` points at
Postgres (Neon in production). Delete the SQLite file to reset.

**Which models are supported?**
Anything LiteLLM can reach — SiliconFlow, DeepSeek, OpenAI, and any
OpenAI-compatible endpoint. Add the provider key in Settings (BYOK) or in
`backend/.env.local`.

**Do I need a key to try it?**
No. Run with `MOCK_LLM=1` and the full experiment → live trials → Decision Book
flow works offline with deterministic results.
