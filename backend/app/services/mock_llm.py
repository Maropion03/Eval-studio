"""Deterministic offline LLM stand-in.

Activated by ``MOCK_LLM=1``. When on, :func:`app.services.llm_client.chat`
routes here instead of calling a real provider, so the full pipeline
(candidate → judge → decision book) runs end-to-end with **zero network**
and **stable, repeatable** results. Used for keyless local demos and for the
multi-agent test suite.

Realism strategy:
- The *candidate* answer is derived from the document, with fact coverage that
  varies by model "quality" — so different models earn different pass rates.
- The *judge* trusts the deterministic RULE_CHECK_SUMMARY embedded in its own
  prompt, mapping it to an L0-L3 severity exactly as a real judge would.
- The *writer* emits a structurally-valid Decision Book referencing the
  Pareto-recommended model parsed out of its prompt.
"""

from __future__ import annotations

import hashlib
import json
import re

# ── deterministic hashing (process-stable, unlike builtin hash()) ──


def _seed(*parts: str) -> int:
    h = hashlib.md5("|".join(parts).encode("utf-8")).hexdigest()
    return int(h[:8], 16)


def _unit(*parts: str) -> float:
    """Stable pseudo-random float in [0, 1) for the given key."""
    return (_seed(*parts) % 100_000) / 100_000.0


def _model_quality(model: str) -> float:
    """Higher → answers cover more required facts → higher pass rate."""
    m = model.lower()
    if "mini" in m or "flash" in m or "7b" in m:
        return 0.60
    if any(k in m for k in ("v4-pro", "pro/deepseek", "reasoner", "-r1", "72b", "gpt-4o")):
        return 0.93
    return 0.80


# ── role detection ──

_JUDGE_MARK = "evaluation judge"
_WRITER_MARK = "Decision Book"


def mock_completion(
    model: str,
    messages: list[dict[str, str]],
    reference: dict | None = None,
) -> str:
    sys = next((m["content"] for m in messages if m.get("role") == "system"), "")
    user = next((m["content"] for m in messages if m.get("role") == "user"), "")
    if _WRITER_MARK in sys:
        return _mock_writer(user)
    if _JUDGE_MARK in sys:
        return _mock_judge(user)
    return _mock_candidate(model, user, reference)


# ── candidate ──


def _split_doc_question(user: str) -> tuple[str, str]:
    ctx, q = "", user
    if "DOCUMENT:" in user:
        body = user.split("DOCUMENT:", 1)[1]
        if "QUESTION:" in body:
            ctx, q = body.split("QUESTION:", 1)
        else:
            ctx = body
    return ctx.strip(), q.strip()


def _key_sentences(ctx: str) -> list[str]:
    parts = re.split(r"[。\n;；]", ctx)
    keyed = [p.strip() for p in parts if p.strip() and (re.search(r"\d", p) or "元" in p or "%" in p or "第" in p)]
    return keyed or [p.strip() for p in parts if p.strip()]


def _mock_candidate(model: str, user: str, reference: dict | None) -> str:
    """Simulate a model of a given quality answering the case.

    Completeness scales with model quality: better models more often produce
    the *full* set of required facts (→ L0); weaker models drop facts (→ L1/L2)
    and occasionally breach a red line (→ L3). Required facts/sources are drawn
    from the reference because the mock stands in for a model that *would* know
    the answer — only reachable in MOCK_LLM mode.
    """
    ref = reference or {}
    facts = list(ref.get("must_contain_facts") or [])
    sources = list(ref.get("must_cite_sources") or [])
    forbidden = list(ref.get("forbidden_claims") or [])
    golden = ref.get("golden_answer") or ""

    q = _model_quality(model)
    roll = _unit(model, user[:200])

    if roll < q:  # complete & faithful
        keep_facts, keep_src, tier = facts, sources, "complete"
    elif roll < q + (1.0 - q) * 0.6:  # partial — minor omissions
        keep_facts = facts[: max(1, round(len(facts) * 0.7))]
        keep_src = sources[: max(0, round(len(sources) * 0.7))]
        tier = "partial"
    else:  # poor — major omissions
        keep_facts = facts[: max(1, round(len(facts) * 0.4))]
        keep_src = sources[:1]
        tier = "poor"

    parts: list[str] = []
    if golden and tier == "complete":
        parts.append(golden)
    parts.extend(keep_facts)
    parts.extend(keep_src)

    # rare red-line breach, weaker models only → forbidden_hit → L3
    if forbidden and q < 0.7 and _unit(model, "redline", user[:80]) > 0.85:
        parts.append(forbidden[0])

    if not parts:
        ctx, _ = _split_doc_question(user)
        return f"根据文档，暂无法给出确定结论。{ctx[:80]}"

    lead = {
        "complete": "根据文档，完整回答如下：",
        "partial": "根据文档，回答如下：",
        "poor": "根据文档，初步答复：",
    }[tier]
    return lead + "；".join(p for p in parts if p) + "。"


# ── judge ──


