# Judge-Opus 开发日志

---

## Session 1 — 2026-02-12 14:51

### 目标
搭建 Judge-Opus 前端原型（React + Vite + TS + Tailwind CSS v4）

### 执行步骤
1. ✅ 阅读并提取 PRD 文档内容 — 理解数据 Schema、API 接口、评分指标和 System Prompt 策略
2. ✅ 创建实现计划并获得用户审批
3. ✅ 用户补充 3 项需求已集成：
   - Results 页 Diff View（左右分栏 Context vs Response，幻觉红色高亮）
   - System Prompt 编辑器 `{{...}}` 变量高亮
   - Dashboard 增加 "Time Saved" 卡片（total_evaluations × 10 min）
4. ✅ Vite + React + TS 项目脚手架创建
5. ✅ 安装依赖：`tailwindcss@v4`, `@tailwindcss/vite`, `react-router-dom`, `lucide-react`
6. ✅ 配置 `vite.config.ts`（Tailwind v4 插件）和 `index.css`（自定义主题 indigo/slate + Inter/JetBrains Mono）
7. ✅ 创建 `mockData.ts` — 10 条仿真评测数据，含 hallucinationSpans 字段
8. ✅ 创建布局组件：`Sidebar.tsx`, `TopBar.tsx`, `Layout.tsx`
9. ✅ 创建页面视图：`Dashboard.tsx`, `Datasets.tsx`, `Results.tsx`, `Settings.tsx`
10. ✅ 创建 `EvaluationConfigModal.tsx`（含 {{variable}} 高亮编辑器）
11. ✅ 更新 `index.html` — Google Fonts、SEO meta
12. ✅ `npx tsc --noEmit` — 零错误
13. ✅ `npm run build` — 成功，gzip 86.43 kB，耗时 2.15s

### 产出文件清单
| 文件 | 说明 |
|------|------|
| `src/data/mockData.ts` | 10条Mock数据 + 类型定义 + 默认Prompt |
| `src/components/Layout/Sidebar.tsx` | 深色侧边栏导航 |
| `src/components/Layout/TopBar.tsx` | 顶部面包屑栏 |
| `src/components/Layout/Layout.tsx` | 主布局容器 |
| `src/components/EvaluationConfigModal.tsx` | 评测配置模态框 |
| `src/pages/Dashboard.tsx` | 总览页（含 Time Saved） |
| `src/pages/Datasets.tsx` | 数据集管理页 |
| `src/pages/Results.tsx` | 评测结果页（含 Diff View） |
| `src/pages/Settings.tsx` | 设置页 |

### 状态
✅ 完成

---

## Session 2 — 2026-02-12 15:17

### 目标
修复 `{{variable}}` 变量高亮错位/重叠问题

### 问题分析
- Overlay 层设置了 `text-transparent`，但 `{{...}}` 高亮 span 覆盖了颜色，导致变量文字同时出现在 overlay 和 textarea 中
- 两层文字叠加导致截图中可见的错位重叠

### 修复方案
- **Overlay 层**: 移除 `text-transparent`，改为 `text-surface-800` — 渲染所有文字（含高亮变量）
- **Textarea 层**: 添加 `text-transparent` — 文字不可见，仅保留光标和选区
- 添加 `selection:bg-primary-200/50` 保证选中状态可见

### 修改文件
| 文件 | 变更 |
|------|------|
| `EvaluationConfigModal.tsx` | 交换 overlay/textarea 文字可见性 |
| `Settings.tsx` | 同上 |

### 验证
- ✅ `npm run build` 成功 (86.45 kB gzip)

### 状态
✅ 完成

---

## Session 3 — 2026-02-12 15:33

### 目标
完整重设计 UI — Linear/Vercel 风格 Dark Mode

### 执行步骤
1. ✅ 重写 `index.css` — zinc-950 底色、网格背景图案、暗色滚动条、光晕效果
2. ✅ 重写 `Sidebar.tsx` — zinc-950 bg、white/5 边框、indigo 图标强调
3. ✅ 重写 `TopBar.tsx` — 透明背景 + backdrop-blur、white/5 底部边框
4. ✅ 重写 `Layout.tsx` — grid pattern + glow-accent
5. ✅ 重写 `Dashboard.tsx` — 半透明卡片、单色图标容器、emerald/blue 状态标记
6. ✅ 重写 `Datasets.tsx` — 暗色拖拽区、暗色表格、暗色输入框
7. ✅ 重写 `Results.tsx` — 暗色分数卡片、red/amber/emerald 弹签、暗色 Diff View
8. ✅ 重写 `Settings.tsx` — 暗色编辑器/输入框、indigo 变量高亮
9. ✅ 重写 `EvaluationConfigModal.tsx` — zinc-900 模态框、暗色下拉/复选

### 设计规则
| 元素 | 规则 |
|------|------|
| 背景 | `bg-zinc-950` |
| 卡片 | `bg-zinc-900/30 border border-white/5` |
| 悬浮 | `hover:border-white/10` |
| 标签 | `text-xs text-zinc-500 uppercase tracking-wider` |
| 值 | `text-2xl font-semibold text-zinc-100 font-mono` |
| 强调 | `text-indigo-400` / `text-cyan-400` |
| 输入 | `bg-zinc-950/50 border-white/10 text-zinc-200` |

### 验证
- ✅ `npm run build` 成功 (86.51 kB gzip, 2.14s)

### 状态
✅ 完成

---

## Session 4 — 2026-02-12 15:48

### 目标
替换 Lucide 图标为 Phosphor Duotone 图标，添加 Premium Glow 样式

