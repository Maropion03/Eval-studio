"""LLM-driven case generators for the 4 starter-pack scenarios.

Each generator returns a dict matching docs/dataset-schema.json:
    {case_code, scenario, difficulty, risk_tier, input, reference, metadata}

We use DeepSeek-V4-Pro (the writer model) for quality. Each call produces ONE
case so we can carefully tune the prompt per scenario and validate the JSON
shape before persistence.
"""

from __future__ import annotations

import json
import re
from typing import Any

from app.services.llm_client import chat

# ════════════════════════════════════════════════════════════════════
#  Shared output contract
# ════════════════════════════════════════════════════════════════════

OUTPUT_RULES = """
Return STRICTLY a single JSON object — no prose before or after, no markdown
fences, no commentary. The object must have these top-level keys:

  - "difficulty": "easy" | "medium" | "hard"
  - "risk_tier":  "L0" | "L1" | "L2" | "L3"   (severity if answered wrong)
  - "input": {
        "context":   <string, the source document excerpt>,
        "question":  <string, the actual task instruction>,
        "extra":     <optional object with scenario-specific extras>
    }
  - "reference": {
        # at least one of these four MUST be non-empty:
        "must_contain_facts": [<string>, ...],
        "must_cite_sources":  [<string>, ...],
        "forbidden_claims":   [<string>, ...],
        "golden_answer":      <string>,
        "scoring_rubric":     <optional string>
    }
  - "metadata": {
        "source":      <string, where the underlying data came from>,
        "author_note": <string, why this case is interesting>,
        "tags":        [<string>, ...]
    }

Write the context realistically — include actual numbers, dates, entities.
Vary the difficulty across the cases you generate. Output language follows
the scenario language hint.
""".strip()


# ════════════════════════════════════════════════════════════════════
#  Scenario prompts
# ════════════════════════════════════════════════════════════════════

FINANCIAL_QA_PROMPT = """
Generate ONE financial QA evaluation case for an LLM benchmark suite.

Scenario: an analyst asks a question that requires extracting specific numbers,
dates, year-over-year deltas, or financial ratios from a Chinese A-share
listed company's quarterly or annual report (10-Q / 10-K equivalent).

Constraints:
  - The context must read like a real 财务报告片段 (Chinese), 200-500 字.
  - The question MUST be unambiguous and have a single correct answer.
  - must_contain_facts MUST list 3-5 atomic facts — each one a number / date /
    entity that the answer must include verbatim or normalized
    (e.g. "营业收入 396.71 亿元", "同比增长 15.3%").
  - forbidden_claims should include 2-3 things the model must NOT say
    (e.g. "投资建议", "未来业绩预测", "股价目标").
  - golden_answer: a concise 1-2 sentence Chinese answer.
  - risk_tier: usually L1 (data drift) or L2 (numeric error = compliance event).
  - tags should mention: ["数字密集", and either "财报基础" / "同比环比" / "比率计算" / "现金流"].

Sequence number this case is #{seq:03d}.

""" + OUTPUT_RULES


COMPLIANCE_AUDIT_PROMPT = """
Generate ONE compliance-audit evaluation case for an LLM benchmark suite.

Scenario: a compliance officer asks the LLM to identify whether a described
behaviour violates Chinese securities / corporate-governance regulations,
which clauses apply, and the nature of the violation (重大 / 一般 / 轻微).

Constraints:
  - The context (200-400 字 Chinese) should describe a *single* concrete
    behaviour — e.g. delayed disclosure, related-party transaction, insider
    trading, false advertising, etc.
  - input.extra MUST include an "applicable_regulations" array with 2-3
    REAL-LOOKING clauses (e.g. "《证券法》第八十条", "《上市公司收购管理办法》第十三条")
    along with their brief content.
  - The question asks "是否违规 + 违反哪些条款 + 何种性质".
  - reference MUST include must_cite_sources (the regulation citations) AND
    forbidden_claims that includes weasel phrases like "可能轻微", "情节较轻",
    "建议自行判断".
  - scoring_rubric: short paragraph stating how points are awarded.
  - risk_tier: L2 (compliance event) or L3 (decision-grade error).
  - tags should include: ["条款引用", "性质判断", and one of: "信息披露" / "关联交易" / "内幕交易" / "市场操纵"].

Sequence number this case is #{seq:03d}.

""" + OUTPUT_RULES


RESEARCH_SUMMARY_PROMPT = """
Generate ONE research-summary evaluation case for an LLM benchmark suite.

Scenario: an analyst gives the LLM a long-form sell-side research report
(simulated) and asks for a strict, structured summary that preserves all
key conclusions and the investment stance.

Constraints:
  - The context should read like a 行业深度研报 in Chinese, 600-1200 字, with
    several distinct claims: industry projection, competitive landscape,
    upstream / midstream / downstream views, AND a final recommendation
    (e.g. "超配上游, 标配下游, 低配中游").
  - The question: "用 200 字以内总结这份研报的核心观点和投资建议."
  - must_contain_facts: 4-6 key conclusions (numbers, classifications, the
    final recommendation phrase).
  - forbidden_claims: things the model should NOT introduce — e.g.
    "全行业看好", "建议清仓", "股价目标价" (since those weren't in the source).
  - scoring_rubric: rules around length penalty + recall + faithfulness.
  - risk_tier: usually L1 (data drift on summary).
  - tags should include: ["长上下文", "摘要", "观点保真", and one industry tag].

Sequence number this case is #{seq:03d}.

""" + OUTPUT_RULES


