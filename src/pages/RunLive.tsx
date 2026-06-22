import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';

// A real backend run id looks like `run_xxxxxxxxxx`. Any other id (e.g.
// `run-042`) is treated as a mock id and drives the local simulator so the
// demo still flows without a server.
function isRealRunId(id: string | undefined): boolean {
    return !!id && id.startsWith('run_');
}

// ════════════════════════════════════════════════════════════════════
//  Config — what this mock "run" looks like
// ════════════════════════════════════════════════════════════════════

const TOTAL_TRIALS  = 320;
const TICK_MS       = 180;          // ms between micro-batches
const TRIALS_PER_TICK = 4;
const LOG_KEEP      = 18;           // how many log lines to keep on screen

interface ModelLane { id: string; name: string; vendor: string; share?: number; costPer1k: number; }
const LANES: ModelLane[] = [
    { id: 'gpt-4o',      name: 'GPT-4o',       vendor: 'OpenAI',    share: 0.25, costPer1k: 5.00 },
    { id: 'claude-46',   name: 'Claude 4.6',   vendor: 'Anthropic', share: 0.25, costPer1k: 3.00 },
    { id: 'deepseek-v3', name: 'DeepSeek-V3',  vendor: 'DeepSeek',  share: 0.25, costPer1k: 1.00 },
    { id: 'qwen-max',    name: 'Qwen-Max',     vendor: 'Alibaba',   share: 0.25, costPer1k: 0.60 },
];

// per-model accuracy bias (mock outcome distribution)
const ACC_BIAS: Record<string, number> = {
    'gpt-4o':      0.94,
    'claude-46':   0.92,
    'deepseek-v3': 0.89,
    'qwen-max':    0.86,
};

interface TrialEvent {
    ts: number;
    idx: number;
    model: string;
    caseId: string;
    verdict: 'PASS' | 'L1' | 'L2' | 'L3';
    cost: number;
    latencyMs: number;
}

// deterministic pseudo-random
function makeRng(seed: number) {
    let s = seed;
    return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}

// ════════════════════════════════════════════════════════════════════
//  Hook — simulated live stream
// ════════════════════════════════════════════════════════════════════