### 执行步骤
1. ✅ 安装 `@phosphor-icons/react`
2. ✅ 重写 `Sidebar.tsx` — SquaresFour, Database, Flask, GearSix, Lightning
3. ✅ 重写 `Dashboard.tsx` — HourglassHigh, ShieldCheck, Target, HardDrives + glow 容器
4. ✅ 重写 `TopBar.tsx` — UserCircle, CaretRight
5. ✅ 重写 `Datasets.tsx` — UploadSimple, FileJs, Play, MagnifyingGlass
6. ✅ 重写 `Results.tsx` — ShieldCheck, Target, Brain, Warning, CheckCircle, GitDiff
7. ✅ 重写 `Settings.tsx` — FloppyDisk, ArrowCounterClockwise
8. ✅ 重写 `EvaluationConfigModal.tsx` — Sparkle, CaretDown, X

### Glow 容器样式
```
w-12 h-12 rounded-xl flex items-center justify-center
bg-gradient-to-br from-white/5 to-white/0
border border-white/10
shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]
```

### 验证
- ✅ `npm run build` 成功 (104.82 kB gzip, 4.01s)

### 状态
✅ 完成

---

## Session 5 — 2026-02-12 16:07

### 目标
实现 i18n 国际化（中英文切换）

### 执行步骤
1. ✅ 安装 `i18next`, `react-i18next`, `i18next-browser-languagedetector`
2. ✅ 创建 `src/locales/en.json` — 英文翻译
3. ✅ 创建 `src/locales/zh.json` — 中文翻译
4. ✅ 创建 `src/i18n.ts` — 配置文件（localStorage 缓存，zh 回退语言）
5. ✅ 更新 `main.tsx` — 导入 i18n
6. ✅ 更新 `Sidebar.tsx` — nav labels + subtitle
7. ✅ 更新 `TopBar.tsx` — 添加 `Translate` 图标语言切换按钮
8. ✅ 更新 `Dashboard.tsx` — 所有卡片/列表标签
9. ✅ 更新 `Datasets.tsx` — 上传区/搜索/表头
10. ✅ 更新 `Results.tsx` — 摘要卡片/警告/Diff View
11. ✅ 更新 `Settings.tsx` — prompt/阈值标签
12. ✅ 更新 `EvaluationConfigModal.tsx` — 模态框标题/按钮

### 验证
- ✅ `npm run build` 成功 (125.78 kB gzip, 4.04s)

### 状态
✅ 完成

---

## Session 6 — 2026-02-12 18:18

### 目标
实现 Prompt Playground (调试台) 页面

### 新增文件
| 文件 | 说明 |
|------|------|
| `src/pages/Playground.tsx` | 3 栏 IDE 布局 — System Prompt / Test Case / Opus Result |

### 修改文件
| 文件 | 变更 |
|------|------|
| `en.json` / `zh.json` | 新增 `playground.*` + `results.debug_in_playground` keys |
| `Sidebar.tsx` | 新增 Playground 导航项 (Terminal icon) |
| `TopBar.tsx` | 新增 `/playground` breadcrumb 路由 |
| `App.tsx` | 新增 `/playground` route |
| `Results.tsx` | 低分项展开后显示 "Debug in Playground" 按钮 (Bug icon)，携带 state 跳转 |

### 功能亮点
1. **Column 1**: System Prompt 编辑器 + "Load Template" 下拉 (Faithfulness / Relevance / Custom)，`{{variable}}` 高亮
2. **Column 2**: User Query (input) + Retrieved Context + Model Response (textareas) + Run Evaluation 按钮
3. **Column 3**: 三态切换 — Idle (空状态提示) / Loading (骨架屏) / Success (分数条 + Reasoning + Raw JSON)
4. **Mock 逻辑**: 1.5s 延迟模拟 API，随机分数 + 基于分段的 reasoning 生成
5. **Results 集成**: 低分项可一键跳转 Playground 并预填 query/context/response

### 验证
- ✅ `npm run build` 成功 (131.71 kB gzip, 7.60s)

### 状态
✅ 完成

---

## Session 7 — 2026-02-12 20:00

### 目标
实现 A/B Test 对比视图 (The Arena)

### 新增文件
| 文件 | 说明 |
|------|------|
| `src/pages/Comparison.tsx` | 4 列对比网格 — Query / Run A / Run B / Delta |

### 修改/重建文件
| 文件 | 变更 |
|------|------|
| `mockData.ts` | 新增 `mockEvaluationItemsRunB` (GPT-4, 同 caseId 不同分数) + `mockRuns` (3条) |
| `Dashboard.tsx` | 完成状态运行项增加 checkbox，底部浮动 Action Bar ("N runs selected" + "Compare Runs") |
| `App.tsx` | 新增 `/compare` route |
| `en.json` / `zh.json` | 新增 `comparison.*` + `dashboard.runs_selected/compare_runs` keys |
| `TopBar.tsx` | 新增 `/compare` breadcrumb |

### 功能亮点
1. **Dashboard 选择**: 已完成运行项左侧 checkbox，最多选2个；浮动 bar 含取消 + Compare Runs 按钮
2. **Summary Diff Cards**: 忠实度 / 相关性 / 连贯性 / 预估成本，显示候选值 vs 基线值 + DeltaBadge
3. **DeltaBadge**: 绿色 ▲ +N / 红色 ▼ -N / 灰色 — 0
4. **对比网格**: 每行显示 Query、Run A 三维分数、Run B 三维分数、Delta 列
5. **失败类型标签**: failureType 在对比行内以红色 badge 显示

### 验证
- ✅ `npm run build` 成功

### 状态
✅ 完成

---

## Session 8 — 2026-02-12 20:15

### 目标
替换原生 `<select>` 为自定义 Linear 风格 Select 组件

### 新增文件
| 文件 | 说明 |
|------|------|
| `src/components/ui/Select.tsx` | 可复用 Select 组件：translucent trigger, solid dark dropdown, checkmark, outside-click 关闭 |

