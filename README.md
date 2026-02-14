
<div align="center">

# Eval Studio

### A Linear-style, session-based LLM evaluation platform.

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

![Dashboard Screenshot](docs/dashboard.png)

</div>

## Introduction

**The Problem:** Evaluating and comparing LLM outputs side-by-side is tedious. Engineers often resort to spreadsheets or disparate scripts, making it hard to visualize hallucinations, reasoning errors, or regressions.

**The Solution:** **Eval Studio** is a local-first, privacy-focused evaluation studio designed for speed and clarity. It provides an ephemeral, session-based workspace to test prompts, run datasets, and analyze model performance across providers like **SiliconFlow, OpenAI, DeepSeek, Moonshot**, and more.

---

## Key Features

🎨 **Linear-style UI**
A clean, distraction-free interface built with **Tailwind CSS** and **Phosphor Icons**. Features a meticulously crafted dark mode with subtle ambient lighting and glassmorphism effects.

🔐 **Privacy First (BYOK)**
Your API keys never leave your browser or local backend. Eval Studio uses a **Bring Your Own Key** architecture, ensuring your data and credentials remain under your control.

⚡ **Session Isolation**
No login required. Every browser refresh generates a volatile `session_id`, giving you a fresh, isolated workspace. Perfect for quick experiments and demos without persistent clutter. "Refresh to reset."

🤖 **Multi-Provider Support**
Seamlessly switch between models and providers. Supports any OpenAI-compatible API, including **DeepSeek**, **Moonshot**, **SiliconFlow**, and custom local endpoints (e.g., vLLM, Ollama).

📊 **Visual Analytics**
Instantly visualize performance metrics like **Faithfulness**, **Relevance**, and **Coherence**. The Results page features comprehensive charts and a diff view to pinpoint hallucinations and reasoning errors.

---

## Tech Stack

### Frontend
-   **Core:** React 18, TypeScript, Vite
-   **Styling:** Tailwind CSS, Phosphor Icons
-   **State/Data:** TanStack Query, React Router
-   **Visualization:** Recharts

### Backend
-   **Framework:** FastAPI, Pydantic
-   **Database:** SQLite (SQLAlchemy ORM)
-   **LLM Engine:** LiteLLM (Universal API Wrapper)

---

## Getting Started

### Prerequisites
-   **Node.js** (v18+)
-   **Python** (v3.10+)

### 1. Start the Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload
```
*The backend API will run at `http://localhost:8000`.*

### 2. Start the Frontend

```bash
# In a new terminal
npm install
npm run dev
```
*The frontend will open at `http://localhost:5173`.*

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