function useRunStream(runId: string | undefined) {
    const [done, setDone]   = useState(0);
    const [log, setLog]     = useState<TrialEvent[]>([]);
    const [elapsed, setEla] = useState(0);
    const [costNow, setCost] = useState(0);
    const [perModel, setPerModel] = useState<Record<string, number>>(() =>
        Object.fromEntries(LANES.map(l => [l.id, 0]))
    );
    const [perModelSev, setPerModelSev] = useState<Record<string, { l1: number; l2: number; l3: number }>>(() =>
        Object.fromEntries(LANES.map(l => [l.id, { l1: 0, l2: 0, l3: 0 }]))
    );
    // For real runs these are replaced from the run/experiment config; mock keeps defaults.
    const [total, setTotal] = useState(TOTAL_TRIALS);
    const [lanes, setLanes] = useState<ModelLane[]>(LANES);
    const [meta, setMeta] = useState<{ title: string; scenario: string; models: number }>(
        { title: 'Model Selection', scenario: 'fraud detection', models: LANES.length }
    );

    // Refs hold the authoritative state — setters are called once per tick (no nested updaters)
    const doneRef     = useRef(0);
    const costRef     = useRef(0);
    const logRef      = useRef<TrialEvent[]>([]);
    const laneRef     = useRef<Record<string, number>>(
        Object.fromEntries(LANES.map(l => [l.id, 0]))
    );
    const sevRef      = useRef<Record<string, { l1: number; l2: number; l3: number }>>(
        Object.fromEntries(LANES.map(l => [l.id, { l1: 0, l2: 0, l3: 0 }]))
    );
    const rngRef      = useRef(makeRng(7));
    const startRef    = useRef<number>(0);

    const isReal = isRealRunId(runId);

    // Stamp the run start once on mount (kept out of render for purity).
    useEffect(() => { startRef.current = Date.now(); }, []);

    useEffect(() => {
        // ─── REAL backend SSE path ─────────────────────────────────
        if (isReal && runId) {
            let cancelled = false;
            let totalLocal = TOTAL_TRIALS;

            // Fetch the run + experiment so the progress total and per-model
            // lanes reflect THIS run (not the mock 320 / 4 fixed lanes).
            (async () => {
                try {
                    const run = await api.runs.get(runId);
                    const exp = await api.experiments.get(run.experiment_id);
                    if (cancelled) return;
                    const models = (exp.variable_axes.models ?? []) as string[];
                    totalLocal = run.trial_count || TOTAL_TRIALS;
                    setTotal(totalLocal);
                    if (models.length) {
                        setLanes(models.map(m => ({
                            id: m, name: m.split('/').pop() || m, vendor: m.split('/')[0] || '', costPer1k: 0,
                        })));
                    }
                    setMeta({ title: exp.title, scenario: exp.scenario, models: models.length });
                } catch { /* keep mock defaults if config unavailable */ }
            })();

            const apply = (ev: { idx: number; model: string | null; case_code: string | null;
                                 severity: string | null; cost: number; latency_ms: number;
                                 done: number; total: number; type: string }) => {
                if (ev.total > 0) { totalLocal = ev.total; setTotal(ev.total); }
                const verdict = (ev.severity === 'L0' || !ev.severity) ? 'PASS' : (ev.severity as 'L1' | 'L2' | 'L3');
                const laneId = ev.model || 'unknown';
                const newEv: TrialEvent = {
                    ts: Date.now(),
                    idx: ev.idx,
                    model: laneId,
                    caseId: ev.case_code || '',
                    verdict,
                    cost: ev.cost,
                    latencyMs: ev.latency_ms,
                };
                logRef.current = [newEv, ...logRef.current].slice(0, LOG_KEEP);
                doneRef.current = ev.done || (doneRef.current + 1);
                costRef.current += ev.cost;
                laneRef.current[laneId] = (laneRef.current[laneId] || 0) + 1;
                if (verdict !== 'PASS') {
                    if (!sevRef.current[laneId]) sevRef.current[laneId] = { l1: 0, l2: 0, l3: 0 };
                    sevRef.current[laneId][verdict.toLowerCase() as 'l1' | 'l2' | 'l3'] += 1;
                }

                setDone(doneRef.current);
                setCost(costRef.current);
                setLog(logRef.current);
                setPerModel({ ...laneRef.current });
                setPerModelSev({
                    ...Object.fromEntries(
                        Object.entries(sevRef.current).map(([k, v]) => [k, { ...v }])
                    )
                });
            };

            const cleanup = api.runs.stream(runId, {
                onTrial: apply,
                onComplete: async (ev) => {
                    if (ev.total > 0) { totalLocal = ev.total; setTotal(ev.total); }
                    doneRef.current = totalLocal;
                    setDone(totalLocal);
                    // The stream may replay only 'complete' (e.g. landing on an
                    // already-finished run) — backfill final per-lane counts +
                    // cost from the authoritative report.
                    try {
                        const rep = await api.runs.report(runId);
                        if (cancelled) return;
                        const pm: Record<string, number> = {};
                        const ps: Record<string, { l1: number; l2: number; l3: number }> = {};
                        for (const c of rep.candidates) {
                            pm[c.model] = c.trials;
                            ps[c.model] = { l1: c.l1, l2: c.l2, l3: c.l3 };
                        }
                        laneRef.current = pm;
                        sevRef.current = ps;
                        setPerModel(pm);
                        setPerModelSev(ps);
                        setCost(rep.run.cost_actual);
                    } catch { /* keep streamed values */ }
                },
                onError: (e) => {
                    console.error('SSE error', e);
                },
            });

            const tid = setInterval(() => setEla(Math.floor((Date.now() - startRef.current) / 1000)), 250);
            return () => { cancelled = true; cleanup(); clearInterval(tid); };
        }

        // ─── MOCK simulator path (kept for offline demos) ──────────
        const id = setInterval(() => {
            if (doneRef.current >= TOTAL_TRIALS) {
                clearInterval(id);
                return;
            }

            const rng = rngRef.current;
            const prev = doneRef.current;
            const batch = Math.min(TRIALS_PER_TICK, TOTAL_TRIALS - prev);
            const newEvents: TrialEvent[] = [];
            let costDelta = 0;

            for (let i = 0; i < batch; i++) {
                const trialIdx = prev + i + 1;
                const lane = LANES[Math.floor(rng() * LANES.length)];
                const r = rng();
                const accBias = ACC_BIAS[lane.id];
                let verdict: TrialEvent['verdict'];
                if (r < accBias) verdict = 'PASS';
                else if (r < accBias + (1 - accBias) * 0.65) verdict = 'L1';
                else if (r < accBias + (1 - accBias) * 0.95) verdict = 'L2';
                else verdict = 'L3';

                const caseId = `fin-${String(Math.floor(rng() * 40) + 1).padStart(3, '0')}`;
                const tokens = 1800 + Math.floor(rng() * 600);
                const cost = (tokens / 1000) * lane.costPer1k;
                const latency = 280 + Math.floor(rng() * 700);

                newEvents.push({
                    ts: Date.now(),
                    idx: trialIdx,
                    model: lane.id,
                    caseId,
                    verdict,
                    cost,
                    latencyMs: latency,
                });
                costDelta += cost;
                laneRef.current[lane.id] += 1;
                if (verdict !== 'PASS') {
                    sevRef.current[lane.id][verdict.toLowerCase() as 'l1' | 'l2' | 'l3'] += 1;
                }
            }

            doneRef.current = prev + batch;
            costRef.current += costDelta;
            logRef.current = [...newEvents.reverse(), ...logRef.current].slice(0, LOG_KEEP);

            setDone(doneRef.current);
            setCost(costRef.current);
            setLog(logRef.current);
            setPerModel({ ...laneRef.current });
            setPerModelSev({
                ...Object.fromEntries(
                    Object.entries(sevRef.current).map(([k, v]) => [k, { ...v }])
                )
            });
        }, TICK_MS);

        const tid = setInterval(() => setEla(Math.floor((Date.now() - startRef.current) / 1000)), 250);

        return () => { clearInterval(id); clearInterval(tid); };
    }, [runId, isReal]);

    return { done, total, lanes, meta, log, elapsed, costNow, perModel, perModelSev, isReal };
}