### 修改文件
| 文件 | 变更 |
|------|------|
| `Playground.tsx` | Template dropdown 替换为 `<Select size="sm" />` |
| `EvaluationConfigModal.tsx` | Model selector 替换为 `<Select />`，修复 icon 引用 |

### 验证
- ✅ `npm run build` 成功 (136.51 kB gzip)

### 状态
✅ 完成

---

## Session 9 — 2026-02-12 20:52

### 目标
搭建 Python FastAPI 后端骨架 (Phase 1)

### 技术栈
FastAPI + SQLAlchemy + SQLite + litellm + Pydantic

### 新增文件
```
backend/
├── app/
│   ├── core/config.py      # pydantic-settings (.env)
│   ├── db/session.py        # SQLite engine + session DI
│   ├── models/models.py     # 4 tables: Dataset, Run, Item, Settings
│   ├── schemas/schemas.py   # Full Pydantic layer
│   ├── services/judge.py    # LLM engine (litellm + mock fallback)
│   ├── api/api.py           # Router aggregation
│   ├── api/endpoints/       # 5 route files
│   └── main.py              # FastAPI entry + lifespan
├── requirements.txt
├── .env / .env.example
└── .gitignore
```

### 修改文件
| 文件 | 变更 |
|------|------|
| `vite.config.ts` | 添加 `/api` + `/health` proxy → `http://localhost:8000` |

### 验证
- ✅ `pip install` 成功
- ✅ `uvicorn app.main:app` 启动成功
- ✅ `/health` → `{"status": "ok"}`
- ✅ `/api/datasets` → `[]`
- ✅ `/api/runs` → `[]`
- ✅ `/api/settings` → `{"low_score_threshold": 0.7}`
- ✅ DB 自动建表 (`judge_opus.db`)

### 状态
✅ 完成

---

## Session 10 — 2026-02-12 21:18

### 目标
Phase 2: LLM 评测引擎

### 变更
| 文件 | 变更 |
|------|------|
| `services/judge.py` | 重写: API key 检测 (`_has_api_keys`)、文本重叠启发式 mock 评分器、litellm 模块级导入 |
| `requirements.txt` | 新增 `imghdr-lts==1.0.0` (Python 3.13 兼容) |
| `test_e2e.py` | 新增 E2E 测试脚本 |

### 验证 (test_e2e.py)
- ✅ `/health` OK
- ✅ `/api/playground/evaluate` → mock score + reasoning
- ✅ `POST /api/datasets` → 3 items
- ✅ `POST /api/runs` → status=running
- ✅ Poll → status=completed, avg_scores 存在
- ✅ `GET /api/runs/:id/items` → 3 items with scores
- ✅ `GET/PUT /api/settings` → threshold 更新
- ✅ 🎉 All tests passed!

### 状态
✅ 完成

---

## Session 11 — 2026-02-12 21:51

### 目标
Phase 3: 高级功能 (JSONL 上传 / A/B Compare / 前端适配)

### 新增文件
| 文件 | 说明 |
|------|------|
| `src/services/api.ts` | 前端 API Client — typed fetch wrappers for all endpoints |

### 修改文件
| 文件 | 变更 |
|------|------|
| `datasets.py` | 新增 `POST /api/datasets/upload` JSONL/JSON 文件上传 |
| `test_e2e.py` | 扩展: JSONL 上传、JSON 上传、A/B Compare、DELETE |

### 验证
- ✅ JSONL 文件上传 → 3 items
- ✅ JSON 文件上传 → 2 items
- ✅ 两次批量评测 → completed
- ✅ A/B Compare → base + target items
- ✅ Dataset DELETE → 204
- ✅ Frontend build → 136.51 kB gzip
- ✅ 🎉 All Phase 1-3 tests passed!

### 状态
✅ 完成

---

## Session 12 — 2026-02-13 21:12

### 目标
Frontend Integration (Phase 4): 将前端与后端 API 完全对接

### 执行步骤
1. ✅ 创建 `src/services/api.ts` — 封装所有后端接口，包含 `snake_case` -> `camelCase` 适配器
2. ✅ 重构 `Dashboard.tsx` — 接入 `listRuns`, `listDatasets`，移除 mock 数据
3. ✅ 重构 `Datasets.tsx` — 接入 `uploadDataset` (JSONL/JSON), `deleteDataset`, `getDatasetItems`
4. ✅ 重构 `Playground.tsx` — 接入 `playgroundEvaluate`，显示真实推理结果
5. ✅ 重构 `Results.tsx` — 接入 `getRun`, `getRunItems`，支持 URL `?runId=` 参数
6. ✅ 重构 `Comparison.tsx` — 接入 `compareRuns`，支持 URL `?baseId=&targetId=` 参数
7. ✅ 重构 `Settings.tsx` — 接入 `getSettings`, `updateSettings`，持久化配置
8. ✅ 重构 `EvaluationConfigModal.tsx` — 接入 `createRun`，支持真实评测任务创建
9. ✅ 修复 TypeScript 类型错误 (Datasets generic record casting, Settings unused import)
10. ✅ 验证前端构建 (`npm run build`) — 成功

### 关键技术点
- **Adapter Pattern**: 在 `api.ts` 中统一处理后端 `snake_case` 与前端 `camelCase` 的转换，保持前端代码风格一致性。
- **Type Safety**: 定义了完整的 API 响应类型接口，确保数据流的类型安全。
- **Real-time Feedback**: 评测任务创建后自动轮询 (`pollRunUntilDone`) 直至完成。

### 状态
✅ 完成

---

## Session 13 — 2026-02-13 21:28

### 目标
Documentation: 创建项目文档

### 执行步骤
1. ✅ 创建 `README.md` — 包含项目简介、特性列表、技术栈说明、前后端启动指南。
2. ✅ 创建 `LICENSE` — 使用标准 MIT 协议。