FRAUD_DETECTION_PROMPT = """
Generate ONE fraud-detection evaluation case for an LLM benchmark suite.

Scenario: the LLM is shown a snippet of Chinese A-share financial data plus
some qualitative signals, and is asked to flag potential fraud red flags +
classify the likely fraud type.

Constraints:
  - Context (200-400 字 Chinese) must combine 2-4 concrete anomalous signals,
    e.g. 应收账款增速远超营收增速 / 经营性现金流为负 / 关联方非关联化 /
    存货周转天数异常 / 大客户集中度异常 / 第一大客户为新成立小公司 etc.
  - The question: "请识别上述财务数据中存在的舞弊风险信号, 并指出可能的舞弊类型."
  - must_contain_facts: 4-6 risk signals the model must surface
    (each as a short Chinese phrase).
  - scoring_rubric: a paragraph stating how points are awarded per signal
    detected + bonus for naming the fraud type correctly
    (虚增收入 / 关联方非关联化 / 渠道压货 / 资产虚增 etc.).
  - difficulty: prefer "hard".
  - risk_tier: L3 (decision-grade error) for most.
  - tags should include: ["多信号融合", "舞弊识别", and one of:
    "虚增收入" / "关联方识别" / "现金流分析" / "渠道压货"].

Sequence number this case is #{seq:03d}.

""" + OUTPUT_RULES


# ════════════════════════════════════════════════════════════════════
#  JSON extraction (LLM sometimes wraps in ```json fences)
# ════════════════════════════════════════════════════════════════════


_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


def _extract_json(text: str) -> dict[str, Any]:
    raw = text.strip()
    # strip any markdown fences
    m = _FENCE_RE.search(raw)
    if m:
        raw = m.group(1).strip()
    return json.loads(raw)


# ════════════════════════════════════════════════════════════════════
#  Schema validation (lightweight — full schema is enforced at upload)
# ════════════════════════════════════════════════════════════════════


REQUIRED_TOP = {"difficulty", "risk_tier", "input", "reference", "metadata"}


def _validate_case(case: dict[str, Any]) -> None:
    missing = REQUIRED_TOP - case.keys()
    if missing:
        raise ValueError(f"case missing required keys: {missing}")
    if case["risk_tier"] not in {"L0", "L1", "L2", "L3"}:
        raise ValueError(f"bad risk_tier: {case['risk_tier']}")
    ref = case["reference"]
    has_at_least_one = any(
        ref.get(k) for k in ("must_contain_facts", "must_cite_sources",
                              "forbidden_claims", "golden_answer")
    )
    if not has_at_least_one:
        raise ValueError("reference must include at least one of "
                         "must_contain_facts / must_cite_sources / "
                         "forbidden_claims / golden_answer")
    if "input" not in case or "question" not in case["input"]:
        raise ValueError("input.question missing")


# ════════════════════════════════════════════════════════════════════
#  Per-scenario generators
# ════════════════════════════════════════════════════════════════════


_SCENARIOS = {
    "financial_qa":     ("fin-qa",   FINANCIAL_QA_PROMPT),
    "compliance_audit": ("comp-aud", COMPLIANCE_AUDIT_PROMPT),
    "research_summary": ("res-sum",  RESEARCH_SUMMARY_PROMPT),
    "fraud_detection":  ("fraud",    FRAUD_DETECTION_PROMPT),
}


async def generate_case(scenario: str, seq: int) -> dict[str, Any]:
    if scenario not in _SCENARIOS:
        raise ValueError(f"unknown scenario: {scenario}")
    code_prefix, prompt_template = _SCENARIOS[scenario]

    # NB: literal replace — str.format() would collide with JSON example braces.
    prompt = prompt_template.replace("{seq:03d}", f"{seq:03d}")

    result = await chat(
        model="deepseek-ai/DeepSeek-V4-Pro",
        messages=[
            {"role": "system", "content":
             "You are a senior LLM-eval dataset author. Output STRICT JSON only."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=4096,
    )

    try:
        case = _extract_json(result.content)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned non-JSON: {e}\n{result.content[:400]}") from e

    _validate_case(case)

    # back-fill scenario fields + canonical case_code
    case["scenario"] = scenario
    case["case_code"] = f"{code_prefix}-{seq:03d}"
    case.setdefault("metadata", {})

    return case


__all__ = ["generate_case", "_SCENARIOS"]
