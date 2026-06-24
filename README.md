<div align="center">

# Eval Studio · v2

### Prompt regression testbench for AI PMs.

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

## Why it exists

AI PMs change a Prompt every week. None of them have a way to know — before
shipping — whether the change broke another case. The tooling that exists
(LangSmith, Braintrust, Langfuse) is engineer-shaped, outputs metrics like
`Faithfulness 0.87` that no executive reviewer can act on, and lives miles
away from the moment a product team has to choose a model.

**Eval Studio v2** is a regression testbench shaped for the *decision*:
configure a matrix experiment, watch trials stream live, get a printable
*Decision Book* that an engineer, a compliance lead, and a CEO can each
read without translation.

---

## Two visual modes, one product

| Mode | Where | Aesthetic |
|---|---|---|
| **Terminal Lab** | experimentation pages | NASA mission control × Bloomberg terminal × 70s CRT |
| **Bureau Report** | the Decision Book artifact | cream paper × Newsreader serif × seal red |

The transition between them — same product, different surface — is the
core narrative: experimentation feels like a lab; decisions look like
a memo your CEO would print.

---

## Pages

1. `/`               · **Experiments** — sparkline log of every run
2. `/new`            · **New Run wizard** — Dataset × Variables × Judges, live cost/ETA
3. `/runs/:id/live`  · **Live progress** — per-model lanes + scrolling trial log + COMPLETE state
4. `/runs/:id`       · **Run Report** — three tabs
    - `Matrix` · 4 × 4 scoreboard with L0-L3 severity dots + Δ vs baseline
    - `Analysis` · Pareto scatter + Radar + Severity stacked bar
    - `Decision Book` · 4-section Bureau-form memo with three stakeholder narratives

---

## Methodology

### Judge dimensions (replace `Faithfulness/Relevance/Coherence`)
- `fact_accuracy`       — numeric/date/entity match, 1:1 required
- `hallucination_severity` — L0 (no harm) / L1 (data drift) / L2 (compliance event) / L3 (decision-grade error)
- `citation_recall`     — must-cite-sources coverage (compliance scenarios)
- `forbidden_hit`       — red-line phrase detection
- `pareto`              — derived, places model on cost-vs-accuracy frontier

### Starter pack (4 scenarios · 140 seed cases)
- **Financial QA** — number-dense QA over Chinese A-share quarterly reports
- **Compliance Audit** — clause citation + violation classification
- **Research Summary** — long-context faithful summarization
- **Fraud Detection** — multi-signal anomaly identification, related-party hop-depth

Schema: [`docs/dataset-schema.json`](docs/dataset-schema.json)
Examples: [`docs/dataset-examples.json`](docs/dataset-examples.json)
PRD: [`docs/prd-v2.md`](docs/prd-v2.md)

---

## Tech stack

### Frontend (`/`)
- **React 19 + TypeScript + Vite**
- **Tailwind 4** (with extensive design tokens in `src/index.css`)
- Typography: VT323 (CRT) + IBM Plex Mono + JetBrains Mono + Space Mono + Newsreader (serif, Bureau Report only)

### Backend (`/backend`)
- **FastAPI** + **SQLAlchemy 2.0 (async)** + **asyncpg / aiosqlite**
- **LiteLLM** for unified provider access (SiliconFlow, DeepSeek, OpenAI, …)
- **Alembic** for migrations
- **slowapi** for rate limiting
- **sse-starlette** for live progress streaming

### Storage
- Neon Postgres (production) / SQLite (local dev fallback)
- 6 tables: `sessions ─< experiments ─< runs ─< trials` + `datasets ─< cases`

---

## Quickstart

### 1 · Backend

```bash
cd backend

# uv (recommended) — installs to .venv
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python -e .

# config
cp .env.example .env.local
# fill in SILICONFLOW_API_KEY (or BYOK from the UI at runtime)

# create schema (uses SQLite if DATABASE_URL is empty)
.venv/bin/python -m alembic upgrade head

# (optional) generate + load starter datasets
.venv/bin/python -m app.fixtures.seed --smoke         # 8 sample cases, no DB
.venv/bin/python -m app.fixtures.seed                 # full bulk + DB write

# run
.venv/bin/uvicorn app.main:app --reload --port 8000
```

API at `http://localhost:8000`. Docs at `/api/docs`.

### 2 · Frontend

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Companion project · "AI Evaluation, two ways"

This pairs with [**PRD 智能评审工作台**](#) — same `AI Evaluation` mother
theme, two product shapes:

- *PRD 评审 workbench* — evaluating **content** (a PRD → improvement notes)
- *Eval Studio* — evaluating **models** (N candidates → selection memo)

Different products. Different decisions. One thesis: evaluation is the
hidden bottleneck in shipping AI products, and AI PMs need tools that
speak in decisions, not metrics.

---

## License

MIT — see [LICENSE](LICENSE).