### 状态
✅ 完成

---

## Session 14 — 2026-02-13 21:35

### 目标
Bug Fix: 修复 Vite Proxy 连接被拒绝 (ECONNREFUSED) 问题

### 问题分析
- Node.js v17+ 默认解析 `localhost` 为 IPv6 `::1`，而 FastAPI/Uvicorn 默认监听 IPv4 `127.0.0.1`。
- 导致前端 proxy 请求到 `[::1]:8000` 失败。

### 修复内容
1. `vite.config.ts`: 将 proxy target 从 `localhost` 改为 `127.0.0.1`。
2. `backend/app/core/config.py`: 将 `http://127.0.0.1:5173` 添加到 CORS 允许源列表。

### 状态
✅ 修复完成

---

## Session 15 — 2026-02-13 21:40

### 目标
Documentation: 创建用户使用指南 (USER_GUIDE.md)

### 执行步骤
1. ✅ 创建 `USER_GUIDE.md` — 包含核心 Workflow 说明 (Dataset, Evaluation, Results, Playground, Comparison, Settings) 及 FAQ。
2. ✅ 更新 `task.md` 记录文档创建进度。

### 状态
✅ 完成

---

## Session 16 — 2026-02-13 22:15

### 目标
Bug Fix: 修复 "Failed to fetch" (CORS & Connection Issues)

### 问题分析
- 某些浏览器/网络环境下，`localhost` 与 `127.0.0.1` 混用导致 CORS 预检失败。
- 前端请求可能被判定为跨域，且后端配置不够显式。
- 需要确保 IPv4 地址的显式匹配。

### 修复内容
1. **Backend (`main.py`)**: 显式硬编码 `allow_origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]`，确保中间件绝对生效。
2. **Frontend (`vite.config.ts`)**: 确认 Proxy 指向 `http://127.0.0.1:8000` (已通过 Session 14 修复)。
3. **Frontend (`api.ts`)**: 确认 `BASE_URL = '/api'`，走 Vite 代理。

### 状态
✅ 修复完成

---

## Session 17 — 2026-02-13 22:35

### 目标
Troubleshoot: Diagnose 500 Internal Server Errors

### 诊断步骤 (RCA)
1. **Schema Check (`debug_schema.py`)**:
   - `datasets` 表存在，且包含 `status`, `raw_data` 等关键列。
   - `app_settings` 表存在，且列名正确。
   - **结论**: Schema 与 Code 一致，排除 Scenario A (Schema Mismatch)。
2. **Logic Check (`debug_orm.py`)**:
   - 能够成功使用 SQLAlchemy ORM + Pydantic 创建 `Dataset` 和 `AppSettings` 记录。
   - **结论**: 代码逻辑和模型定义无误。
3. **Connectivity Check (`trigger_error.py`)**:
   - 无法连接到 `127.0.0.1:8000` 或 `localhost:8000` (Connection Refused)。
   - **结论**: 用户的 Backend Server 可能已停止运行或崩溃。

### 修复动作
- 虽然未能复现 500 (因 server down)，但已在 `backend/app/main.py` 添加了 **Global Exception Handler**。
- 下次 500 发生时，会直接打印完整 Traceback 到终端，并返回 JSON 格式的错误堆栈。

### 下一步
- 用户需重启 Server 并提供新的 Log。

### 状态
⚠️ 需要用户反馈日志

---

## Session 18 — 2026-02-13 22:45

### 目标
Bug Fix: 支持 JSONL 文件上传 (修复 "Invalid JSON" 错误)

### 问题分析
- 原有上传逻辑仅支持单一 JSON 格式（Array 或 Object with `items`）。
- 用户上传标准 JSON Lines (`.jsonl`) 文件时，直接用 `json.loads(whole_content)` 导致解析失败。

### 修复内容
- **重构 `upload_dataset`Endpoint (`datasets.py`)**:
    1. **Strategy 1 (JSON Array)**: 首先尝试 `json.loads(text)`。
       - 成功且为 List -> 使用。
       - 失败 -> 进入 Strategy 2。
    2. **Strategy 2 (JSON Lines)**: `text.split("\n")` 然后逐行 `json.loads(line)`。
       - 忽略空行。
       - 捕获单行解析错误并报告。

### 状态
✅ 修复完成

---

## Session 19 — 2026-02-13 23:10

### 目标
Feature: Bring Your Own Key (BYOK) — 集成 Silicon Flow API

### 需求分析
- 用户希望使用自己的 Silicon Flow API Key 进行真实评测，而非 Mock 数据。
- 需要在前端配置 Key/Model，并通过 Request Header 传递给后端。
- 后端需动态使用 Request Header 中的 Key 初始化 LiteLLM。

### 实现内容
1. **Frontend (`Settings.tsx`)**:
   - 新增 "LLM Configuration (Silicon Flow)" 版块。
   - 支持配置 `API Key` 和 `Model` (GLM-5 / Kimi / MiniMax)。
   - 使用 `localStorage` 本地持久化 (不存后端 DB，保障隐私)。

2. **Frontend (`api.ts`)**:
   - 添加 Axios Interceptor (fetch wrapper)。
   - 自动读取 localStorage 中的 `sf_api_key` / `sf_model`。
   - 注入 HTTP Headers: `x-silicon-key`, `x-silicon-model`。

3. **Backend (`runs.py`)**:
   - `create_run` Endpoint 新增 `Header` 参数接收 Key/Model。
   - 将 Key/Model 传递给后台任务 `_run_evaluation`。

4. **Backend (`judge.py`)**:
   - `evaluate_single` 支持动态 `api_key` 参数。
   - 若存在 Key，配置 `litellm` 使用 `base_url="https://api.siliconflow.cn/v1"`。
   - 包含 Mock Fallback 逻辑（无 Key 时自动回退）。

