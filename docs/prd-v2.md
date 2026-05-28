# Eval Studio v2 · PRD

> 版本:v2.0-draft
> 日期:2026-05-26
> 作者:毛睿平
> 状态:重做立项

---

## 1. 背景与定位

### 1.1 现状问题

Eval Studio v1 定位是「LLM 输出对比工具」,会话隔离 + BYOK + Faithfulness/Relevance/Coherence 三维指标。
在 v1 上线后通过自用与 1-1 调研,识别出三个核心问题:

1. **三维指标对非工程师 AI PM 无效**:Faithfulness=0.87 无法转化为产品决策。
2. **场景空心**:通用测试集无法回答"我这个金融问答场景里,这模型靠不靠谱"。
3. **形态低频**:用户跑完一次对比就关闭浏览器,产品没有复用价值。

### 1.2 v2 重新定位

> **「AI 应用的 Prompt 回归测试工作台」—— 给非工程师 AI PM 用的,改应用层 prompt 之前一键跑回归,业务化判题维度,关键场景守住底线再上线。**

定位坐标:

| 维度 | LangSmith / Braintrust | Eval Studio v2 |
|---|---|---|
| 受众 | 工程师 | **AI PM(非工程师)** |
| 判题 | 通用指标(Faithfulness/BLEU) | **业务化指标 + L0-L3 严重度分级** |
| 输出 | Trace + Dashboard | **矩阵对比 + 决策书** |
| 形态 | 工程师工作台 | **PM 实验台** |

### 1.3 与 PRD 智能评审 workbench 的关系

主动构建「AI Evaluation 系列两件套」叙事:

- **PRD 评审 workbench**:评**内容**质量(给一份 PRD 打分 + 改进建议)
- **Eval Studio v2**:管**实验**对照(配置 N×M 矩阵 + 决策书)

两者范式不同:前者是"评审 portal",后者是"实验 lab"。

---

## 2. 用户画像与场景

### 2.1 主用户:AI PM(非工程师背景)

| 维度 | 画像 |
|---|---|
| 角色 | 互联网/金融/咨询公司的 AI 产品经理 |
| 工作内容 | 推动 1-3 个 AI 应用上线(RAG 问答 / 文档解析 / Agent workflow) |
| 技术能力 | 能看懂代码不一定能写,能改 prompt 不一定能配 CI |
| 当前痛点 | "改完 prompt 凭感觉发版,线上出问题才知道回归了" |
| 当前替代方案 | ChatGPT 手动跑 + Excel 记录 + 凭感觉 |

### 2.2 核心场景(4 种实验,共用底层)

| # | 实验类型 | 触发时机 | 频度 |
|---|---|---|---|
| 1 | **Prompt 迭代回归** ⭐ | 改了 system / workflow / RAG template | 每周多次 |
| 2 | **模型升级审计** | 供应商发新版本(Claude 4.5→4.6) | 每月 1-2 次 |
| 3 | **参数调试** | 调 temperature / top_p / few-shot | 每周多次 |
| 4 | **模型选型** | 项目初期 / 大改版 | 每季度 1 次 |

**关键洞察**:4 个场景本质都是「控制一个变量 × 跑 dataset × 看 delta」,因此**1 个产品 4 种实验**,而不是 4 个产品。

### 2.3 非目标(明确不做)

- ❌ 不测**终端用户输入的一次性 prompt**(C 端 user 问句不可复用)
- ❌ 不做 trace / span 级日志(留给 LangSmith / Langfuse)
- ❌ 不做线上监控告警(留给 Helicone)
- ❌ 不做 prompt 编辑器 IDE(留给灵构的"可视化参数调试场")
- ❌ 不做团队协作 / 权限管理(BYOK 单人使用,v3 再考虑)

---

## 3. 核心方法学

### 3.1 实验三层抽象

```
Experiment(实验意图)
  └─ Run(一次执行,可重跑)
       └─ Trial(单条 case × 单模型 × 单 prompt 的最小执行单元)
```

- **Experiment**:用户配置,描述"在变什么"(变量轴)+"测什么"(dataset)+"怎么判"(judge dims)
- **Run**:一次具体执行,可重跑(用于重现 / debug)
- **Trial**:N×M×K 矩阵中的每个单元格

