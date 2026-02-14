
<div align="center">

# Eval Studio

### 现代化的、基于会话的 LLM 评估平台。

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

![Dashboard Screenshot](docs/dashboard.png)

</div>

## 简介

**问题:** 在开发过程中，并行比较不同 LLM 的输出极其繁琐。工程师们经常被迫使用电子表格或零散的脚本，很难直观地发现模型幻觉、推理错误或能力退化。

**解决方案:** **Eval Studio** 是一个本地优先、注重隐私的评估工作室，专为速度和清晰度而设计。它提供了一个临时的、基于会话的工作区，用于测试 Prompt、运行数据集，并分析 **SiliconFlow (硅基流动)、OpenAI、DeepSeek (深度求索)、Moonshot (月之暗面)** 等模型的表现。

---

## 核心特性

🎨 **Linear 风格 UI**
基于 **Tailwind CSS** 和 **Phosphor Icons** 构建的清爽、无干扰界面。拥有精心打磨的深色模式，带有微妙的环境光和玻璃拟态效果。

🔐 **隐私优先 (BYOK)**
您的 API Key 永远不会离开您的浏览器或本地后端。Eval Studio 采用 **Bring Your Own Key (自带密钥)** 架构，确保您的数据和凭据完全由您掌控。

⚡ **会话隔离 (Session Isolation)**
无需登录。每次刷新浏览器都会生成一个临时的 `session_id`，为您提供一个全新的、隔离的工作区。非常适合快速实验和演示，不会留下持久的混乱数据。“刷新即重置”。

🤖 **多模型支持**
无缝切换不同的模型和提供商。支持任何兼容 OpenAI 格式的 API，包括 **DeepSeek**、**Moonshot**、**SiliconFlow** 以及自定义的本地端点（如 vLLM, Ollama）。

📊 **可视化分析**
即时可视化 **真实性 (Faithfulness)**、**相关性 (Relevance)** 和 **连贯性 (Coherence)** 等指标。结果页面提供详细的图表和 Diff 视图，精准定位幻觉和推理错误。

---

## 技术栈

### 前端 (Frontend)
-   **核心:** React 18, TypeScript, Vite
-   **样式:** Tailwind CSS, Phosphor Icons
-   **状态/数据:** TanStack Query, React Router
-   **可视化:** Recharts

### 后端 (Backend)
-   **框架:** FastAPI, Pydantic
-   **数据库:** SQLite (SQLAlchemy ORM)
-   **LLM 引擎:** LiteLLM (通用 API 包装器)

---

## 快速开始

### 前置要求
-   **Node.js** (v18+)
-   **Python** (v3.10+)

### 1. 启动后端

```bash
cd backend

# 创建并激活虚拟环境
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 运行服务器
uvicorn app.main:app --reload
```
*后端 API 将运行在 `http://localhost:8000`。*

### 2. 启动前端

```bash
# 在新终端中
npm install
npm run dev
```
*前端页面将打开于 `http://localhost:5173`。*

---

## 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件。