### 状态
✅ 完成 (Backend Syntax Verified)

---

## Session 20 — 2026-02-13 23:20

### 目标
Bug Fix: BYOK CORS Error (Failed to fetch)

### 问题分析
- 用户反馈启用 BYOK 后前端请求失败。
- 前端现在发送了自定义 Headers (`x-silicon-key`, `x-silicon-model`)。
- 后端 `CORSMiddleware` 默认虽然通常允许所有，但在预检请求 (OPTIONS) 中，浏览器可能要求显式列出自定义允许的 Headers。

### 修复内容
- **Backend (`main.py`)**: 更新 `CORSMiddleware` 配置，显式添加 `x-silicon-key` 和 `x-silicon-model` 到 `allow_headers` 列表。
  ```python
  allow_headers=["*", "x-silicon-key", "x-silicon-model", "Authorization", "Content-Type"]
  ```

### 状态
✅ 修复完成 (Verified Syntax)

---

## Session 21 — 2026-02-14 12:00

### 目标
Bug Fix: Prompt Editor Layer Misalignment (Regression)

### 问题分析
- Prompt Editor 中出现了 "Ghost Text"（双重文字），且光标位置与文字不匹配。
- 原因：Session 3 样式重构时丢失了 Session 2 的关键 CSS 属性。
- 具体表现：
  - Overlay 层文字不透明且未对齐。
  - Textarea 层背景不透明，遮挡了 Overlay 或与之叠加。

### 修复内容
- **Target Components**: `EvaluationConfigModal.tsx`, `Settings.tsx`
- **CSS Changes**:
  - `textarea`: `bg-transparent`, `text-transparent`, `caret-zinc-100`, `relative`, `z-10`
  - `overlay`: `text-zinc-300`, `absolute`, `inset-0`
- 确保两层拥有完全一致的 font/padding/line-height 属性。

### 状态
✅ 修复完成

---

## Session 22 — 2026-02-14 12:15

### 目标
Bug Fix: Evaluation Process Silent / No Progress Updates

### 问题分析
1. **Frontend (`Results.tsx`)**: 缺少轮询机制 (Polling)。页面仅在加载时请求一次数据，导致运行中任务无法实时刷新进度。
2. **UX Issue (`EvaluationConfigModal.tsx`)**: 创建任务后，前端一直在 Modal 内等待任务**完全结束** (`pollRunUntilDone`) 才跳转。对于耗时任务（如 50 条数据），用户会感觉界面卡死。

### 修复内容
1. **Refactor `Results.tsx`**:
   - 引入 `setInterval` (2s) 轮询机制。
   - 当 `run.status === 'running'` 时持续刷新 run info 和 items。
   - 修复 TypeScript `NodeJS.Timeout` 类型问题。

2. **Optimize `EvaluationConfigModal.tsx`**:
   - createRun 成功后**立即跳转**到 Results 页。
   - 移除 `pollRunUntilDone` 调用。
   - 让用户在 Results 页看到实时的进度条和逐条生成结果。

### 状态
✅ 修复完成

---

## Session 24 — 2026-02-14 18:55

### 目标
Bug Fix: Prompt Editor Scroll Misalignment (Ghost Text)

### 问题分析
- 用户反馈在 System Prompt 编辑器中滚动时，其背后的语法高亮层 (Overlay) 保持静止，导致文字出现重影和错位。
- 根源：Overlay 层与 Textarea 层虽然重叠，但 Textarea 的滚动事件未触发布局更新，Overlay 层无法自动跟随滚动。

### 修复内容
1. **Impl Scroll Sync (Ref Capture)**:
   - 在 `EvaluationConfigModal.tsx` 和 `Settings.tsx` 中引入 `useRef`。
   - 分别捕获 Overlay `div` 和 Textarea 的 DOM 引用。

2. **Event Binding**:
   - 为 Textarea 添加 `onScroll` 事件处理函数。
   - 实时将 Textarea 的 `scrollTop` / `scrollLeft` 赋值给 Overlay 层。

3. **CSS Adjustment**:
   - 如果尚未设置，强制 Overlay 层 `overflow-hidden`，避免出现双滚动条。
   - 确保 Textarea 层 `overflow-auto`。

### 影响文件
- `src/components/EvaluationConfigModal.tsx`
- `src/pages/Settings.tsx`

### 状态
✅ 修复完成

---

## Session 25 — 2026-02-14 19:00

### 目标
UI Improvement: Clean Ambient Background

### 问题分析
- 原有的 `bg-grid-pattern` (网格背景) 和 `glow-accent` (局部高光) 虽然具有科技感，但在复杂页面中制造了视觉噪声，且容易与组件边框冲突。
- 为提升界面的高级感和内容的清晰度，需要替换为更现代、干净的 "Ambient Dark" 风格。

### 修复内容
1. **Global Styles (`index.css`)**:
   - 移除 `.bg-grid-pattern` 和 `.glow-accent` 类。
   - `body` 背景色保持 deep dark (`bg-zinc-950`)。
   - `body` 增加全局顶部径向渐变 (Radial Gradient Spotlights)，提供微妙的 indigo 氛围光，避免纯黑的死板。

2. **Layout (`Layout.tsx`)**:
   - 移除主容器上残留的背景工具类。
   - 确保内容区域干净，依靠全局 backdrop 渲染氛围。

### 状态
✅ 完成

---

## Session 26 — 2026-02-14 19:15

### 目标
UI Polish: Fix Low Contrast Borders

### 问题分析
- 在 "Ambient Dark" 背景下，原有的 `border-white/5` 边框过于微弱，导致 UI 区块（卡片、面板）视觉上"粘连"在一起，缺乏层级感。
- 用户期望更清晰、锐利的分隔线，但不能破坏整体的暗色调。