### 3.2 业务化判题维度(替代通用指标)

| 维度 | 含义 | 判法 |
|---|---|---|
| `fact_accuracy` | 必须命中的事实(数字/日期/主体) | 规则 + Judge LLM 双判,数字字段必须 1:1 |
| `hallucination_severity` | 幻觉严重度(**L0-L3**) | Judge LLM 分级 |
| `citation_recall` | 必须引用的来源(合规场景) | 规则匹配 |
| `forbidden_hit` | 是否触发红线(合规) | 规则匹配 |
| `pareto_position` | 该模型在成本-质量帕累托上的位置 | 计算派生 |

**严重度分级(产品 IP,核心 sell point)**:

- **L0(无伤)**:措辞不同但事实正确
- **L1(数据偏差)**:数字 / 日期有小幅误差,不影响决策
- **L2(合规事故)**:错误引用条款 / 错误金额 / 错误主体
- **L3(决策误导)**:错误的推荐 / 错误的风险结论

### 3.3 决策书生成(产品灵魂)

跑完 Run 后自动生成一份**可分享 URL 的决策书**,包含 6 个 section:

1. **推荐结论**(1 句话 + 1 个推荐模型/prompt 版本)
2. **Pareto 前沿图**(成本 × 准确率)
3. **关键 failure case 3 个**(配截图 + 严重度标签)
4. **成本测算**(按日/月调用量算 Token 成本)
5. **风险清单**(L2/L3 级幻觉的可能场景)
6. **三段话术 Tab**:给老板的(ROI) / 给合规的(风险可控点) / 给工程的(技术细节)

输出形态:**带版面设计的 Web Report 页 + PDF 导出**,视觉参考 Stripe Atlas Report / Linear Changelog。

---

## 4. Dataset Starter Pack

弱绑定金融场景,4 个 starter dataset(共 140 条 seed):

| 场景 | 条数 | 用于 demo 哪个能力 |
|---|---|---|
| 财报 QA | 40 | 事实准确率(数字必须对) |
| 合规审核 | 30 | 条款命中率 + 红线触发 |
| 研报摘要 | 30 | 关键结论不丢、不歪曲 |
| 舞弊线索识别 | 40 | 风险点识别 + 误报率 |

详细 Schema 见 [dataset-schema.json](./dataset-schema.json),示例 cases 见 [dataset-examples.json](./dataset-examples.json)。

支持用户自上传(JSON / CSV),前端做 schema 校验。

---

## 5. 信息架构

### 5.1 页面结构(6 → 3)

```
导航
├─ Experiments (默认首页)      ⭐ 实验时间线 + 列表/看板双视图
├─ New Run    (主 CTA)         ⭐ 3 步 wizard
├─ Datasets   (侧栏二级)         starter pack + 自上传
└─ Settings                     BYOK API Key 管理
```

砍掉:`Dashboard` / `Comparison` / `Playground`(三者全删)
重写:`Results` → `Run Report`(三 Tab)
降级:`Datasets` 不单独占顶级页面

### 5.2 关键页面

#### ① Experiments(首页)

- 实验时间线,每行带 sparkline(关键指标变化)
- 列表 + 看板双视图
- 实验状态:`draft` / `running` / `done` / `failed`

#### ② New Run Wizard(3 步)

- **Step 1**:选 Dataset(4 starter / 自上传)
- **Step 2**:配变量轴(prompt × model × params,自动生成 N×M 矩阵)
- **Step 3**:选判题维度,显示预估成本 + 耗时

#### ③ Run Report(3 Tab)

- **Tab A · 矩阵对比表**:横轴 dataset,纵轴 prompt/model 版本
- **Tab B · 可视化分析**:Pareto 散点 / 雷达图 / 严重度堆叠
- **Tab C · 决策书**:三段话术 + PDF 导出 + 可分享 URL

---

## 6. 技术架构

### 6.1 技术栈

