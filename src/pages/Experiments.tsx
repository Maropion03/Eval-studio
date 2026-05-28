import { Link } from 'react-router-dom';
import { useState } from 'react';

// ─── Mock data ──────────────────────────────────────────────────────────

type Status = 'done' | 'running' | 'queued' | 'failed';
type Severity = 'L0' | 'L1' | 'L2' | 'L3';

interface Experiment {
    id: string;
    seq: number;
    title: string;
    scenario: string;
    kind: 'PROMPT' | 'MODEL' | 'PARAM' | 'SELECT';
    status: Status;
    progress?: number;
    spark: number[];
    deltaAcc?: number;
    severityShift?: { sev: Severity; count: number; dir: 'up' | 'down' };
    decisionBook?: boolean;
    cost?: number;
    duration?: string;
    timestamp: string;
}

const experiments: Experiment[] = [
    {
        id: 'run-042', seq: 42,
        title: 'Prompt v3 → v4 · Financial QA',
        scenario: 'financial_qa', kind: 'PROMPT', status: 'done',
        spark: [82, 84, 83, 86, 85, 88, 89, 91, 90, 92],
        deltaAcc: 2.3, severityShift: { sev: 'L2', count: 1, dir: 'down' },
        cost: 3.12, duration: '4m 18s', timestamp: '2h ago',
    },
    {
        id: 'run-041', seq: 41,
        title: 'Claude 4.5 → 4.6 · Upgrade Audit',
        scenario: 'all', kind: 'MODEL', status: 'done',
        spark: [88, 87, 89, 88, 89, 89, 90, 90, 89, 91],
        deltaAcc: 0.8, severityShift: { sev: 'L2', count: 0, dir: 'down' },
        cost: 8.40, duration: '11m 02s', timestamp: 'yesterday',
    },
    {
        id: 'run-040', seq: 40,
        title: 'Model Selection · Fraud Detection',
        scenario: 'fraud_detection', kind: 'SELECT', status: 'done',
        spark: [70, 76, 82, 85, 88, 87, 89, 91, 90, 92],
        deltaAcc: 12.0, decisionBook: true,
        cost: 21.65, duration: '32m 11s', timestamp: '3d ago',
    },
    {
        id: 'run-039', seq: 39,
        title: 'RAG template iteration · Compliance Audit',
        scenario: 'compliance_audit', kind: 'PROMPT', status: 'running',
        progress: 78, spark: [85, 85, 86, 86, 86, 87, 87, 88, 88],
        timestamp: '0m 42s elapsed',
    },
    {
        id: 'run-038', seq: 38,
        title: 'Temperature sweep · Research Summary',
        scenario: 'research_summary', kind: 'PARAM', status: 'queued',
        spark: [], timestamp: 'queued',
    },
    {
        id: 'run-037', seq: 37,
        title: 'GPT-4o regression after dataset expansion',
        scenario: 'all', kind: 'MODEL', status: 'failed',
        spark: [89, 87, 84, 80, 78],
        severityShift: { sev: 'L3', count: 2, dir: 'up' },
        timestamp: '5d ago',
    },
];

// ─── Bits ──────────────────────────────────────────────────────────────

