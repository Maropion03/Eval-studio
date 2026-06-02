import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { api, type Dataset as RealDataset, APIError } from '../services/api';

// ════════════════════════════════════════════════════════════════════
//  Mock catalogues
// ════════════════════════════════════════════════════════════════════

interface DatasetOption {
    id: string;
    name: string;
    code: string;
    cases: number;
    avgTokens: number;
    typicalL2Rate: number;          // % of cases that surface L2+ errors historically
    source: string;
    blurb: string;
    icon: string;                   // unicode glyph
}

const DATASETS: DatasetOption[] = [
    {
        id: 'financial_qa', code: 'FIN·QA', name: 'Financial QA',
        cases: 40, avgTokens: 420, typicalL2Rate: 3.5,
        source: '上市公司年报抽样 · 5 issuer',
        blurb: 'Number-dense QA over 10-K / 10-Q. Stresses fact-accuracy on amounts, dates, ratio precision.',
        icon: '￥',
    },
    {
        id: 'compliance_audit', code: 'COMP·AUD', name: 'Compliance Audit',
        cases: 30, avgTokens: 680, typicalL2Rate: 12.2,
        source: 'CSRC public penalty decisions',
        blurb: 'Clause citation + violation classification. Hard floor: must cite the right regulation, no soft answers.',
        icon: '§',
    },
    {
        id: 'research_summary', code: 'RES·SUM', name: 'Research Summary',
        cases: 30, avgTokens: 5400, typicalL2Rate: 5.0,
        source: 'Equity research reports 2024-25',
        blurb: 'Long-context summarization. Tests faithfulness to source conclusions and recommendation framing.',
        icon: '∑',
    },
    {
        id: 'fraud_detection', code: 'FRD·DET', name: 'Fraud Detection',
        cases: 40, avgTokens: 1240, typicalL2Rate: 7.5,
        source: 'Synthesized from financial fraud research dataset',
        blurb: 'Multi-signal anomaly identification. Tests boundary judgment on related-party concealment.',
        icon: '◬',
    },
];

interface PromptVersion {
    id: string;
    tag: string;
    desc: string;
    tokens: number;
    edited: string;
}

const PROMPTS: PromptVersion[] = [
    { id: 'v1', tag: 'BASELINE', desc: '3-shot CoT · baseline persona',          tokens: 320, edited: '2026-05-12' },
    { id: 'v2', tag: 'PROD',     desc: '+ regulatory citation requirement',      tokens: 412, edited: '2026-05-18' },
    { id: 'v3', tag: 'CURRENT',  desc: '+ amount-normalization rule',            tokens: 458, edited: '2026-05-22' },
    { id: 'v4', tag: 'DRAFT',    desc: '+ related-party hop-depth instruction',  tokens: 502, edited: '2026-05-26' },
];

interface ModelOption {
    id: string;
    apiId: string;          // model id as understood by the backend / SiliconFlow / DeepSeek
    name: string;
    vendor: string;
    tier: 'FLAGSHIP' | 'BALANCED' | 'BUDGET';
    costPer1k: number;
    contextK: number;
}

/**
 * Defaults below all route through SiliconFlow — keeps the demo flowing with
 * just one BYOK key. Drop in OpenAI / Anthropic keys via Settings to enable
 * gpt-4o / claude as candidates.
 */
const MODELS_AVAIL: ModelOption[] = [
    { id: 'ds-v4-pro',    apiId: 'deepseek-ai/DeepSeek-V4-Pro',  name: 'DeepSeek-V4 · Pro',   vendor: 'DeepSeek',   tier: 'FLAGSHIP', costPer1k: 1.20, contextK: 128 },
    { id: 'ds-v4-flash',  apiId: 'deepseek-ai/DeepSeek-V4-Flash',name: 'DeepSeek-V4 · Flash', vendor: 'DeepSeek',   tier: 'BUDGET',   costPer1k: 0.30, contextK: 128 },
    { id: 'ds-v32',       apiId: 'deepseek-ai/DeepSeek-V3.2',    name: 'DeepSeek-V3.2',       vendor: 'DeepSeek',   tier: 'BALANCED', costPer1k: 1.00, contextK: 128 },
    { id: 'ds-v3',        apiId: 'deepseek-ai/DeepSeek-V3',      name: 'DeepSeek-V3',         vendor: 'DeepSeek',   tier: 'BALANCED', costPer1k: 1.00, contextK: 128 },
    { id: 'ds-r1',        apiId: 'deepseek-ai/DeepSeek-R1',      name: 'DeepSeek-R1',         vendor: 'DeepSeek',   tier: 'FLAGSHIP', costPer1k: 2.20, contextK: 128 },
    { id: 'qwen-72b',     apiId: 'Qwen/Qwen2.5-72B-Instruct',    name: 'Qwen-2.5 · 72B',      vendor: 'Alibaba',    tier: 'BALANCED', costPer1k: 0.85, contextK: 32  },
    { id: 'gpt-4o',       apiId: 'openai/gpt-4o',                name: 'GPT-4o',              vendor: 'OpenAI',     tier: 'FLAGSHIP', costPer1k: 5.00, contextK: 128 },
    { id: 'claude-46',    apiId: 'anthropic/claude-sonnet-4-5',  name: 'Claude 4.6 · Sonnet', vendor: 'Anthropic',  tier: 'FLAGSHIP', costPer1k: 3.00, contextK: 200 },
];