// ════════════════════════════════════════════════════════════════════
//  Page
// ════════════════════════════════════════════════════════════════════

export default function RunLive() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { done, total, lanes, meta, log, elapsed, costNow, perModel, perModelSev } = useRunStream(id);

    const pct      = total > 0 ? (done / total) * 100 : 0;
    const complete = total > 0 && done >= total;
    const remaining = Math.max(0, total - done);
    const rate     = elapsed > 0 ? done / elapsed : 0;
    const etaSec   = rate > 0 && !complete ? Math.round(remaining / rate) : 0;
    const eta      = formatDuration(etaSec);
    const elapsedStr = formatDuration(elapsed);

    // the currently active lane (mock: the lane that just had the most recent event)
    const currentModel = log[0]?.model;

    return (
        <div className="max-w-[1320px] mx-auto reveal-in pb-12">
            {/* ── Header ──────────────────────────────────── */}
            <header className="mb-6">
                <div className="flex items-center gap-3 text-[10.5px] tracking-[0.28em] text-[var(--color-text-dim)]">
                    <Link to="/" className="hover:text-[var(--color-amber)] transition-colors">◀ MODULE 01</Link>
                    <span className="text-[var(--color-text-fade)]">/</span>
                    <span>RUN · LIVE</span>
                    <span className="text-[var(--color-text-fade)]">/</span>
                    <span className="text-[var(--color-amber)]">#{(id ?? 'run-042').toUpperCase()}</span>
                </div>
                <h1 className="font-crt text-[64px] leading-[0.9] tracking-[0.01em] text-[var(--color-text-bright)] mt-2">
                    {complete ? (
                        <>COMPLETE<span className="text-[var(--color-mint)] glow-mint">_</span></>
                    ) : (
                        <>EXECUTING<span className="blink text-[var(--color-mint)] glow-mint">_</span></>
                    )}
                </h1>
                <div className="mt-3 flex items-center gap-3 text-[12px] text-[var(--color-text-muted)] font-data tracking-[0.04em]">
                    <span className="uppercase">{meta.title}</span>
                    <span className="text-[var(--color-text-fade)]">·</span>
                    <span className="uppercase">{meta.scenario.replace(/_/g, ' ')}</span>
                    <span className="text-[var(--color-text-fade)]">·</span>
                    <span>{meta.models} MODELS</span>
                    <span className="text-[var(--color-text-fade)]">·</span>
                    <span>{total} TRIALS</span>
                </div>
            </header>

            {/* ── Hero progress ───────────────────────────── */}
            <section className="border-y border-[var(--color-border)] py-8 mb-8 relative overflow-hidden">
                {/* scanning sweep */}
                {!complete && (
                    <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-[30%] pointer-events-none"
                        style={{
                            background: 'linear-gradient(90deg, transparent, rgba(79,227,160,0.12), transparent)',
                            animation: 'amber-sweep 3.5s linear infinite',
                            mixBlendMode: 'screen',
                        }}
                    />
                )}

                <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-12 items-center px-8">
                    <div>
                        <div className="flex items-baseline justify-between mb-3">
                            <div>
                                <div className="font-mono text-[10.5px] tracking-[0.22em] text-[var(--color-text-dim)]">
                                    PROGRESS · {complete ? 'COMPLETE' : 'STREAMING'}
                                </div>
                                <div className={`font-display text-[68px] leading-[0.9] tracking-tight mt-1 ${
                                    complete
                                        ? 'text-[var(--color-mint)] glow-mint'
                                        : 'text-[var(--color-amber)] glow-amber-soft'
                                }`}>
                                    {pct.toFixed(1)}<span className="text-[40px] text-[var(--color-text-fade)]">%</span>
                                </div>
                            </div>
                            <div className="text-right font-data">
                                <div className="text-[28px] text-[var(--color-text-bright)]">
                                    {done.toLocaleString()}
                                    <span className="text-[16px] text-[var(--color-text-fade)]"> / {total}</span>
                                </div>
                                <div className="text-[10px] tracking-[0.22em] text-[var(--color-text-dim)] mt-0.5">
                                    {complete ? 'TRIALS · ALL DONE' : `${remaining} TRIALS REMAINING`}
                                </div>
                            </div>
                        </div>

                        {/* Block-character bar */}
                        <BlockBar pct={pct} complete={complete} />

                        {/* Mini facts row */}
                        <div className="mt-5 grid grid-cols-4 gap-4 font-data">
                            <Fact label="ELAPSED" val={elapsedStr} tone="bright" />
                            <Fact label="ETA"     val={complete ? '—' : eta} tone={complete ? 'fade' : 'mint'} />
                            <Fact label="COST"    val={`¥${costNow.toFixed(2)}`} tone="amber" />
                            <Fact label="RATE"    val={`${rate.toFixed(1)} trial/s`} tone="bright" />
                        </div>
                    </div>

                    {/* Current activity (live) */}
                    <CurrentActivity currentModel={currentModel} complete={complete} latestLog={log[0]} lanes={lanes} total={total} />
                </div>
            </section>

            {/* ── Per-model lanes ─────────────────────────── */}
            <section className="mb-8">
                <div className="tl-rule mb-4"><span>PER-MODEL LANES</span></div>
                <div className="space-y-4">
                    {lanes.map(l => {
                        const laneTotal = l.share !== undefined
                            ? Math.round(total * l.share)
                            : Math.round(total / (lanes.length || 1));
                        const got = perModel[l.id] ?? 0;
                        const lanePct = laneTotal > 0 ? Math.min(100, (got / laneTotal) * 100) : 0;
                        const sev = perModelSev[l.id] ?? { l1: 0, l2: 0, l3: 0 };
                        const isLive = currentModel === l.id && !complete;
                        const laneComplete = got >= laneTotal && laneTotal > 0;
                        return (
                            <div key={l.id} className="grid grid-cols-[200px_minmax(0,1fr)_140px_120px] gap-4 items-center">
                                {/* Model name */}
                                <div className="flex items-center gap-2.5">
                                    <span className={`text-[12px] leading-none ${
                                        laneComplete ? 'text-[var(--color-mint)] glow-mint'
                                        : isLive ? 'text-[var(--color-mint)] glow-mint blink'
                                        : 'text-[var(--color-text-muted)]'
                                    }`}>
                                        {laneComplete ? '◉' : isLive ? '●' : '◌'}
                                    </span>
                                    <div>
                                        <div className={`text-[13.5px] tracking-[0.01em] ${
                                            laneComplete ? 'text-[var(--color-mint)]'
                                            : isLive ? 'text-[var(--color-amber)] glow-amber-soft'
                                            : 'text-[var(--color-text-bright)]'
                                        }`}>{l.name}</div>
                                        <div className="text-[10px] font-data text-[var(--color-text-fade)] tracking-[0.1em] uppercase mt-0.5">
                                            {l.vendor}{l.costPer1k > 0 ? ` · ¥${l.costPer1k.toFixed(2)}/1K` : ''}
                                        </div>
                                    </div>
                                </div>

                                {/* Block bar */}
                                <LaneBar pct={lanePct} live={isLive} complete={laneComplete} />

                                {/* Counts */}
                                <div className="font-data text-[12px]">
                                    <span className="text-[var(--color-text-bright)]">{got}</span>
                                    <span className="text-[var(--color-text-fade)]"> / {laneTotal}</span>
                                </div>

                                {/* Severity tally */}
                                <div className="flex items-center justify-end gap-2 font-data text-[10.5px]">
                                    {sev.l1 > 0 && <span className="text-[var(--color-L1)]">▼{sev.l1}L1</span>}
                                    {sev.l2 > 0 && <span className="text-[var(--color-L2)] glow-rose">▼{sev.l2}L2</span>}
                                    {sev.l3 > 0 && <span className="text-[var(--color-L3)] pulse-l3">▼{sev.l3}L3</span>}
                                    {sev.l1 + sev.l2 + sev.l3 === 0 && got > 0 && (
                                        <span className="text-[var(--color-mint)]">✓ CLEAN</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Live log ────────────────────────────────── */}
            <section className="mb-8">
                <div className="tl-rule mb-4"><span>TRIAL STREAM · tail -f</span></div>
                <div className="border border-[var(--color-border)] bg-[var(--color-panel)] font-data text-[11.5px] leading-[1.9]
                                px-5 py-4 min-h-[420px]">
                    {log.length === 0 && (
                        <div className="text-[var(--color-text-fade)]">
                            &gt; waiting for first trial …<span className="blink">▌</span>
                        </div>
                    )}
                    {log.map((ev, i) => (
                        <LogLine key={`${ev.idx}-${ev.ts}`} ev={ev} fresh={i === 0} />
                    ))}
                </div>
            </section>

            {/* ── Completion CTA ──────────────────────────── */}
            <section>
                {complete ? (
                    <div className="border border-[var(--color-mint)] bg-[var(--color-mint-trace)] px-6 py-5
                                    flex items-center justify-between"
                         style={{ boxShadow: '0 0 30px var(--color-mint-glow)' }}>
                        <div>
                            <div className="font-mono text-[10.5px] tracking-[0.22em] text-[var(--color-mint)]">
                                ✓ ALL TRIALS COMPLETE
                            </div>
                            <div className="text-[15px] text-[var(--color-text-bright)] mt-1">
                                Decision book generated. Matrix, charts and stakeholder narratives are ready.
                            </div>
                        </div>
                        <button
                            onClick={() => navigate(`/runs/${id ?? 'run-042'}`)}
                            className="px-5 py-3 font-mono text-[12px] tracking-[0.22em]
                                       text-[var(--color-canvas)] bg-[var(--color-mint)]
                                       border border-[var(--color-mint)]
                                       hover:bg-[var(--color-mint)] transition-colors duration-100"
                            style={{ boxShadow: '0 0 24px var(--color-mint-glow)' }}
                        >
                            VIEW REPORT ▸
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-[11px] tracking-[0.18em] font-data text-[var(--color-text-fade)]">
                        <span><span className="blink text-[var(--color-mint)]">●</span>&nbsp;LIVE STREAM · TZ UTC+8</span>
                        <span>
                            <span className="text-[var(--color-amber)]">⌘.</span>&nbsp;PAUSE&nbsp;&nbsp;·&nbsp;&nbsp;
                            <span className="text-[var(--color-amber)]">⌘C</span>&nbsp;CANCEL
                        </span>
                    </div>
                )}
            </section>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  Sub-components
// ════════════════════════════════════════════════════════════════════

function Fact({ label, val, tone }: { label: string; val: string; tone: 'bright' | 'amber' | 'mint' | 'fade' }) {
    const t = tone === 'amber' ? 'text-[var(--color-amber)] glow-amber-soft'
            : tone === 'mint'  ? 'text-[var(--color-mint)] glow-mint'
            : tone === 'fade'  ? 'text-[var(--color-text-fade)]'
            : 'text-[var(--color-text-bright)]';
    return (
        <div>
            <div className="text-[9.5px] tracking-[0.22em] text-[var(--color-text-dim)]">{label}</div>
            <div className={`mt-0.5 text-[16px] ${t}`}>{val}</div>
        </div>
    );
}

function BlockBar({ pct, complete }: { pct: number; complete: boolean }) {
    const SEGMENTS = 60;
    const filled = Math.round((pct / 100) * SEGMENTS);
    const color = complete ? 'var(--color-mint)' : 'var(--color-amber)';
    return (
        <div className="font-data tracking-[0.04em] text-[16px] leading-none"
             style={{ color, textShadow: `0 0 8px ${color}` }}>
            {Array.from({ length: SEGMENTS }).map((_, i) => (
                <span key={i} style={i >= filled ? { color: 'var(--color-text-fade)', textShadow: 'none' } : undefined}>
                    {i < filled ? '▰' : '▱'}
                </span>
            ))}
        </div>
    );
}

function LaneBar({ pct, live, complete }: { pct: number; live: boolean; complete: boolean }) {
    const color = complete ? 'var(--color-mint)' : live ? 'var(--color-mint)' : 'var(--color-amber)';
    return (
        <div className="relative h-[10px] bg-[var(--color-panel-3)] overflow-hidden">
            <div className="absolute top-0 left-0 h-full transition-all duration-200"
                 style={{
                     width: `${pct}%`,
                     background: color,
                     boxShadow: `0 0 8px ${color}`,
                 }} />
            {/* moving highlight */}
            {live && pct < 100 && (
                <span
                    aria-hidden
                    className="absolute top-0 h-full w-[24%]"
                    style={{
                        left: `calc(${pct}% - 24%)`,
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                        mixBlendMode: 'screen',
                    }}
                />
            )}
        </div>
    );
}

function CurrentActivity({ currentModel, complete, latestLog, lanes, total }:
    { currentModel?: string; complete: boolean; latestLog?: TrialEvent; lanes: ModelLane[]; total: number }) {

    if (complete) {
        return (
            <div className="border border-[var(--color-mint)] px-5 py-4 bg-[var(--color-mint-trace)]"
                 style={{ boxShadow: 'inset 0 0 0 1px var(--color-mint), 0 0 18px var(--color-mint-glow)' }}>
                <div className="font-mono text-[10.5px] tracking-[0.22em] text-[var(--color-mint)] glow-mint">
                    ◉ ALL CLEAR
                </div>
                <div className="font-display text-[22px] text-[var(--color-mint)] glow-mint mt-1">
                    Run complete.
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    All {total} trials submitted to scoring engine.
                </div>
            </div>
        );
    }

    const lane = lanes.find(l => l.id === currentModel);
    return (
        <div className="border border-[var(--color-border)] px-5 py-4 bg-[var(--color-panel)]">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[var(--color-mint)] glow-mint text-[12px] blink">●</span>
                <span className="font-mono text-[10.5px] tracking-[0.22em] text-[var(--color-mint)]">
                    NOW EXECUTING
                </span>
            </div>
            <div className="font-display text-[20px] text-[var(--color-amber)] glow-amber-soft">
                {lane?.name ?? 'warming up …'}
            </div>
            {latestLog && (
                <div className="mt-2 text-[10.5px] font-data text-[var(--color-text-muted)] tracking-[0.05em]">
                    last › case <span className="text-[var(--color-text-bright)]">{latestLog.caseId}</span>
                    {' · '}
                    <span className={
                        latestLog.verdict === 'PASS' ? 'text-[var(--color-mint)]'
                        : latestLog.verdict === 'L1' ? 'text-[var(--color-L1)]'
                        : latestLog.verdict === 'L2' ? 'text-[var(--color-L2)]'
                        : 'text-[var(--color-L3)]'
                    }>{latestLog.verdict}</span>
                    {' · '}
                    {latestLog.latencyMs}ms
                </div>
            )}
        </div>
    );
}

function LogLine({ ev, fresh }: { ev: TrialEvent; fresh: boolean }) {
    const verdictTone =
        ev.verdict === 'PASS' ? { ch: '◉', cls: 'text-[var(--color-mint)]' }
        : ev.verdict === 'L1' ? { ch: '▼', cls: 'text-[var(--color-L1)]' }
        : ev.verdict === 'L2' ? { ch: '▼', cls: 'text-[var(--color-L2)] glow-rose' }
        : { ch: '✗', cls: 'text-[var(--color-L3)] pulse-l3' };

    const t = new Date(ev.ts);
    const stamp = `${pad(t.getMinutes())}:${pad(t.getSeconds())}`;

    return (
        <div className={`grid grid-cols-[58px_18px_70px_minmax(0,1fr)_70px_70px_60px] gap-3 items-baseline whitespace-nowrap
                         ${fresh ? 'reveal-in' : ''}`}>
            <span className="text-[var(--color-text-fade)]">[{stamp}]</span>
            <span className={`text-[12px] leading-none ${verdictTone.cls}`}>{verdictTone.ch}</span>
            <span className="text-[var(--color-text-muted)]">trial {String(ev.idx).padStart(4, '0')}</span>
            <span className="text-[var(--color-text-bright)]">
                {ev.model}
                <span className="text-[var(--color-text-fade)]"> · </span>
                case <span className="text-[var(--color-amber)]">{ev.caseId}</span>
            </span>
            <span className={verdictTone.cls}>{ev.verdict.padEnd(4)}</span>
            <span className="text-[var(--color-text-fade)]">¥{ev.cost.toFixed(3)}</span>
            <span className="text-[var(--color-text-fade)] text-right">{ev.latencyMs}ms</span>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  Utils
// ════════════════════════════════════════════════════════════════════

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDuration(sec: number) {
    if (sec <= 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    return m > 0 ? `${m}m ${pad(s)}s` : `${s}s`;
}

// keep useMemo import used (suppress eslint unused warning if any)
void useMemo;