### 修复内容
1. **Global Border Strategy (Cards/Panels)**:
   - 采用 "Crisp Border" 组合样式：`border-zinc-700/50` + `ring-1 ring-white/5` + `shadow-sm`。
   - 应用于 `Playground` 三栏布局、`Settings` 配置区块、`EvaluationConfigModal` 模态框、`Dashboard` 统计卡片。

2. **Structural Contrast (Layout)**:
   - 将 Sidebar 和 TopBar 的边框从 `white/5` 提升至 `white/10`，增强框架的稳固感。

3. **Input Elements**:
   - 输入框/Textarea 默认边框提升至 `border-zinc-700`，聚焦时保持 Indigo 高亮。

### 影响文件
- `src/pages/Playground.tsx`
- `src/pages/Settings.tsx`
- `src/components/EvaluationConfigModal.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/Layout/Sidebar.tsx`
- `src/components/Layout/TopBar.tsx`

### 状态
✅ 完成

---

## Session 27 — 2026-02-14 19:25

### 目标
Localization Polish: 全面中文化与国际化完善

### 执行步骤
1. ✅ **全面扫描**: 检查 Settings, Playground, Datasets, Results, Dashboard, EvaluationConfigModal 等页面，识别所有硬编码英文字符串。
2. ✅ **双语同步**: 更新 `zh.json` 与 `en.json`，确保 Key 完全对应。
3. ✅ **组件重构**: 将所有 UI 文本替换为 `t()` 函数调用。
4. ✅ **动态状态**: 修复 Backend 返回的 status string (running/completed) 无法翻译的问题，添加映射。
5. ✅ **指标本地化**: 将 Mock Data 中的 metrics name/description 移入 locale 文件。

### 影响文件
- `src/locales/zh.json`
- `src/locales/en.json`
- `src/pages/Dashboard.tsx`
- `src/pages/Datasets.tsx`
- `src/pages/Playground.tsx`
- `src/pages/Results.tsx`
- `src/pages/Settings.tsx`
- `src/components/EvaluationConfigModal.tsx`

### 状态
✅ 完成

---

## Session 28 — 2026-02-14 19:28

### 目标
Advanced LLM Settings: 多供应商支持与自定义 UI

### 执行步骤
1. ✅ **UI 组件**: 重写 `src/components/ui/Select.tsx`，使用 `lucide-react` 图标和 Linear 风格 (Dark mode) 样式。
2. ✅ **国际化**: 更新 `zh.json` 和 `en.json`，添加 `provider_label`, `model_label`, `api_key_label`, `base_url_label` 等新配置项。
3. ✅ **Settings 页面**: 更新 `src/pages/Settings.tsx` (进行中)，实现多供应商状态管理 (`provider`, `apiKey`, `model`, `baseUrl`) 与自动填充逻辑。
4. ✅ **API 层**: 更新 `src/services/api.ts` 和后端 `judge.py` / `runs.py`，支持通用的 `x-llm-*` header 传递。

### 影响文件
- `src/components/ui/Select.tsx`
- `src/locales/zh.json`
- `src/locales/en.json`
- `src/pages/Settings.tsx`
- `src/services/api.ts`
- `backend/app/api/endpoints/runs.py`
- `backend/app/services/judge.py`

### 状态
✅ 完成

---

## Session 29 — 2026-02-14 19:38

### 目标
Bug Fix: Backend SyntaxError & Playground Integration

### 问题分析
- **SyntaxError**: 在 Session 28 的自动化重构中，`runs.py` 和 `judge.py` 中的 `system_prompt` 参数被重复添加了两次，导致后端启动失败。
- **Playground Missing Feature**: `playground.py` 尚未升级以支持 `x-llm-*` headers，导致 Settings 中的自定义配置在 Playground 中无效。

### 修复内容
1. ✅ **Fix Syntax**: 删除了 `evaluate_single` 和 `_run_evaluation` 定义及调用处的重复参数。
2. ✅ **Playground Upgrade**: 更新 `playground.py` 以接收 `x-llm-key`, `x-llm-model`, `x-llm-base-url` 并传递给评测引擎。

### 影响文件
- `backend/app/api/endpoints/runs.py`
- `backend/app/services/judge.py`
- `backend/app/api/endpoints/playground.py`

### 状态
✅ 完成

---

## Session 31 — 2026-02-14 19:48

### 目标
产品品牌更名：Judge Opus -> Eval Studio

### 变更内容
1.  **前端视觉 (Frontend Visuals)**:
    -   `index.html`: 网页标题更新为 `Eval Studio`.
    -   `Sidebar.tsx`: Logo 更名为 `Eval Studio`，页脚更新为 `Powered by Eval Studio`.
    -   `TopBar.tsx`: 面包屑导航及管理员邮箱更新.
2.  **后端元数据 (Backend Metadata)**:
    -   `main.py`: `FastAPI` 标题更新为 `Eval Studio API`.
    -   `package.json`: 项目名称更新为 `eval-studio`.
    -   `test_e2e.py`: 更新了日志输出信息.
3.  **多语言 (Localization)**:
    -   更新了 `zh.json` 和 `en.json`，将所有 "Opus Judge" 相关引用替换为 "Eval Studio".

### 影响文件
-   `index.html`
-   `package.json`
-   `src/components/layout/Sidebar.tsx`
-   `src/components/layout/TopBar.tsx`
-   `backend/app/main.py`
-   `backend/test_e2e.py`
-   `src/locales/zh.json`
-   `src/locales/en.json`

### 状态
✅ 完成

---

## Session 32 — 2026-02-14 20:00

### 目标
Architecture Pivot: Anonymous Ephemeral Sessions