interface JudgeDim {
    id: string;
    name: string;
    short: string;
    desc: string;
    severity: 'critical' | 'standard' | 'optional';
    sevTier: 'L0-L3' | 'L0-L2' | 'L0-L1';
    defaultOn: boolean;
}

const JUDGES: JudgeDim[] = [
    { id: 'fact',     name: 'Fact Accuracy',          short: 'FACT·ACC',  severity: 'critical', sevTier: 'L0-L3',
      desc: 'Numeric / date / entity match against ground truth. Must be 1:1; tolerance handled by rule engine.', defaultOn: true },
    { id: 'halluc',   name: 'Hallucination Severity', short: 'HALLUC·SEV',severity: 'critical', sevTier: 'L0-L3',
      desc: 'Judge LLM grades fabricated claims into L0-L3 tiers (no harm / data drift / compliance / decision-grade).', defaultOn: true },
    { id: 'cite',     name: 'Citation Recall',        short: 'CITE·REC',  severity: 'standard', sevTier: 'L0-L2',
      desc: 'Required-source coverage. Only fires for scenarios that mark must_cite_sources in their reference.', defaultOn: true },
    { id: 'forbidden',name: 'Forbidden Hit',          short: 'FORB·HIT',  severity: 'critical', sevTier: 'L0-L3',
      desc: 'Boolean red-line detection. Triggers L2/L3 instantly when any forbidden_claim string appears.', defaultOn: true },
    { id: 'consist',  name: 'Reasoning Consistency',  short: 'CONS·CHK',  severity: 'standard', sevTier: 'L0-L2',
      desc: 'Cross-section consistency check across multi-step CoT. Catches contradictions inside one response.', defaultOn: false },
    { id: 'pareto',   name: 'Pareto Position',        short: 'PARETO',    severity: 'optional', sevTier: 'L0-L1',
      desc: 'Derived metric — places each model on the cost × accuracy frontier. Always computed, free.', defaultOn: true },
];

// ════════════════════════════════════════════════════════════════════
//  Page
// ════════════════════════════════════════════════════════════════════

type StepId = 1 | 2 | 3;

function kindFromSelection(modelCount: number, promptCount: number): 'PROMPT' | 'MODEL' | 'SELECT' {
    if (modelCount >= 3) return 'SELECT';
    if (promptCount > 1) return 'PROMPT';
    return 'MODEL';
}