- **Frontend**:React 18 + TypeScript + Vite + Tailwind + TanStack Query + Recharts
- **Backend**:FastAPI + SQLAlchemy + SQLite + LiteLLM
- **新增**:SSE(实时跑批进度,复用 PRD 评审经验) + PDF 导出(WeasyPrint / Playwright)

### 6.2 后端数据模型(关键改造)

```python
# 替代现有 models.py 里的扁平结构
class Experiment(Base):
    id: str
    name: str
    scenario: str           # 4 种之一
    variable_axes: JSON     # {"prompt": ["v3","v4"], "model": ["...","..."]}
    dataset_id: str
    judge_dims: list[str]
    created_at: datetime

class Run(Base):
    id: str
    experiment_id: str
    status: str             # draft / running / done / failed
    trial_count: int
    cost_estimate: float
    started_at, finished_at

class Trial(Base):
    id: str
    run_id: str
    case_id: str
    prompt_version: str
    model: str
    params: JSON
    output: str
    scores: JSON            # {"fact_accuracy": 0.9, "hallucination_severity": "L1", ...}
    judge_explanation: str
```

### 6.3 API 改造

砍掉:`/playground` `/compare` `/runs` 旧实现

新增:
- `POST /experiments` 创建实验配置
- `POST /experiments/{id}/runs` 触发一次执行
- `GET  /runs/{id}/stream` SSE 实时进度
- `GET  /runs/{id}/report` 决策书数据
- `GET  /runs/{id}/report.pdf` PDF 导出
- `POST /datasets/upload` 用户上传

---

## 7. 4 周里程碑

| 周次 | 交付物 | 验收标准 |
|---|---|---|
| Week 0 | PRD + Schema + Dataset seed + 低保真线稿 | 4 个场景共 140 条 case 入库 |
| Week 1 | 后端三层抽象 + Judge 引擎 + Dataset API | 跑通一次完整 Run(前端可 mock) |
| Week 2 | Experiments 页 + New Run wizard + SSE 进度 | 用户能完整走完"配实验→看跑批" |
| Week 3 | Run Report 三 Tab + Diff View + 决策书 | 决策书可生成 PDF + 可分享 URL |
| Week 4 | 部署上线 + Demo 视频 + Case study + 简历更新 | 公开 URL + 90s demo 视频 + 博客 |

---

## 8. 成功指标(给自己 + 给面试官)

### 8.1 项目自评

- ✅ 3 个核心页面信息架构清晰,30 秒能讲完
- ✅ 决策书单页截屏能独立说服一个非技术 stakeholder
- ✅ 4 个场景每个都有 1 个标志性 failure case demo
- ✅ 与 PRD 评审 workbench 在产品范式上一眼区分

### 8.2 简历可量化指标(占位,Week 4 填实数)

- 实验配置时间:Excel 半天 → wizard `XX` 分钟
- 单次回归测试:手动跑 N 条 + Excel 记录 `XX` 小时 → 自动跑 + 决策书 `XX` 分钟
- 关键 failure case 漏检率(L2 级):凭感觉 `XX%` → 工具召回 `XX%`

---

## 9. 风险与开放问题

| 风险 | 缓解 |
|---|---|
| 与 PRD 评审 workbench 形态重合 | 已通过「实验 lab vs 评审 portal」范式差异化(见 §1.3) |
| 4 周做不完决策书的视觉打磨 | Week 3 全部资源 all-in 决策书页 |
| Dataset 140 条手工成本 | LLM 生成 + 人工 review 流水线,~20 小时 |
| 真实用户量小 | 作品集项目,优化"30 秒可懂"而非"DAU" |

---

## 10. 附录:30 秒电梯叙事

> "做 AI 产品的 PM 每周都在改 prompt,但改完不知道有没有破坏别的场景。
> 我做了 Eval Studio v2,把 prompt 改动跑一遍回归测试,3 分钟告诉你哪些 case 涨了、哪些跌了、有没有 L2 级风险。
> 上线前的最后一道关卡 —— 像软件工程的单元测试,但是给 LLM 应用用的。
> 配合我之前做的 PRD 评审 workbench,两个项目构成『AI Evaluation 系列两件套』:一个评内容,一个管实验。"