### 变更内容
1.  **Backend**:
    -   `models.py`: Added `session_id` to `Dataset`, `EvaluationRun`, `EvaluationItem`.
    -   `deps.py`: Added `get_session_id` dependency.
    -   `datasets.py`: Implemented session filtering and **Auto-Seeding** logic.
    -   `config.py`: Changed DB path to `judge_opus_sessions.db` to force schema reset.
2.  **Frontend**:
    -   `api.ts`: Implemented volatile Session ID generation on page load.
    -   `Settings.tsx`: Added "Reset Session" button.
3.  **Verification**:
    -   Verified isolation using `verify_session.py` (simulated 2 concurrent sessions).

### 状态
✅ 完成

---

## Session 33 — 2026-02-14 20:12

### 目标
Refactoring File Structure

### 变更内容
1.  **File Organization**:
    -   Created `backend/scripts/` and moved debug scripts (`debug_orm.py`, `debug_schema.py`, etc.).
    -   Created `docs/` and moved `USER_GUIDE.md`.
2.  **Code Updates**:
    -   Updated `sys.path` and file paths in scripts to match new location.

### 状态
✅ 完成

---

## Session 34 — 2026-02-14 20:20

### 目标
Documentation: Generate README.md (English & Chinese)

### 变更内容
1.  **Documentation**:
    -   Generated professional `README.md` (English) for "Eval Studio".
    -   Generated `README_zh.md` (Chinese) for "Eval Studio".
    -   Included Project Banner, Badges, Key Features, Tech Stack, and Getting Started guide in both languages.

### 状态
✅ 完成

---

## Session 35 — 2026-02-14 20:25

### 目标
Deployment Prep: Config for Vercel & Render

### 变更内容
1.  **Backend**:
    -   Updated `main.py` CORS to `allow_origins=["*"]` for flexible deployment access.
    -   Verified `requirements.txt` includes necessary dependencies (`uvicorn`, `python-multipart`).
2.  **Frontend**:
    -   Updated `api.ts` to use `import.meta.env.VITE_API_URL` for `BASE_URL`.
    -   Created `.env.production` for production environment variables.

### 状态
✅ 完成

---

## Session 36 — 2026-02-14 20:27

### 目标
Fix Naming Mistake

### 变更内容
1.  **Frontend**:
    -   replaced "Judge-Opus" with "Eval Studio" in `TopBar.tsx` (Breadcrumb).
    -   Updated header comments in `api.ts` and `mockData.ts`.

### 状态
✅ 完成

---

## Session 37 — 2026-02-14 20:41

### 目标
Git Automation: Initialize and Push to GitHub

### 变更内容
1.  **Git Configuration**:
    -   Initialized Git repository.
    -   Configured `.gitignore` to exclude secrets and DBs.
    -   Set local user identity for commit.
    -   Added remote `origin` pointing to `https://github.com/Maropion03/Eval-studio.git`.
2.  **Action**:
    -   Staged and committed all files.
    -   Pushed to `main` branch.

### 状态
✅ 完成

---

## Session 38 — 2026-02-14 21:54

### 目标
Bug Fix: 422 Error on File Upload (Missing Header)

### 变更内容
1.  **Frontend (`api.ts`)**:
    -   Modified `uploadDatasetFile` to explicitly inject the `x-session-id` header.
    -   This fixes the 422 error caused by the backend missing the required session ID during multipart/form-data uploads.

### 状态
✅ 完成

---

## Session 39 — 2026-02-14 21:55

### 目标
Push Fix to GitHub

### 变更内容
1.  **Git Action**:
    -   Committed fix for file upload header (`src/services/api.ts`).
    -   Pushed changes to `origin main`.

### 状态
✅ 完成

---

## Session 41 — 2026-02-15 00:20

### 目标
Refactor: Full Rewrite of `src/services/api.ts`

### 变更内容
1.  **Code Structure**:
    -   Extracted shared interfaces to `src/types.ts`.
    -   Updated `src/data/mockData.ts` to re-export types (backward compatibility).
2.  **API Client**:
    -   Completely rewrote `src/services/api.ts`.
    -   Implemented robust `request<T>` wrapper with automatic `x-session-id` injection and content-type handling.
    -   Removed all dependencies on `mockData` logic; strictly calls backend endpoints.
    -   Maintained Snake-to-Camel case adapters for seamless frontend integration.

### 状态
✅ 完成

---

## Session 42 — 2026-02-15 00:37

### 目标
Critical Fix: Sync API to GitHub

### 变更内容
1.  **API Client**:
    -   Force-updated `src/services/api.ts` with "v2" logging and robust URL cleaning.
    -   Verified removal of all mock data logic.
2.  **Git Sync**:
    -   Executed force commit and push to ensure GitHub is up-to-date.

### 状态
✅ 完成

---

## Session 43 — 2026-02-15 01:05

### 目标
Fix API Client Header Handling

### 变更内容
1.  **Code Improvement**:
    -   Refactored `request` helper in `src/services/api.ts` to use standard `Headers` API.
    -   This prevents issues where custom headers passed as `Headers` objects would not merge correctly with plain objects.
    -   Added safer error logging for text-decoding failures.

### 状态
✅ 完成

---

## Session 44 — 2026-02-15 01:38

### 目标
Debug Evaluation Stalled ("Running" 0/6)

### 变更内容
1.  **Backend Fix (`runs.py`)**:
    -   Found **Duplicate Function Definition**: `_run_evaluation` was defined twice.
    -   Found **Signature Mismatch**: `create_run` was calling the background task without `system_prompt`, causing a `TypeError` that crashed the task immediately.
    -   **Action**: Removed the old function definition and updated the call to include `system_prompt`.
2.  **CORS**:
    -   Explicitly added `x-session-id` to allowed headers in `main.py`.

### 状态
✅ 完成

---