def _extract_rule_summary(user: str) -> dict:
    # rule_summary is dumped as a single JSON line; capture the whole line
    # (greedy to the last brace on that line) so facts containing braces or
    # the `## SCORING` example braces below don't truncate or over-match it.
    m = re.search(r"RULE_CHECK_SUMMARY[^\n]*\n(\{[^\n]*\})", user)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    return {}


_JUDGE_EXPL = {
    "L0": "事实全部命中，无臆造，符合参考答案。",
    "L1": "主要事实正确，个别数据或表述缺失，决策安全。",
    "L2": "关键事实缺失或引用不全，合规场景需人工复核。",
    "L3": "触发红线或方向性错误，需立即人工介入。",
}


def _mock_judge(user: str) -> str:
    rs = _extract_rule_summary(user)
    forbidden = bool(rs.get("forbidden_hit"))
    cit = float(rs.get("citation_recall", 1.0))
    fact = float(rs.get("fact_match_rule", 1.0))

    ms = re.search(r"must_cite_sources:\s*(\[[^\]]*\])", user)
    sources_present = bool(ms and ms.group(1).strip() not in ("[]", "[ ]"))

    if forbidden:
        sev = "L3"
    elif sources_present and cit < 0.5:
        sev = "L2"
    elif fact >= 0.99:
        sev = "L0"
    elif fact >= 0.6:
        sev = "L1"
    else:
        sev = "L2"

    return json.dumps(
        {
            "severity": sev,
            "scores": {
                "fact_accuracy": round(fact, 3),
                "hallucination_severity": sev,
                "citation_recall": round(cit, 3),
                "forbidden_hit": forbidden,
            },
            "explanation": _JUDGE_EXPL[sev],
        },
        ensure_ascii=False,
    )


# ── writer ──


def _mock_writer(user: str) -> str:
    rec = "—"
    m = re.search(r"Pareto recommendation:\s*(.+)", user)
    if m:
        rec = m.group(1).strip().splitlines()[0].strip()

    pr = "—"
    m2 = re.search(r"-\s*" + re.escape(rec) + r":.*?pass_rate=([\d.]+%)", user)
    if m2:
        pr = m2.group(1)

    book = {
        "recommendation": {
            "model": rec,
            "headline": f"采用 {rec}：在本场景下综合表现最优，建议作为上线基线。",
            "pull_quote": f"{rec} 以 {pr} 的通过率守住关键事实底线，且单位成本可控。",
        },
        "tradeoff_paragraph": (
            f"在准确率与成本的权衡上，{rec} 落在当前候选集合的帕累托前沿：通过率 {pr}，"
            "单 trial 成本处于同档最低区间。相对更便宜的候选虽节省约三成调用成本，但 L2 级"
            "事实缺失显著升高，不足以覆盖合规场景的风险敞口。"
        ),
        "annual_spend_table": {
            "assumptions": "假设日均 1 万次调用、全年 365 天估算。",
            "rows": [{"model": rec, "yuan_per_year": 36500}],
        },
        "narratives": {
            "boss": {
                "title": "上线该模型可在控制成本的同时显著降低回归风险。",
                "body": (
                    f"{rec} 在本次回归测试中通过率最高，意味着改 prompt 后线上事故概率更低。"
                    "按当前调用量估算，全年推理成本可控且与次优候选差距不大，ROI 体现在减少一次"
                    "线上合规事故即可覆盖整年模型支出。建议直接采用，无需再做一轮选型。"
                ),
            },
            "compliance": {
                "title": "对 L2 级风险设置人工复核闸门后整体可控。",
                "body": (
                    "测试中存在少量 L2 级事实缺失，集中在数字密集型问答。建议对判定为 L2 的输出"
                    "强制人工复核，并对关键合规场景配置回退模型；同时保留本测试集作为每次 prompt"
                    "变更的回归基线，确保红线场景不退化。"
                ),
            },
            "engineering": {
                "title": "迁移成本低，三步即可完成切换并验证。",
                "body": (
                    "1) 在模型路由配置中切换为目标 model id；2) 在本测试集上重跑回归，确认通过率不"
                    "低于基线；3) 灰度 10% 流量观察 L2/L3 命中率，无异常后全量。整个过程无需改动"
                    "业务侧 prompt 结构。"
                ),
            },
        },
        "risks": [
            {"severity": "L2", "risk": "数字密集型问答可能漏报关键财务指标。", "mitigation": "对 L2 命中样本加人工复核，并在 prompt 中强制逐项列出。"},
            {"severity": "L1", "risk": "长上下文摘要存在轻微表述偏差。", "mitigation": "在 system prompt 中强化忠实度约束并限制改写幅度。"},
        ],
    }
    return json.dumps(book, ensure_ascii=False)


# ── latency model (deterministic, varies per model for a realistic scoreboard) ──


def mock_latency_ms(model: str, content: str) -> int:
    base = 150 + _seed(model) % 600
    jitter = _seed(model, content[:24]) % 300
    return int(base + jitter)