function Sparkline({ data, status }: { data: number[]; status: Status }) {
    if (data.length === 0) {
        return (
            <div className="font-data text-[10px] tracking-widest text-[var(--color-text-fade)]">
                ──────────
            </div>
        );
    }
    const w = 96, h = 26, pad = 2;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => {
        const x = pad + (i * (w - pad * 2)) / (data.length - 1);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const color =
        status === 'failed' ? 'var(--color-L2)'
        : status === 'running' ? 'var(--color-mint)'
        : 'var(--color-amber)';

    return (
        <svg width={w} height={h} className="overflow-visible">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="1.2"
                strokeLinejoin="miter"
                points={points.join(' ')}
                style={{ filter: `drop-shadow(0 0 3px ${color})` }}
            />
            <circle
                cx={points[points.length - 1].split(',')[0]}
                cy={points[points.length - 1].split(',')[1]}
                r="1.8"
                fill={color}
                style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
        </svg>
    );
}

function StatusGlyph({ status }: { status: Status }) {
    const map = {
        done:    { ch: '◉', cls: 'text-[var(--color-amber)] glow-amber-soft', label: 'DONE' },
        running: { ch: '●', cls: 'text-[var(--color-mint)] glow-mint',         label: 'RUNNING' },
        queued:  { ch: '◌', cls: 'text-[var(--color-text-muted)]',             label: 'QUEUED' },
        failed:  { ch: '✗', cls: 'text-[var(--color-L2)] glow-rose',           label: 'FAILED' },
    } as const;
    const s = map[status];
    return (
        <div className="flex items-center gap-2 w-[88px]">
            <span className={`text-[14px] leading-none ${s.cls} ${status === 'running' ? 'blink' : ''}`}>
                {s.ch}
            </span>
            <span className={`font-mono text-[10.5px] tracking-[0.18em] ${
                status === 'done' ? 'text-[var(--color-amber)]'
                : status === 'running' ? 'text-[var(--color-mint)]'
                : status === 'failed' ? 'text-[var(--color-L2)]'
                : 'text-[var(--color-text-muted)]'
            }`}>
                {s.label}
            </span>
        </div>
    );
}

function KindTag({ kind }: { kind: Experiment['kind'] }) {
    const map = {
        PROMPT: { label: 'PROMPT·REG', color: 'var(--color-amber)' },
        MODEL:  { label: 'MODEL·UPGR', color: 'var(--color-mint)'  },
        PARAM:  { label: 'PARAM·SWP',  color: 'var(--color-text-muted)' },
        SELECT: { label: 'SELECTION',  color: 'var(--color-amber-bright)' },
    } as const;
    const k = map[kind];
    return (
        <span
            className="px-1.5 py-[1px] text-[9.5px] tracking-[0.16em] font-data uppercase border"
            style={{ color: k.color, borderColor: k.color, opacity: 0.85 }}
        >
            {k.label}
        </span>
    );
}

function SeverityBadge({ shift }: { shift: NonNullable<Experiment['severityShift']> }) {
    const colorVar = `var(--color-${shift.sev})`;
    const arrow = shift.dir === 'down' ? '▼' : '▲';
    const good = shift.dir === 'down';
    return (
        <span
            className="inline-flex items-center gap-1 px-1.5 py-[1px] text-[10px] font-data tracking-wider border"
            style={{
                color: good ? 'var(--color-mint)' : colorVar,
                borderColor: good ? 'var(--color-mint)' : colorVar,
                background: good ? 'var(--color-mint-trace)' : `var(--color-${shift.sev}-trace)`,
            }}
        >
            {arrow}{shift.count}&nbsp;{shift.sev}
        </span>
    );
}

// ─── Readout (top instrument panel) ──────────────────────────────────

function Readout() {
    const cells = [
        { label: 'TOTAL  RUNS',    val: '142',   glow: false, code: 'CH·01' },
        { label: 'L2+ HALLUC',     val: '7',     glow: false, accent: 'L2', code: 'CH·02' },
        { label: 'AVG COST / RUN', val: '¥3.41', glow: true,  code: 'CH·03' },
        { label: 'PASS  RATE',     val: '91.2%', glow: true,  accent: 'mint', code: 'CH·04' },
        { label: 'AVG DURATION',   val: '4m 18s',glow: false, code: 'CH·05' },
    ];
    return (
        <div className="grid grid-cols-5">
            {cells.map((c, i) => (
                <div
                    key={c.label}
                    className={`px-5 pt-3 pb-4 ${i === cells.length - 1 ? '' : 'border-r border-[var(--color-border)]'}`}
                >
                    {/* Channel tag */}
                    <div className="flex items-center justify-between text-[9.5px] tracking-[0.18em] font-data mb-3">
                        <span className="text-[var(--color-amber)] glow-amber-soft">{c.code}</span>
                        <span className="text-[var(--color-text-fade)]">●</span>
                    </div>

                    <div className="text-[10px] tracking-[0.22em] text-[var(--color-text-dim)]">
                        {c.label}
                    </div>
                    <div className={`mt-1.5 font-display text-[22px] tracking-tight ${
                        c.accent === 'L2'   ? 'text-[var(--color-L2)] glow-rose'
                        : c.accent === 'mint' ? 'text-[var(--color-mint)] glow-mint'
                        : c.glow ? 'text-[var(--color-amber)] glow-amber-soft'
                        : 'text-[var(--color-text-bright)]'
                    }`}>
                        {c.val}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Row ────────────────────────────────────────────────────────────

function ExperimentRow({ exp }: { exp: Experiment }) {
    const railColor =
        exp.status === 'failed'  ? 'var(--color-L2)'
        : exp.status === 'running' ? 'var(--color-mint)'
        : exp.status === 'queued'  ? 'var(--color-text-fade)'
        : 'var(--color-amber)';

    return (
        <Link
            to={`/runs/${exp.id}`}
            className="group block relative border-b border-[var(--color-border)]
                       hover:bg-[var(--color-amber-trace)] transition-colors duration-150"
        >
            {/* Status rail */}
            <span
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-[2px]"
                style={{
                    background: railColor,
                    opacity: exp.status === 'queued' ? 0.35 : 0.7,
                    boxShadow: exp.status !== 'queued' ? `0 0 8px ${railColor}` : undefined,
                }}
            />

            <div className="grid grid-cols-[88px_60px_minmax(0,1fr)_120px_120px_140px_70px] gap-4 items-center pl-6 pr-5 py-4">
                <StatusGlyph status={exp.status} />

                <div className="font-data text-[11px] tracking-[0.18em] text-[var(--color-text-fade)] group-hover:text-[var(--color-amber)] transition-colors">
                    #{String(exp.seq).padStart(4, '0')}
                </div>

                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        <span className="text-[13.5px] tracking-[0.02em] text-[var(--color-text-bright)] truncate">
                            {exp.title}
                        </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10.5px] tracking-[0.1em]">
                        <KindTag kind={exp.kind} />
                        <span className="text-[var(--color-text-fade)]">·</span>
                        <span className="text-[var(--color-text-muted)] uppercase">{exp.scenario}</span>
                    </div>
                </div>

                <div>
                    <Sparkline data={exp.spark} status={exp.status} />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {exp.deltaAcc !== undefined && (
                        <span className="font-data text-[12px] text-[var(--color-mint)] glow-mint">
                            +{exp.deltaAcc.toFixed(1)}%
                        </span>
                    )}
                    {exp.severityShift && <SeverityBadge shift={exp.severityShift} />}
                    {exp.decisionBook && (
                        <span className="px-1.5 py-[1px] text-[10px] tracking-wider font-data uppercase
                                         text-[var(--color-amber)] border border-[var(--color-amber)]
                                         bg-[var(--color-amber-trace)]">
                            DECISION&nbsp;✓
                        </span>
                    )}
                    {exp.status === 'running' && (
                        <span className="font-data text-[11px] text-[var(--color-mint)]">
                            {Math.round((exp.progress ?? 0))}%
                        </span>
                    )}
                </div>

                <div className="font-data text-[10.5px] text-[var(--color-text-muted)]">
                    {exp.cost ? (
                        <>
                            <span className="text-[var(--color-text-fade)]">¥</span>
                            <span className="text-[var(--color-amber-bright)]">{exp.cost.toFixed(2)}</span>
                            <span className="text-[var(--color-text-fade)]"> · {exp.duration}</span>
                        </>
                    ) : (
                        <span className="text-[var(--color-text-fade)]">—</span>
                    )}
                </div>

                <div className="font-data text-[10.5px] tracking-[0.05em] text-[var(--color-text-fade)] text-right">
                    {exp.timestamp}
                </div>
            </div>

            {/* Running progress underline */}
            {exp.status === 'running' && exp.progress !== undefined && (
                <div className="absolute bottom-0 left-0 h-[2px] bg-[var(--color-mint)] glow-mint"
                     style={{ width: `${exp.progress}%`, boxShadow: '0 0 8px var(--color-mint)' }} />
            )}

            {/* Hover arrow */}
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--color-amber)]
                             opacity-0 group-hover:opacity-100 transition-opacity font-data text-[12px]
                             pointer-events-none">
                ▸
            </span>
        </Link>
    );
}

// ─── Page ───────────────────────────────────────────────────────────

export default function Experiments() {
    const [view, setView] = useState<'log' | 'board'>('log');
    const [filter, setFilter] = useState<'ALL' | Status>('ALL');

    const filtered = filter === 'ALL' ? experiments : experiments.filter(e => e.status === filter);

    return (
        <div className="max-w-[1320px] mx-auto reveal-in">
            {/* ── Page Header ────────────────────────────── */}
            <header className="mb-8">
                <div className="flex items-end justify-between">
                    <div>
                        <div className="flex items-center gap-3 text-[10.5px] tracking-[0.28em] text-[var(--color-text-dim)]">
                            <span className="text-[var(--color-amber)]">▌</span>
                            MODULE&nbsp;01&nbsp;·&nbsp;EXPERIMENT&nbsp;LOG
                        </div>
                        <h1 className="font-crt text-[72px] leading-[0.9] tracking-[0.01em] text-[var(--color-text-bright)] mt-2">
                            EXPERIMENTS<span className="blink text-[var(--color-amber)] glow-amber">_</span>
                        </h1>
                        <p className="mt-3 text-[12px] tracking-[0.06em] text-[var(--color-text-muted)] max-w-[640px]">
                            Prompt regression · Model upgrade audit · Parameter sweep · Model selection ──
                            one ledger for every experiment. Compare, replay, share.
                        </p>
                    </div>

                    <Link
                        to="/new"
                        className="
                            relative px-5 py-3
                            font-mono text-[12px] tracking-[0.22em] uppercase
                            text-[var(--color-canvas)] bg-[var(--color-amber)]
                            hover:bg-[var(--color-amber-bright)]
                            transition-colors duration-100
                            ring-amber
                        "
                        style={{ boxShadow: '0 0 24px var(--color-amber-glow)' }}
                    >
                        ＋&nbsp;NEW&nbsp;RUN&nbsp;
                        <span className="text-[var(--color-canvas)]/70">↗</span>
                    </Link>
                </div>
            </header>

            {/* ── Readout Panel ─────────────────────────── */}
            <section className="mb-10">
                <div className="tl-rule mb-3"><span>SYSTEM READOUT</span></div>
                <Readout />
            </section>

            {/* ── Controls ──────────────────────────────── */}
            <div className="flex items-center justify-between mb-3">
                <div className="tl-rule flex-1 mr-6"><span>RUN LOG · {filtered.length} ENTRIES</span></div>

                <div className="flex items-center gap-1 text-[10.5px] tracking-[0.16em] font-data">
                    {(['ALL', 'done', 'running', 'queued', 'failed'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`
                                px-2.5 py-1 uppercase border transition-colors duration-100
                                ${filter === f
                                    ? 'text-[var(--color-amber)] border-[var(--color-amber)] bg-[var(--color-amber-trace)]'
                                    : 'text-[var(--color-text-dim)] border-[var(--color-border)] hover:text-[var(--color-text-bright)] hover:border-[var(--color-border-strong)]'
                                }
                            `}
                        >
                            {f}
                        </button>
                    ))}

                    <div className="w-3" />

                    <div className="flex border border-[var(--color-border)] divide-x divide-[var(--color-border)]">
                        {(['log', 'board'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`
                                    px-2.5 py-1 uppercase transition-colors duration-100
                                    ${view === v
                                        ? 'text-[var(--color-amber)] bg-[var(--color-amber-trace)]'
                                        : 'text-[var(--color-text-dim)] hover:text-[var(--color-text-bright)]'
                                    }
                                `}
                            >
                                {v === 'log' ? '▤ LOG' : '▦ BOARD'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── List ──────────────────────────────────── */}
            <section>
                {/* Header row */}
                <div className="grid grid-cols-[88px_60px_minmax(0,1fr)_120px_120px_140px_70px] gap-4 items-center
                                pl-6 pr-5 py-2.5 text-[9.5px] tracking-[0.22em] text-[var(--color-text-dim)]
                                border-y border-[var(--color-border)]">
                    <span>STATUS</span>
                    <span>RUN·ID</span>
                    <span>EXPERIMENT</span>
                    <span>TRAJECTORY</span>
                    <span>DELTA</span>
                    <span>COST · TIME</span>
                    <span className="text-right">WHEN</span>
                </div>

                {filtered.map(exp => (
                    <ExperimentRow key={exp.id} exp={exp} />
                ))}
            </section>

            {/* ── Footer ────────────────────────────────── */}
            <div className="mt-6 flex items-center justify-between text-[10px] tracking-[0.22em] text-[var(--color-text-fade)]">
                <span>END·OF·LOG ─ TZ UTC+8 ─ AUTO·REFRESH 15s</span>
                <span>
                    <span className="text-[var(--color-amber)]">⌘N</span>&nbsp;NEW&nbsp;&nbsp;·&nbsp;&nbsp;
                    <span className="text-[var(--color-amber)]">⌘F</span>&nbsp;FIND&nbsp;&nbsp;·&nbsp;&nbsp;
                    <span className="text-[var(--color-amber)]">⌘R</span>&nbsp;REFRESH
                </span>
            </div>
        </div>
    );
}