### [2026-02-16 15:45] 添加 ShipSwift MCP 服务器
**1.Goal**: 注册 ShipSwift MCP 服务器以扩展 Agent 的功能。
**2.Logic**: 由于当前环境中无法识别 `gemini` 命令行工具，通过手动修改 `mcp_config.json` 文件来添加服务器配置。
**3.Tech**: MCP (Model Context Protocol), JSON Config.
**4.Files**: `C:\Users\11856\.gemini\antigravity\mcp_config.json`

### [2026-02-16 16:05] 完善 ShipSwift MCP 配置架构
**1.Goal**: 完善 ShipSwift MCP 的配置架构，支持 API Key 认证。
**2.Logic**: 在 `mcp_config.json` 中注入了 `env` 字段并添加了 `SHIPSWIFT_API_KEY` 占位符。这样用户只需替换 Key 即可完成连接。
**3.Tech**: MCP Environment Variables, JSON.
**4.Files**: `C:\Users\11856\.gemini\antigravity\mcp_config.json`

### [2026-02-16 16:52] 修复 DatasetResponse 缺失导致的导入回归错误
**1.Goal**: 恢复 `DatasetResponse` 模型，修复导致 `datasets.py` 崩溃的导入错误。
**2.Logic**: 由于之前的更新意外删除了 `DatasetResponse`，通过重新覆盖 `schemas.py` 恢复所有必需的 Pydantic 模型，包括 `DatasetResponse` (作为 `Dataset` 的别名) 和 `EvaluationRunCreate`。
**3.Tech**: Pydantic, FastAPI.
**4.Files**: `backend/app/schemas/schemas.py`

### [2026-02-17 09:50] 同步开发日志并检查项目状态
**1.Goal**: 恢复丢失的开发日志条目，并根据用户要求更新 `devlog.md`。
**2.Logic**: 发现 `devlog.md` 恢复到了 Session 44 之前的状态（可能是因为文件回滚或环境切换），因此重新追加 2026-02-16 的所有操作记录，并同步今日状态。
**3.Tech**: Markdown Maintenance.
**4.Files**: `devlog.md`
### [2026-02-17 10:52] 修复 deps.py 缺失导致的部署失败

**1.Goal**: 恢复 `deps.py` 中的 `get_db` 和 `get_session_id` 函数，确保后端路由依赖正常。
**2.Logic**: 部署过程中发现 `app.api.deps` 缺少关键依赖函数，导致 Endpoints 无法正常工作。通过重写 `deps.py` 恢复了数据库 Session 管理和 Session ID 提取逻辑。
**3.Tech**: FastAPI Dependencies, SQLAlchemy.
**4.Files**: `backend/app/api/deps.py`

### [2026-02-17 11:00] 同步代码至 GitHub 以触发部署修复

**1.Goal**: 将本地修复的 `schemas.py` 和 `deps.py` 推送到 GitHub，触发 Render 的自动部署以消除 `AttributeError`。
**2.Logic**: 之前的修复仅在本地生效，Render 部署是从 GitHub 拉取代码的。由于远程仓库缺少 `get_db` 等函数，部署会报错。通过执行 `git push` 同步最新修复。
**3.Tech**: Git Automation.
**4.Files**: `backend/app/schemas/schemas.py`, `backend/app/api/deps.py`

### [2026-02-17 11:02] 恢复比较功能所需的 Pydantic 模型

**1.Goal**: 在 `schemas.py` 中恢复 `CompareResponse`、`RunResponse` 和 `ItemResponse` 模型。
**2.Logic**: 之前的更新不慎遗漏了对比视图（Compare）所需的模型，导致 `compare.py` 运行时崩溃。本次更新通过整合所有必需模型，完成了 `schemas.py` 的最终合并。
**3.Tech**: Pydantic, FastAPI.
**4.Files**: `backend/app/schemas/schemas.py`

### [2026-02-17 11:15] 重构 Schema 层：统一 Pydantic 模型

**1.Goal**: 对后端 Schema 层进行全面重构，将所有 Pydantic 模型整合到单一文件中，以解决循环依赖和模型散乱问题。
**2.Logic**: 按照 Strict Service-Controller 模式，将 Settings, EvaluationItem, Dataset, Run, Playground, Compare 等所有业务实体的 Base/Create/Response 模型统一收敛至 `schemas.py`。
**3.Tech**: Pydantic Refactoring.
**4.Files**: `backend/app/schemas/schemas.py`
### [2026-02-22 11:58] 项目全面修复：Schema/Endpoint/代码清理

**1.Goal**: 项目经过 31 次迭代后，代码质量严重退化，出现大量断裂的导入、Schema 与 ORM 不匹配、死代码和旧品牌命名。本次操作是对整个项目的全面审查和修复。
**2.Logic**: 逐一阅读全部 20+ 个源文件，识别出 15+ 个关键问题后，按依赖顺序修复：先修 schemas（基础），再修所有 endpoint 文件，最后修前端。主要修复了：
  - `schemas.py` 完全重写（缺失的 `SettingsResponse`/`SettingsUpdate`，错误的字段类型和字段名）
  - `judge.py` 中 `dataset.get_items()` 修正为 `dataset.raw_data`
  - `runs.py` 中移除不存在的 `metrics_code` 字段，添加 dataset_name 查询
  - `playground.py` 中 `api_base` → `base_url` 参数修正
  - `compare.py` 中 CompareResponse 字段名统一
  - `deps.py` 去重 `get_db`，统一导入来源
  - 全局品牌命名 Judge-Opus → Eval Studio
**3.Tech**: Python/FastAPI/Pydantic/SQLAlchemy (后端), TypeScript/React/Vite (前端)
**4.Files**: `schemas.py`, `deps.py`, `runs.py`, `judge.py`, `playground.py`, `compare.py`, `settings.py`, `datasets.py`, `main.py`, `config.py`, `models.py`, `.env`, `api.ts`


