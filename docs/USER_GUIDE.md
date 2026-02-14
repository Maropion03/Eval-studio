# Judge-Opus User Guide

Welcome to **Judge-Opus**, your local-first LLM evaluation platform. This guide will help you get the most out of the system.

## 🚀 Quick Start

Ensure you have followed the [Installation Steps](README.md#getting-started).

1.  **Start Backend**: `uvicorn app.main:app --reload` (Port 8000)
2.  **Start Frontend**: `npm run dev` (Port 5173)
3.  **Open Browser**: Visit `http://localhost:5173`

---

## 📚 Core Workflows

### 1. Managing Datasets
The foundation of any evaluation is good data.
-   **Navigate**: Click **Datasets** in the sidebar.
-   **Upload**: Drag & Drop a `.jsonl` or `.json` file into the upload zone.
    -   **Format Requirement**: Files must contain `query`, `response` (optional), and `context` (optional) fields.
-   **Inspect**: Click on a dataset to view its items in a table. You can search/filter items here.

### 2. Running an Evaluation
Once you have a dataset, you can evaluate it using an LLM Judge.
-   **Navigate**: Go to **Datasets** or **Dashboard**.
-   **Start**: Click the **"New Evaluation"** button (or "Evaluate" on a specific dataset).
-   **Configure**:
    -   **Dataset**: Select the dataset to evaluate.
    -   **Model**: Choose the Judge Model (e.g., `gpt-4`, `claude-3-opus`). *Note: Requires API keys in `.env`*.
    -   **Metrics**: Select metrics to score (Faithfulness, Relevance, Coherence, Hallucination).
-   **Run**: Click **"Start Evaluation"**. The system will process items in the background.

### 3. Analyzing Results
View detailed scores and insights.
-   **Navigate**: Click **Results** in the sidebar.
-   **Overview**: See average scores per metric and a distribution chart.
-   **Deep Dive**: Click on any row to expand the **Diff View**.
    -   **Hallucination Highlighting**: Spans of text identified as hallucinations are highlighted in red.
    -   **Reasoning**: Read the Judge's explanation for the score.
-   **Debug**: Found a bad result? Click **"Debug in Playground"** to send that exact case to the Playground for iteration.

### 4. The Playground (Prompt Engineering)
Iterate on your prompts in real-time.
-   **Navigate**: Click **Playground** in the sidebar.
-   **Left Column**: Edit the **System Prompt**. Use `{{context}}` variables.
-   **Middle Column**: Input **User Query** and **Context**.
-   **Right Column**: Click **"Run Evaluation"** to generate a response (simulated or real) and see the Judge's score immediately.
-   **Templates**: Use the dropdown to load standard prompt templates.

### 5. A/B Comparison (The Arena)
Compare two different runs to see if your changes improved performance.
-   **Navigate**: Go to **Comparison** (or select two runs in Dashboard and click "Compare").
-   **Selection**: Choose a **Baseline Connection** (Run A) and a **Candidate Connection** (Run B).
-   **The Grid**:
    -   View strictly matched items side-by-side.
    -   **Delta Scores**: See the score difference (e.g., `+1.5` 🟢 or `-0.5` 🔴).
    -   Identify regressions instantly.

### 6. Settings
Configure global behavior.
-   **Navigate**: Click **Settings** in the sidebar.
-   **System Prompt**: Edit the default prompt used for new evaluations.
-   **Thresholds**: Set the "Low Score Threshold" (default 0.7). Scores below this will be flagged as "Failure" in the UI.

---

## ❓ FAQ

**Q: Where is my data stored?**
A: Locally in `backend/data/judge_opus.db` (SQLite). You can delete this file to reset the database.

**Q: Which LLMs are supported?**
A: We use [LiteLLM](https://docs.litellm.ai/), so we support OpenAI, Anthropic, Azure, Ollama, and 100+ others. Just add the corresponding `_API_KEY` to your `backend/.env` file.