export default function NewRun() {
    const navigate = useNavigate();
    const [step, setStep] = useState<StepId>(1);
    const [datasetId, setDatasetId] = useState<string>('fraud_detection');
    const [promptIds, setPromptIds] = useState<Set<string>>(new Set(['v3', 'v4']));
    const [modelIds, setModelIds] = useState<Set<string>>(new Set(['ds-v3', 'ds-v32', 'ds-r1', 'qwen-72b']));
    const [temperature, setTemperature] = useState(0.2);
    const [judges, setJudges] = useState<Set<string>>(
        new Set(JUDGES.filter(j => j.defaultOn).map(j => j.id))
    );

    // Real datasets from backend (used for the actual POST). UI keeps the
    // designed mock cards so the demo still looks rich when API is down.
    const [realDatasets, setRealDatasets] = useState<RealDataset[] | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        api.datasets.list()
            .then((ds) => { if (!cancelled) setRealDatasets(ds); })
            .catch(() => { /* offline — fall back to mock UI */ });
        return () => { cancelled = true; };
    }, []);

    const dataset = DATASETS.find(d => d.id === datasetId)!;

    // ── Live calc ─────────────────────────────────────────────
    const calc = useMemo(() => {
        const N = promptIds.size || 1;
        const M = modelIds.size || 1;
        const K = dataset.cases;
        const trials = N * M * K;

        let totalTokens = 0;
        modelIds.forEach(mid => {
            const m = MODELS_AVAIL.find(x => x.id === mid)!;
            const promptAvg = Array.from(promptIds).reduce((s, pid) =>
                s + (PROMPTS.find(p => p.id === pid)?.tokens || 400), 0
            ) / N;
            // input ≈ prompt + context; output ≈ 200 tokens; cost on input only for the mock
            void m;
            totalTokens += N * K * (promptAvg + dataset.avgTokens + 200);
        });

        let cost = 0;
        modelIds.forEach(mid => {
            const m = MODELS_AVAIL.find(x => x.id === mid)!;
            const promptAvg = Array.from(promptIds).reduce((s, pid) =>
                s + (PROMPTS.find(p => p.id === pid)?.tokens || 400), 0
            ) / N;
            const tokensPerTrial = promptAvg + dataset.avgTokens + 200;
            cost += N * K * (tokensPerTrial / 1000) * m.costPer1k;
        });

        const etaSec = Math.round(trials * 2.1);  // mock 2.1s per trial avg
        const etaMin = Math.floor(etaSec / 60);
        const etaRem = etaSec - etaMin * 60;
        const eta = etaMin > 0 ? `${etaMin}m ${etaRem.toString().padStart(2, '0')}s` : `${etaRem}s`;

        return { trials, N, M, K, cost, eta, totalTokens };
    }, [promptIds, modelIds, dataset]);

    const stepReady: Record<StepId, boolean> = {
        1: datasetId.length > 0,
        2: promptIds.size > 0 && modelIds.size > 0,
        3: judges.size > 0,
    };
    const allReady = stepReady[1] && stepReady[2] && stepReady[3];

    // ── Real submit: POST experiment + run, then navigate to live ──
    async function onStart() {
        setSubmitError(null);
        setSubmitting(true);
        try {
            if (!realDatasets || realDatasets.length === 0) {
                // Backend offline — keep the demo flowing with a navigable mock id
                navigate('/runs/run-042/live');
                return;
            }
            const real = realDatasets.find(d => d.scenario === dataset.id);
            if (!real) {
                throw new Error(`scenario ${dataset.id} not found on backend`);
            }

            // Resolve model.apiId for the backend call (not the display id)
            const modelApiIds = Array.from(modelIds)
                .map(id => MODELS_AVAIL.find(m => m.id === id)?.apiId)
                .filter((x): x is string => !!x);

            const exp = await api.experiments.create({
                title: `${kindFromSelection(modelIds.size, promptIds.size)} · ${real.name}`,
                kind: kindFromSelection(modelIds.size, promptIds.size),
                dataset_id: real.id,
                variable_axes: {
                    prompts: Array.from(promptIds),
                    models: modelApiIds,
                    params: { temperature },
                },
                judge_dims: Array.from(judges),
            });

            const run = await api.runs.create(exp.id);
            navigate(`/runs/${run.id}/live`);
        } catch (e) {
            const msg = e instanceof APIError ? `${e.message} ${JSON.stringify(e.detail || '')}` : String(e);
            setSubmitError(msg);
            setSubmitting(false);
        }
    }

    return (
        <div className="max-w-[1320px] mx-auto pb-32 reveal-in">
            {/* ── Page Header ────────────────────────────── */}
            <header className="mb-8">
                <div className="flex items-center gap-3 text-[10.5px] tracking-[0.28em] text-[var(--color-text-dim)]">
                    <Link to="/" className="hover:text-[var(--color-amber)] transition-colors">
                        ◀ MODULE 01
                    </Link>
                    <span className="text-[var(--color-text-fade)]">/</span>
                    <span>MODULE 02 · NEW RUN</span>
                </div>
                <h1 className="font-crt text-[72px] leading-[0.9] tracking-[0.01em] text-[var(--color-text-bright)] mt-2">
                    NEW&nbsp;RUN<span className="blink text-[var(--color-amber)] glow-amber">_</span>
                </h1>
                <p className="mt-3 text-[12px] tracking-[0.06em] text-[var(--color-text-muted)] max-w-[640px]">
                    Configure your experiment in three steps. Cost & ETA stream live as you change variables.
                </p>
            </header>

            {/* ── Stepper ─────────────────────────────────── */}
            <Stepper step={step} setStep={setStep} ready={stepReady} />

            {/* ── Step content ────────────────────────────── */}
            <div className="mt-8">
                {step === 1 && (
                    <Step1Dataset
                        selected={datasetId}
                        onSelect={setDatasetId}
                    />
                )}
                {step === 2 && (
                    <Step2Variables
                        promptIds={promptIds} setPromptIds={setPromptIds}
                        modelIds={modelIds} setModelIds={setModelIds}
                        temperature={temperature} setTemperature={setTemperature}
                    />
                )}
                {step === 3 && (
                    <Step3Judges
                        judges={judges} setJudges={setJudges}
                    />
                )}
            </div>

            {/* Submit error banner */}
            {submitError && (
                <div className="mt-6 border border-[var(--color-L2)] bg-[var(--color-L2-trace)] px-4 py-3
                                font-mono text-[11px] tracking-[0.06em] text-[var(--color-L2)]">
                    <span className="font-data">✗ START FAILED</span>
                    <span className="ml-3 text-[var(--color-text-bright)]">{submitError}</span>
                </div>
            )}

            {/* ── Sticky preview footer ───────────────────── */}
            <StickyFooter
                step={step}
                setStep={setStep}
                calc={calc}
                allReady={allReady && !submitting}
                onStart={onStart}
            />
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  Stepper
// ════════════════════════════════════════════════════════════════════

function Stepper({ step, setStep, ready }: { step: StepId; setStep: (s: StepId) => void; ready: Record<StepId, boolean> }) {
    const steps: { id: StepId; label: string; sub: string }[] = [
        { id: 1, label: 'DATASET',   sub: 'Pick a benchmark slice' },
        { id: 2, label: 'VARIABLES', sub: 'Configure prompt × model × params' },
        { id: 3, label: 'JUDGES',    sub: 'Choose evaluation dimensions' },
    ];
    return (
        <div className="border-y border-[var(--color-border)] grid grid-cols-3">
            {steps.map((s, i) => {
                const active = step === s.id;
                const isReady = ready[s.id];
                const isPast = step > s.id;
                return (
                    <button
                        key={s.id}
                        onClick={() => setStep(s.id)}
                        className={`
                            relative text-left px-5 py-4 transition-colors duration-100
                            ${i < 2 ? 'border-r border-[var(--color-border)]' : ''}
                            ${active ? 'bg-[var(--color-amber-trace)]' : 'hover:bg-[var(--color-panel)]'}
                        `}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`
                                inline-flex items-center justify-center w-7 h-7 border font-data text-[11px]
                                ${active
                                    ? 'border-[var(--color-amber)] text-[var(--color-amber)] glow-amber-soft bg-[var(--color-amber-trace)]'
                                    : isPast && isReady
                                    ? 'border-[var(--color-mint)] text-[var(--color-mint)]'
                                    : 'border-[var(--color-border-strong)] text-[var(--color-text-muted)]'
                                }
                            `}>
                                {isPast && isReady ? '✓' : `0${s.id}`}
                            </span>
                            <div>
                                <div className={`font-mono text-[12px] tracking-[0.22em] ${
                                    active ? 'text-[var(--color-amber)]'
                                    : isPast && isReady ? 'text-[var(--color-text-bright)]'
                                    : 'text-[var(--color-text-muted)]'
                                }`}>
                                    STEP {s.id} · {s.label}
                                </div>
                                <div className="text-[10.5px] text-[var(--color-text-fade)] tracking-[0.06em] mt-0.5">
                                    {s.sub}
                                </div>
                            </div>
                        </div>
                        {active && (
                            <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--color-amber)]"
                                  style={{ boxShadow: '0 0 10px var(--color-amber)' }} />
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  Step 1 · Dataset cards
// ════════════════════════════════════════════════════════════════════

function Step1Dataset({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
    return (
        <div>
            <div className="tl-rule mb-5"><span>STARTER PACK · 4 SCENARIOS · 140 SEED CASES</span></div>
            <div className="grid grid-cols-2 gap-5">
                {DATASETS.map(d => {
                    const active = d.id === selected;
                    return (
                        <button
                            key={d.id}
                            onClick={() => onSelect(d.id)}
                            className={`
                                group text-left p-5 transition-all duration-100
                                border ${active
                                    ? 'border-[var(--color-amber)] bg-[var(--color-amber-trace)]'
                                    : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-panel)]'
                                }
                            `}
                            style={active ? { boxShadow: '0 0 20px var(--color-amber-glow), inset 0 0 0 1px var(--color-amber)' } : undefined}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <span className={`font-display text-[26px] leading-none ${
                                        active ? 'text-[var(--color-amber)] glow-amber-soft' : 'text-[var(--color-text-bright)]'
                                    }`}>{d.icon}</span>
                                    <div>
                                        <div className={`font-mono text-[10.5px] tracking-[0.2em] ${
                                            active ? 'text-[var(--color-amber)]' : 'text-[var(--color-text-fade)]'
                                        }`}>
                                            {d.code}
                                        </div>
                                        <div className={`text-[18px] tracking-[0.01em] ${
                                            active ? 'text-[var(--color-amber)] glow-amber-soft' : 'text-[var(--color-text-bright)]'
                                        }`}>
                                            {d.name}
                                        </div>
                                    </div>
                                </div>
                                <span className={`
                                    inline-flex items-center justify-center w-5 h-5 border font-data text-[10px]
                                    ${active
                                        ? 'border-[var(--color-amber)] text-[var(--color-amber)] bg-[var(--color-amber)] !text-[var(--color-canvas)]'
                                        : 'border-[var(--color-border-strong)] text-transparent group-hover:text-[var(--color-text-fade)]'
                                    }
                                `}>
                                    {active ? '✓' : '◌'}
                                </span>
                            </div>

                            <p className="text-[12.5px] leading-[1.6] text-[var(--color-text-muted)] mb-4">
                                {d.blurb}
                            </p>

                            <div className="grid grid-cols-3 gap-3 text-[10.5px] font-data border-t border-[var(--color-border)] pt-3">
                                <div>
                                    <div className="text-[var(--color-text-dim)] tracking-[0.16em]">CASES</div>
                                    <div className="text-[var(--color-text-bright)] mt-0.5">{d.cases}</div>
                                </div>
                                <div>
                                    <div className="text-[var(--color-text-dim)] tracking-[0.16em]">AVG TOK</div>
                                    <div className="text-[var(--color-text-bright)] mt-0.5">{d.avgTokens.toLocaleString()}</div>
                                </div>
                                <div>
                                    <div className="text-[var(--color-text-dim)] tracking-[0.16em]">TYP L2+</div>
                                    <div className={`mt-0.5 ${
                                        d.typicalL2Rate > 10 ? 'text-[var(--color-L2)]'
                                        : d.typicalL2Rate > 6 ? 'text-[var(--color-L1)]'
                                        : 'text-[var(--color-mint)]'
                                    }`}>
                                        {d.typicalL2Rate}%
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 text-[10px] text-[var(--color-text-fade)] tracking-[0.06em] italic">
                                source: {d.source}
                            </div>
                        </button>
                    );
                })}

                {/* Upload card */}
                <button
                    className="p-5 border border-dashed border-[var(--color-border-strong)]
                               hover:border-[var(--color-amber)] hover:bg-[var(--color-amber-trace)]
                               transition-colors duration-100 group col-span-2 text-left"
                >
                    <div className="flex items-center gap-3">
                        <span className="font-display text-[26px] text-[var(--color-text-muted)] group-hover:text-[var(--color-amber)]">＋</span>
                        <div>
                            <div className="font-mono text-[10.5px] tracking-[0.2em] text-[var(--color-text-fade)]">
                                UPLOAD ·  JSON / CSV
                            </div>
                            <div className="text-[14px] text-[var(--color-text-bright)] tracking-[0.01em]">
                                Bring your own dataset
                            </div>
                            <div className="text-[11.5px] text-[var(--color-text-muted)] mt-1">
                                Schema validated client-side · see <span className="text-[var(--color-amber)]">docs/dataset-schema.json</span>
                            </div>
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  Step 2 · Variables
// ════════════════════════════════════════════════════════════════════

function Step2Variables({
    promptIds, setPromptIds, modelIds, setModelIds, temperature, setTemperature,
}: {
    promptIds: Set<string>; setPromptIds: (s: Set<string>) => void;
    modelIds: Set<string>;  setModelIds: (s: Set<string>) => void;
    temperature: number;    setTemperature: (n: number) => void;
}) {
    const togglePrompt = (id: string) => {
        const next = new Set(promptIds);
        next.has(id) ? next.delete(id) : next.add(id);
        setPromptIds(next);
    };
    const toggleModel = (id: string) => {
        const next = new Set(modelIds);
        next.has(id) ? next.delete(id) : next.add(id);
        setModelIds(next);
    };

    return (
        <div className="space-y-8">
            {/* Prompt axis */}
            <section>
                <div className="tl-rule mb-3">
                    <span>AXIS · 01 · PROMPT VERSIONS ({promptIds.size} SELECTED)</span>
                </div>
                <div className="border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                    {PROMPTS.map(p => {
                        const on = promptIds.has(p.id);
                        return (
                            <button
                                key={p.id}
                                onClick={() => togglePrompt(p.id)}
                                className={`
                                    w-full grid grid-cols-[40px_70px_minmax(0,1fr)_80px_120px] gap-4
                                    items-center text-left px-4 py-3 transition-colors duration-100
                                    ${on ? 'bg-[var(--color-amber-trace)]' : 'hover:bg-[var(--color-panel)]'}
                                `}
                            >
                                <Checkbox checked={on} />
                                <span className={`font-data text-[12px] tracking-[0.18em] ${
                                    on ? 'text-[var(--color-amber)] glow-amber-soft' : 'text-[var(--color-text-muted)]'
                                }`}>
                                    prompt/{p.id}
                                </span>
                                <div>
                                    <div className="text-[13px] text-[var(--color-text-bright)] tracking-[0.01em]">
                                        {p.desc}
                                    </div>
                                </div>
                                <span className="font-data text-[10.5px] text-[var(--color-text-fade)] tracking-widest">
                                    {p.tokens} TOK
                                </span>
                                <div className="text-right">
                                    <span className={`inline-block px-1.5 py-[1px] text-[9.5px] font-data tracking-[0.16em] border
                                        ${p.tag === 'CURRENT' ? 'text-[var(--color-mint)] border-[var(--color-mint)]'
                                        : p.tag === 'DRAFT'   ? 'text-[var(--color-amber)] border-[var(--color-amber)]'
                                        : p.tag === 'PROD'    ? 'text-[var(--color-text-bright)] border-[var(--color-border-strong)]'
                                        : 'text-[var(--color-text-muted)] border-[var(--color-border)]'
                                    }`}>
                                        {p.tag}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Model axis */}
            <section>
                <div className="tl-rule mb-3">
                    <span>AXIS · 02 · MODELS ({modelIds.size} SELECTED)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {MODELS_AVAIL.map(m => {
                        const on = modelIds.has(m.id);
                        const tierTone =
                            m.tier === 'FLAGSHIP' ? 'text-[var(--color-amber-bright)] border-[var(--color-amber)]'
                            : m.tier === 'BALANCED' ? 'text-[var(--color-mint)] border-[var(--color-mint)]'
                            : 'text-[var(--color-text-muted)] border-[var(--color-border-strong)]';
                        return (
                            <button
                                key={m.id}
                                onClick={() => toggleModel(m.id)}
                                className={`
                                    grid grid-cols-[40px_minmax(0,1fr)_100px_70px] gap-3 items-center
                                    text-left px-4 py-3 border transition-colors duration-100
                                    ${on
                                        ? 'border-[var(--color-amber)] bg-[var(--color-amber-trace)]'
                                        : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-panel)]'
                                    }
                                `}
                            >
                                <Checkbox checked={on} />
                                <div>
                                    <div className={`text-[13.5px] tracking-[0.01em] ${
                                        on ? 'text-[var(--color-amber)] glow-amber-soft' : 'text-[var(--color-text-bright)]'
                                    }`}>
                                        {m.name}
                                    </div>
                                    <div className="text-[10.5px] font-data text-[var(--color-text-fade)] tracking-[0.1em] uppercase mt-0.5">
                                        {m.vendor} · {m.contextK}K CTX
                                    </div>
                                </div>
                                <span className={`text-[9.5px] font-data tracking-[0.18em] px-1.5 py-[1px] border self-center ${tierTone}`}>
                                    {m.tier}
                                </span>
                                <div className="text-right font-data">
                                    <div className="text-[12px] text-[var(--color-amber)] glow-amber-soft">
                                        ¥{m.costPer1k.toFixed(2)}
                                    </div>
                                    <div className="text-[9.5px] text-[var(--color-text-fade)]">/ 1K</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Param axis */}
            <section>
                <div className="tl-rule mb-3">
                    <span>AXIS · 03 · PARAMETERS</span>
                </div>
                <div className="border border-[var(--color-border)] px-5 py-5 grid grid-cols-3 gap-8">
                    <Slider
                        label="TEMPERATURE"
                        value={temperature}
                        min={0} max={1.5} step={0.05}
                        onChange={setTemperature}
                        format={v => v.toFixed(2)}
                        help="Lower → more deterministic. Recommended ≤ 0.3 for fact-heavy tasks."
                    />
                    <Slider
                        label="TOP_P"
                        value={1.0}
                        min={0.1} max={1.0} step={0.05}
                        onChange={() => {}}
                        format={v => v.toFixed(2)}
                        help="Nucleus sampling. Keep at 1.0 unless paired with temperature ≥ 0.7."
                        disabled
                    />
                    <Slider
                        label="MAX TOKENS"
                        value={1024}
                        min={128} max={4096} step={128}
                        onChange={() => {}}
                        format={v => `${v}`}
                        help="Output budget. Raise for long-form summary scenarios."
                        disabled
                    />
                </div>
            </section>
        </div>
    );
}

function Checkbox({ checked }: { checked: boolean }) {
    return (
        <span className={`
            inline-flex items-center justify-center w-5 h-5 border font-data text-[11px]
            ${checked
                ? 'border-[var(--color-amber)] bg-[var(--color-amber)] text-[var(--color-canvas)]'
                : 'border-[var(--color-border-strong)] text-transparent'
            }
        `}>
            {checked ? '✓' : ' '}
        </span>
    );
}

function Slider({ label, value, min, max, step, onChange, format, help, disabled }: {
    label: string; value: number; min: number; max: number; step: number;
    onChange: (n: number) => void;
    format: (v: number) => string; help?: string; disabled?: boolean;
}) {
    const pct = ((value - min) / (max - min)) * 100;
    return (
        <div className={disabled ? 'opacity-50' : ''}>
            <div className="flex items-baseline justify-between mb-2">
                <span className="font-mono text-[10.5px] tracking-[0.22em] text-[var(--color-text-dim)]">
                    {label}
                </span>
                <span className="font-data text-[14px] text-[var(--color-amber)] glow-amber-soft">
                    {format(value)}
                </span>
            </div>
            <div className="relative h-[6px] bg-[var(--color-panel-3)]">
                <div className="absolute top-0 left-0 h-full bg-[var(--color-amber)]"
                     style={{ width: `${pct}%`, boxShadow: '0 0 6px var(--color-amber)' }} />
                <input
                    type="range"
                    min={min} max={max} step={step} value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    disabled={disabled}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <span
                    aria-hidden
                    className="absolute top-1/2 -translate-y-1/2 w-[10px] h-[10px] bg-[var(--color-amber)] pointer-events-none"
                    style={{ left: `calc(${pct}% - 5px)`, boxShadow: '0 0 8px var(--color-amber)' }}
                />
            </div>
            <div className="flex justify-between mt-1.5 text-[9.5px] font-data text-[var(--color-text-fade)] tracking-widest">
                <span>{format(min)}</span>
                <span>{format(max)}</span>
            </div>
            {help && (
                <p className="mt-3 text-[10.5px] text-[var(--color-text-muted)] leading-[1.6]">
                    {help}
                </p>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  Step 3 · Judges
// ════════════════════════════════════════════════════════════════════

function Step3Judges({ judges, setJudges }: { judges: Set<string>; setJudges: (s: Set<string>) => void }) {
    const toggle = (id: string) => {
        const next = new Set(judges);
        next.has(id) ? next.delete(id) : next.add(id);
        setJudges(next);
    };

    return (
        <div className="space-y-5">
            <div className="tl-rule mb-3">
                <span>JUDGE DIMENSIONS · {judges.size} ENABLED</span>
            </div>

            <div className="border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {JUDGES.map(j => {
                    const on = judges.has(j.id);
                    const sevColor =
                        j.severity === 'critical' ? 'var(--color-L2)'
                        : j.severity === 'standard' ? 'var(--color-amber)'
                        : 'var(--color-text-muted)';
                    return (
                        <button
                            key={j.id}
                            onClick={() => toggle(j.id)}
                            className={`
                                w-full grid grid-cols-[40px_minmax(0,2fr)_100px_minmax(0,3fr)] gap-5
                                items-start text-left px-5 py-4 transition-colors duration-100
                                ${on ? 'bg-[var(--color-amber-trace)]' : 'hover:bg-[var(--color-panel)]'}
                            `}
                        >
                            <Checkbox checked={on} />

                            <div>
                                <div className="flex items-center gap-2.5">
                                    <span className={`text-[14px] tracking-[0.01em] ${
                                        on ? 'text-[var(--color-amber)] glow-amber-soft' : 'text-[var(--color-text-bright)]'
                                    }`}>
                                        {j.name}
                                    </span>
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[10.5px] font-data">
                                    <span className="px-1.5 py-[1px] border tracking-[0.16em]"
                                          style={{ color: sevColor, borderColor: sevColor }}>
                                        {j.severity.toUpperCase()}
                                    </span>
                                    <span className="text-[var(--color-text-fade)] tracking-widest">{j.short}</span>
                                </div>
                            </div>

                            <div className="font-data text-[10.5px] tracking-[0.16em] text-[var(--color-text-fade)] uppercase pt-1">
                                tier {j.sevTier}
                            </div>

                            <p className="text-[12px] text-[var(--color-text-muted)] leading-[1.6] pt-0.5">
                                {j.desc}
                            </p>
                        </button>
                    );
                })}
            </div>

            {/* Add custom dim */}
            <button className="w-full px-5 py-4 border border-dashed border-[var(--color-border-strong)]
                               hover:border-[var(--color-amber)] hover:bg-[var(--color-amber-trace)]
                               text-left transition-colors duration-100 group">
                <div className="flex items-center gap-3">
                    <span className="font-display text-[20px] text-[var(--color-text-muted)] group-hover:text-[var(--color-amber)]">＋</span>
                    <div>
                        <div className="text-[13px] text-[var(--color-text-bright)]">Define custom judge dimension</div>
                        <div className="text-[10.5px] text-[var(--color-text-fade)] tracking-[0.06em] mt-0.5">
                            Write your own rubric & judge prompt · advanced
                        </div>
                    </div>
                </div>
            </button>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  Sticky preview footer
// ════════════════════════════════════════════════════════════════════

function StickyFooter({
    step, setStep, calc, allReady, onStart,
}: {
    step: StepId;
    setStep: (s: StepId) => void;
    calc: { trials: number; N: number; M: number; K: number; cost: number; eta: string; totalTokens: number };
    allReady: boolean;
    onStart: () => void;
}) {
    return (
        <div className="fixed bottom-0 left-[248px] right-0 z-20
                        bg-[var(--color-canvas)] border-t border-[var(--color-border)]">
            <div className="max-w-[1320px] mx-auto px-8 py-3 grid grid-cols-[minmax(0,1fr)_auto] gap-8 items-center">
                {/* Live calc readout */}
                <div className="grid grid-cols-4 gap-4">
                    <FootCell
                        label="MATRIX"
                        value={
                            <span className="font-data">
                                <span className="text-[var(--color-amber-bright)]">{calc.N}</span>
                                <span className="text-[var(--color-text-fade)]"> × </span>
                                <span className="text-[var(--color-amber-bright)]">{calc.M}</span>
                                <span className="text-[var(--color-text-fade)]"> × </span>
                                <span className="text-[var(--color-amber-bright)]">{calc.K}</span>
                            </span>
                        }
                        sub="prompt × model × case"
                    />
                    <FootCell
                        label="TRIALS"
                        value={<span className="text-[var(--color-text-bright)] font-display">{calc.trials.toLocaleString()}</span>}
                        sub="total runs"
                    />
                    <FootCell
                        label="ETA"
                        value={<span className="text-[var(--color-mint)] glow-mint font-display">{calc.eta}</span>}
                        sub="estimated"
                    />
                    <FootCell
                        label="COST"
                        value={<span className="text-[var(--color-amber)] glow-amber-soft font-display">¥{calc.cost.toFixed(2)}</span>}
                        sub={`≈ ${Math.round(calc.totalTokens / 1000)}K tok`}
                    />
                </div>

                {/* Nav controls */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setStep((step === 1 ? 1 : step - 1) as StepId)}
                        disabled={step === 1}
                        className="px-4 py-2.5 font-mono text-[11px] tracking-[0.22em]
                                   text-[var(--color-text-muted)] border border-[var(--color-border)]
                                   hover:text-[var(--color-text-bright)] hover:border-[var(--color-border-strong)]
                                   disabled:opacity-30 disabled:cursor-not-allowed
                                   transition-colors duration-100"
                    >
                        ◀ BACK
                    </button>
                    {step < 3 ? (
                        <button
                            onClick={() => setStep((step + 1) as StepId)}
                            className="px-4 py-2.5 font-mono text-[11px] tracking-[0.22em]
                                       text-[var(--color-amber)] border border-[var(--color-amber)]
                                       hover:bg-[var(--color-amber)] hover:text-[var(--color-canvas)]
                                       transition-colors duration-100"
                        >
                            NEXT ▶
                        </button>
                    ) : (
                        <button
                            onClick={onStart}
                            disabled={!allReady}
                            className="px-5 py-2.5 font-mono text-[12px] tracking-[0.22em]
                                       text-[var(--color-canvas)] bg-[var(--color-amber)]
                                       border border-[var(--color-amber)]
                                       hover:bg-[var(--color-amber-bright)]
                                       disabled:opacity-30 disabled:cursor-not-allowed
                                       transition-colors duration-100 ring-amber"
                            style={{ boxShadow: '0 0 24px var(--color-amber-glow)' }}
                        >
                            ▶ START RUN
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function FootCell({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
    return (
        <div className="border-l border-[var(--color-border)] pl-4">
            <div className="text-[9.5px] tracking-[0.22em] text-[var(--color-text-dim)]">{label}</div>
            <div className="text-[18px] mt-0.5">{value}</div>
            <div className="text-[9.5px] tracking-[0.08em] text-[var(--color-text-fade)] font-data">{sub}</div>
        </div>
    );
}
