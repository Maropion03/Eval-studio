import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';

// ════════════════════════════════════════════════════════════════════
//  Mock data — Run #040 · Model Selection on Fraud Detection scenario
//  4 candidate models × 4 dataset slices
// ════════════════════════════════════════════════════════════════════

interface ModelCandidate {
    id: string;
    name: string;
    vendor: string;
    costPer1k: number;       // ¥ / 1k tokens
    recommended?: boolean;
}

const MODELS: ModelCandidate[] = [
    { id: 'gpt-4o',      name: 'GPT-4o',       vendor: 'OpenAI',     costPer1k: 5.00 },
    { id: 'claude-46',   name: 'Claude 4.6',   vendor: 'Anthropic',  costPer1k: 3.00 },
    { id: 'deepseek-v3', name: 'DeepSeek-V3',  vendor: 'DeepSeek',   costPer1k: 1.00, recommended: true },
    { id: 'qwen-max',    name: 'Qwen-Max',     vendor: 'Alibaba',    costPer1k: 0.60 },
];

const SLICES = ['Financial QA', 'Compliance', 'Research', 'Fraud Detection'] as const;

interface Cell { acc: number; l0: number; l1: number; l2: number; l3: number; }

// matrix[modelIdx][sliceIdx]
const MATRIX: Cell[][] = [
    [ // GPT-4o
        { acc: 93.2, l0: 36, l1: 3, l2: 1, l3: 0 },
        { acc: 91.8, l0: 27, l1: 2, l2: 1, l3: 0 },
        { acc: 94.5, l0: 28, l1: 2, l2: 0, l3: 0 },
        { acc: 92.0, l0: 36, l1: 3, l2: 1, l3: 0 },
    ],
    [ // Claude 4.6
        { acc: 92.5, l0: 35, l1: 4, l2: 1, l3: 0 },
        { acc: 93.1, l0: 27, l1: 2, l2: 1, l3: 0 },
        { acc: 92.8, l0: 27, l1: 3, l2: 0, l3: 0 },
        { acc: 89.4, l0: 34, l1: 4, l2: 2, l3: 0 },
    ],
    [ // DeepSeek-V3 ★ recommended
        { acc: 90.1, l0: 34, l1: 5, l2: 1, l3: 0 },
        { acc: 88.7, l0: 26, l1: 3, l2: 1, l3: 0 },
        { acc: 91.2, l0: 26, l1: 3, l2: 1, l3: 0 },
        { acc: 88.0, l0: 33, l1: 5, l2: 2, l3: 0 },
    ],
    [ // Qwen-Max
        { acc: 86.5, l0: 32, l1: 6, l2: 2, l3: 0 },
        { acc: 88.1, l0: 25, l1: 4, l2: 1, l3: 0 },
        { acc: 82.3, l0: 23, l1: 5, l2: 2, l3: 0 },
        { acc: 84.2, l0: 30, l1: 6, l2: 3, l3: 1 },
    ],
];

const radarAxes = ['FACT ACC', 'HALLUC AVOID', 'CITATION', 'CONSISTENCY', 'BOUNDARY'] as const;
// per-model radar values (0..100)
const RADAR: number[][] = [
    [93, 90, 91, 88, 86],   // GPT-4o
    [92, 89, 88, 91, 85],   // Claude
    [89, 86, 87, 88, 84],   // DeepSeek
    [85, 78, 79, 81, 76],   // Qwen
];

const MODEL_COLORS = [
    'var(--color-amber)',
    'var(--color-mint)',
    'var(--color-amber-bright)',
    'var(--color-text-muted)',
];

// helpers
const avgAcc = (m: number) =>
    MATRIX[m].reduce((s, c) => s + c.acc, 0) / MATRIX[m].length;
const totalSev = (m: number, tier: 'l1' | 'l2' | 'l3') =>
    MATRIX[m].reduce((s, c) => s + c[tier], 0);
const totalCases = (m: number) =>
    MATRIX[m].reduce((s, c) => s + c.l0 + c.l1 + c.l2 + c.l3, 0);

// ════════════════════════════════════════════════════════════════════
//  Page header + summary strip
// ════════════════════════════════════════════════════════════════════

function PageHeader({ id }: { id: string }) {
    return (
        <header className="mb-6">
            <div className="flex items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 text-[10.5px] tracking-[0.28em] text-[var(--color-text-dim)]">
                        <Link to="/" className="hover:text-[var(--color-amber)] transition-colors">
                            ◀ MODULE 01
                        </Link>
                        <span className="text-[var(--color-text-fade)]">/</span>
                        <span>RUN REPORT</span>
                        <span className="text-[var(--color-text-fade)]">/</span>
                        <span className="text-[var(--color-amber)]">#{id.toUpperCase()}</span>
                    </div>
                    <h1 className="font-crt text-[64px] leading-[0.9] tracking-[0.01em] text-[var(--color-text-bright)] mt-2">
                        MODEL&nbsp;SELECTION<span className="blink text-[var(--color-amber)] glow-amber">_</span>
                    </h1>
                    <div className="mt-3 flex items-center gap-3 text-[12px] text-[var(--color-text-muted)] font-data tracking-[0.04em]">
                        <span>FRAUD&nbsp;DETECTION</span>
                        <span className="text-[var(--color-text-fade)]">·</span>
                        <span>4 MODELS × 4 SLICES</span>
                        <span className="text-[var(--color-text-fade)]">·</span>
                        <span>160 TRIALS</span>
                        <span className="text-[var(--color-text-fade)]">·</span>
                        <span>32m 11s</span>
                        <span className="text-[var(--color-text-fade)]">·</span>
                        <span>3d ago</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <ActionButton label="REPLAY" hint="⌘R" />
                    <ActionButton label="SHARE" hint="⌘S" />
                    <ActionButton label="EXPORT PDF" hint="⌘E" primary />
                </div>
            </div>
        </header>
    );
}

function ActionButton({ label, hint, primary }: { label: string; hint: string; primary?: boolean }) {
    return (
        <button
            className={`
                relative px-3.5 py-2 font-mono text-[11px] tracking-[0.18em]
                border transition-colors duration-100 group
                ${primary
                    ? 'text-[var(--color-canvas)] bg-[var(--color-amber)] border-[var(--color-amber)] hover:bg-[var(--color-amber-bright)]'
                    : 'text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-amber)] hover:border-[var(--color-amber)]'
                }
            `}
            style={primary ? { boxShadow: '0 0 18px var(--color-amber-glow)' } : undefined}
        >
            {label}
            <span className={`ml-2 text-[9.5px] ${
                primary ? 'text-[var(--color-canvas)]/60' : 'text-[var(--color-text-fade)]'
            }`}>
                {hint}
            </span>
        </button>
    );
}

function SummaryStrip() {
    const cells = [
        { label: 'EXP TYPE',      val: 'MODEL·SELECT', mono: true,  hl: 'amber' },
        { label: 'DATASET',       val: 'FRAUD_DETECTION', mono: true },
        { label: 'CANDIDATES',    val: '4', mono: false },
        { label: 'CASES / MODEL', val: '40', mono: false },
        { label: 'BEST ACC',      val: '92.9%', mono: false, hl: 'mint' },
        { label: 'TOTAL L2+',     val: '17',  mono: false, hl: 'L2' },
        { label: 'TOTAL COST',    val: '¥21.65', mono: false, hl: 'amber' },
        { label: 'WINNER',        val: 'DeepSeek-V3', mono: false, hl: 'amber-bright', star: true },
    ];

    const tone = (h?: string) =>
        h === 'amber'        ? 'text-[var(--color-amber)] glow-amber-soft'
        : h === 'amber-bright' ? 'text-[var(--color-amber-bright)] glow-amber-soft'
        : h === 'mint'         ? 'text-[var(--color-mint)] glow-mint'
        : h === 'L2'           ? 'text-[var(--color-L2)] glow-rose'
        : 'text-[var(--color-text-bright)]';

    return (
        <div className="grid grid-cols-8 border-y border-[var(--color-border)]">
            {cells.map((c, i) => (
                <div key={c.label}
                     className={`px-4 py-3 ${i === cells.length - 1 ? '' : 'border-r border-[var(--color-border)]'}`}>
                    <div className="text-[9.5px] tracking-[0.22em] text-[var(--color-text-dim)]">
                        {c.label}
                    </div>
                    <div className={`mt-1 text-[15px] tracking-tight ${c.mono ? 'font-data' : 'font-display'} ${tone(c.hl)}`}>
                        {c.star && <span className="mr-1">★</span>}
                        {c.val}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  Tab Bar
// ════════════════════════════════════════════════════════════════════

type Tab = 'matrix' | 'analysis' | 'decision';

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
    const tabs: { id: Tab; label: string; sub: string }[] = [
        { id: 'matrix',   label: 'A · MATRIX',        sub: '4 × 4 scoreboard' },
        { id: 'analysis', label: 'B · ANALYSIS',      sub: 'Pareto · Radar · Severity' },
        { id: 'decision', label: 'C · DECISION BOOK', sub: 'Stakeholder report' },
    ];
    return (
        <div className="flex items-stretch border-b border-[var(--color-border)]">
            {tabs.map(t => (
                <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`
                        relative px-5 py-3 text-left transition-colors duration-100
                        ${tab === t.id
                            ? 'text-[var(--color-amber)] bg-[var(--color-amber-trace)]'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] hover:bg-[var(--color-panel)]'
                        }
                    `}
                >
                    <div className="font-mono text-[11.5px] tracking-[0.18em]">{t.label}</div>
                    <div className="text-[10px] tracking-[0.08em] text-[var(--color-text-fade)] mt-0.5">
                        {t.sub}
                    </div>
                    {tab === t.id && (
                        <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--color-amber)] glow-amber-soft"
                              style={{ boxShadow: '0 0 8px var(--color-amber)' }} />
                    )}
                </button>
            ))}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  Tab A · MATRIX
// ════════════════════════════════════════════════════════════════════

function SeverityDots({ cell }: { cell: Cell }) {
    const dots = [
        { n: cell.l0, color: 'var(--color-L0)' },
        { n: cell.l1, color: 'var(--color-L1)' },
        { n: cell.l2, color: 'var(--color-L2)' },
        { n: cell.l3, color: 'var(--color-L3)' },
    ];
    return (
        <div className="flex items-center gap-1.5 text-[9.5px] font-data tracking-wider">
            {dots.map((d, i) => (
                d.n > 0 ? (
                    <span key={i} className="flex items-center gap-0.5">
                        <span className="inline-block w-[5px] h-[5px]"
                              style={{
                                  background: d.color,
                                  boxShadow: i >= 2 ? `0 0 4px ${d.color}` : undefined,
                              }} />
                        <span style={{ color: i >= 2 ? d.color : 'var(--color-text-fade)' }}>{d.n}</span>
                    </span>
                ) : null
            ))}
        </div>
    );
}

function MatrixCell({ cell, deltaVs }: { cell: Cell; deltaVs?: number }) {
    const delta = deltaVs !== undefined ? cell.acc - deltaVs : 0;
    const sev = cell.l2 + cell.l3;
    const tone = sev >= 2 ? 'text-[var(--color-L2)]' : 'text-[var(--color-text-bright)]';
    return (
        <div className="px-4 py-3 border-r border-b border-[var(--color-border)]">
            <div className="flex items-baseline justify-between gap-2">
                <span className={`font-display text-[18px] ${tone}`}>{cell.acc.toFixed(1)}</span>
                {deltaVs !== undefined && Math.abs(delta) > 0.05 && (
                    <span className={`font-data text-[10px] ${
                        delta > 0 ? 'text-[var(--color-mint)]' : 'text-[var(--color-L2)]'
                    }`}>
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                    </span>
                )}
            </div>
            <div className="mt-1.5">
                <SeverityDots cell={cell} />
            </div>
        </div>
    );
}

function MatrixTab() {
    // baseline for delta calc: first model (GPT-4o) per slice
    const baseline = MATRIX[0];

    return (
        <div className="reveal-in">
            {/* Legend */}
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-[var(--color-border)]
                            text-[10px] tracking-[0.16em] text-[var(--color-text-dim)] font-data">
                <span>SCOREBOARD · ACCURACY% + SEVERITY DOTS · Δ vs GPT-4o</span>
                <span className="flex items-center gap-3">
                    {[
                        { sev: 'L0', l: 'PASS' },
                        { sev: 'L1', l: 'DATA·DEV' },
                        { sev: 'L2', l: 'COMP·INC' },
                        { sev: 'L3', l: 'DEC·ERR' },
                    ].map(item => (
                        <span key={item.sev} className="flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2" style={{ background: `var(--color-${item.sev})` }} />
                            <span className="text-[var(--color-text-muted)]">{item.sev}</span>
                        </span>
                    ))}
                </span>
            </div>

            {/* Header row */}
            <div className="grid grid-cols-[200px_repeat(4,minmax(0,1fr))_120px_120px]
                            text-[9.5px] tracking-[0.22em] text-[var(--color-text-dim)]
                            border-b border-[var(--color-border)] bg-[var(--color-panel-2)]">
                <div className="px-4 py-2.5">MODEL</div>
                {SLICES.map(s => (
                    <div key={s} className="px-4 py-2.5 border-l border-[var(--color-border)]">
                        {s.toUpperCase()}
                    </div>
                ))}
                <div className="px-4 py-2.5 border-l border-[var(--color-border)]">AVG · L2+</div>
                <div className="px-4 py-2.5 border-l border-[var(--color-border)] text-right">¥ TOTAL</div>
            </div>

            {/* Rows */}
            {MODELS.map((m, mi) => {
                const avg = avgAcc(mi);
                const sev = totalSev(mi, 'l2') + totalSev(mi, 'l3');
                const cost = (MODELS[mi].costPer1k * 0.434).toFixed(2);   // mock: 434 tokens/case avg
                return (
                    <div key={m.id}
                         className={`grid grid-cols-[200px_repeat(4,minmax(0,1fr))_120px_120px]
                                     group transition-colors duration-100
                                     ${m.recommended ? 'bg-[var(--color-amber-trace)]' : 'hover:bg-[rgba(255,255,255,0.015)]'}
                                     border-b border-[var(--color-border)]`}>
                        {/* Model cell */}
                        <div className="px-4 py-3 border-r border-[var(--color-border)] relative">
                            {m.recommended && (
                                <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--color-amber)]"
                                      style={{ boxShadow: '0 0 8px var(--color-amber)' }} />
                            )}
                            <div className="flex items-center gap-2">
                                {m.recommended && (
                                    <span className="text-[var(--color-amber)] glow-amber-soft text-[12px]">★</span>
                                )}
                                <span className={`text-[14px] tracking-[0.02em] ${
                                    m.recommended ? 'text-[var(--color-amber)] glow-amber-soft' : 'text-[var(--color-text-bright)]'
                                }`}>
                                    {m.name}
                                </span>
                            </div>
                            <div className="mt-1 text-[10px] tracking-[0.1em] text-[var(--color-text-muted)] font-data uppercase">
                                {m.vendor} · ¥{m.costPer1k.toFixed(2)}/1K
                            </div>
                        </div>

                        {/* Score cells */}
                        {MATRIX[mi].map((cell, si) => (
                            <MatrixCell key={si} cell={cell} deltaVs={mi === 0 ? undefined : baseline[si].acc} />
                        ))}

                        {/* AVG · L2+ */}
                        <div className="px-4 py-3 border-r border-[var(--color-border)] flex flex-col justify-center">
                            <div className={`font-display text-[18px] ${
                                avg >= 92 ? 'text-[var(--color-mint)] glow-mint'
                                : avg >= 88 ? 'text-[var(--color-text-bright)]'
                                : 'text-[var(--color-text-muted)]'
                            }`}>
                                {avg.toFixed(1)}
                            </div>
                            <div className="font-data text-[10.5px] mt-0.5">
                                <span className="text-[var(--color-text-fade)]">L2+&nbsp;</span>
                                <span className={sev >= 5 ? 'text-[var(--color-L2)] glow-rose'
                                    : sev >= 2 ? 'text-[var(--color-L1)]'
                                    : 'text-[var(--color-mint)]'}>
                                    {sev}
                                </span>
                            </div>
                        </div>

                        {/* Cost */}
                        <div className="px-4 py-3 flex flex-col justify-center text-right">
                            <div className="font-data text-[14px] text-[var(--color-amber)]">¥{cost}</div>
                            <div className="font-data text-[10px] text-[var(--color-text-fade)]">/ run</div>
                        </div>
                    </div>
                );
            })}

            {/* Footer hint */}
            <div className="px-4 py-3 text-[10px] tracking-[0.16em] text-[var(--color-text-fade)] font-data
                            flex items-center justify-between">
                <span>HINT › click any cell to drill into failure cases</span>
                <span><span className="text-[var(--color-amber)]">★</span> Pareto-recommended candidate</span>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  Tab B · ANALYSIS — Pareto + Radar + Severity stack
// ════════════════════════════════════════════════════════════════════

function ParetoChart() {
    const W = 480, H = 320, padL = 50, padR = 20, padT = 28, padB = 48;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const points = MODELS.map((m, i) => ({
        name: m.name,
        cost: m.costPer1k,
        acc: avgAcc(i),
        rec: m.recommended,
        color: MODEL_COLORS[i],
    }));
    const costMax = 6, costMin = 0;
    const accMin = 80, accMax = 95;
    const sx = (c: number) => padL + ((c - costMin) / (costMax - costMin)) * innerW;
    const sy = (a: number) => padT + (1 - (a - accMin) / (accMax - accMin)) * innerH;

    // Pareto frontier (lower cost + higher acc dominates)
    // simple: connect (Qwen, DeepSeek, Claude, GPT) in cost asc
    const frontier = [...points].sort((a, b) => a.cost - b.cost);

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map(i => {
                const y = padT + (i / 4) * innerH;
                return (
                    <line key={`gh-${i}`} x1={padL} y1={y} x2={W - padR} y2={y}
                          stroke="var(--color-border)" strokeDasharray="2 4" />
                );
            })}
            {[0, 1, 2, 3, 4, 5, 6].map(c => {
                const x = sx(c);
                return (
                    <line key={`gv-${c}`} x1={x} y1={padT} x2={x} y2={H - padB}
                          stroke="var(--color-border)" strokeDasharray="2 4" />
                );
            })}

            {/* Axes */}
            <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--color-border-strong)" />
            <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--color-border-strong)" />

            {/* Y labels */}
            {[80, 85, 90, 95].map(a => (
                <text key={a} x={padL - 8} y={sy(a) + 3} textAnchor="end"
                      fontSize="10" fill="var(--color-text-dim)" fontFamily="JetBrains Mono">
                    {a}
                </text>
            ))}
            {/* X labels */}
            {[0, 1, 2, 3, 4, 5, 6].map(c => (
                <text key={c} x={sx(c)} y={H - padB + 16} textAnchor="middle"
                      fontSize="10" fill="var(--color-text-dim)" fontFamily="JetBrains Mono">
                    ¥{c}
                </text>
            ))}
            <text x={padL} y={padT - 12} fontSize="10" fill="var(--color-text-muted)"
                  fontFamily="IBM Plex Mono" letterSpacing="0.18em">
                ↑ ACCURACY (%)
            </text>
            <text x={W - padR} y={H - 6} textAnchor="end" fontSize="10" fill="var(--color-text-muted)"
                  fontFamily="IBM Plex Mono" letterSpacing="0.18em">
                COST / 1K TOK →
            </text>

            {/* Pareto frontier polyline */}
            <polyline
                fill="none"
                stroke="var(--color-amber)"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.45"
                points={frontier.map(p => `${sx(p.cost)},${sy(p.acc)}`).join(' ')}
            />

            {/* Points */}
            {points.map((p, i) => (
                <g key={p.name}>
                    {p.rec && (
                        <circle cx={sx(p.cost)} cy={sy(p.acc)} r="12"
                                fill="none" stroke="var(--color-amber)" strokeWidth="1"
                                strokeDasharray="2 2" opacity="0.6">
                            <animate attributeName="r" from="10" to="16" dur="2.4s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.6" to="0" dur="2.4s" repeatCount="indefinite" />
                        </circle>
                    )}
                    <circle cx={sx(p.cost)} cy={sy(p.acc)} r={p.rec ? 6 : 4.5}
                            fill={p.color}
                            style={{ filter: `drop-shadow(0 0 6px ${p.color})` }} />
                    <text x={sx(p.cost) + 10} y={sy(p.acc) + 4} fontSize="11"
                          fill="var(--color-text-bright)" fontFamily="IBM Plex Mono">
                        {p.name}
                    </text>
                    {p.rec && (
                        <text x={sx(p.cost) + 10} y={sy(p.acc) + 16} fontSize="9"
                              fill="var(--color-amber)" fontFamily="JetBrains Mono"
                              letterSpacing="0.15em">
                            ★ RECOMMENDED
                        </text>
                    )}
                </g>
            ))}
        </svg>
    );
}

function RadarChart() {
    const W = 320, H = 320, cx = W / 2, cy = H / 2;
    const R = 110;
    const axes = radarAxes.length;
    const angle = (i: number) => (Math.PI * 2 * i) / axes - Math.PI / 2;
    const pt = (i: number, v: number) => {
        const r = (v / 100) * R;
        return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
    };

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
            {/* concentric rings */}
            {[25, 50, 75, 100].map(p => (
                <polygon key={p}
                         points={Array.from({ length: axes }).map((_, i) => {
                             const [x, y] = pt(i, p);
                             return `${x},${y}`;
                         }).join(' ')}
                         fill="none" stroke="var(--color-border)" strokeDasharray="2 3" />
            ))}
            {/* spokes */}
            {Array.from({ length: axes }).map((_, i) => {
                const [x, y] = pt(i, 100);
                return (
                    <line key={i} x1={cx} y1={cy} x2={x} y2={y}
                          stroke="var(--color-border)" />
                );
            })}
            {/* axis labels */}
            {radarAxes.map((label, i) => {
                const [x, y] = pt(i, 118);
                return (
                    <text key={label} x={x} y={y} textAnchor="middle" dy="0.35em"
                          fontSize="9.5" fill="var(--color-text-muted)"
                          fontFamily="IBM Plex Mono" letterSpacing="0.12em">
                        {label.toUpperCase()}
                    </text>
                );
            })}
            {/* polygons per model */}
            {RADAR.map((vals, mi) => {
                const color = MODEL_COLORS[mi];
                const isRec = MODELS[mi].recommended;
                const points = vals.map((v, i) => {
                    const [x, y] = pt(i, v);
                    return `${x},${y}`;
                }).join(' ');
                return (
                    <g key={mi}>
                        <polygon points={points}
                                 fill={color}
                                 fillOpacity={isRec ? 0.12 : 0.05}
                                 stroke={color}
                                 strokeWidth={isRec ? 1.5 : 1}
                                 opacity={isRec ? 0.95 : 0.55}
                                 style={isRec ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined} />
                    </g>
                );
            })}
        </svg>
    );
}

function SeverityStack() {
    return (
        <div className="space-y-3">
            {MODELS.map((m, mi) => {
                const total = totalCases(mi);
                const l0 = MATRIX[mi].reduce((s, c) => s + c.l0, 0);
                const l1 = MATRIX[mi].reduce((s, c) => s + c.l1, 0);
                const l2 = MATRIX[mi].reduce((s, c) => s + c.l2, 0);
                const l3 = MATRIX[mi].reduce((s, c) => s + c.l3, 0);
                const pct = (n: number) => (n / total) * 100;
                return (
                    <div key={m.id}>
                        <div className="flex items-center justify-between mb-1.5 text-[10.5px] font-mono tracking-[0.1em]">
                            <span className={m.recommended ? 'text-[var(--color-amber)] glow-amber-soft' : 'text-[var(--color-text-bright)]'}>
                                {m.recommended && '★ '}{m.name}
                            </span>
                            <span className="text-[var(--color-text-fade)] font-data">
                                {l0} / {l1} / <span className="text-[var(--color-L2)]">{l2}</span> / <span className="text-[var(--color-L3)]">{l3}</span>
                            </span>
                        </div>
                        <div className="h-[10px] flex overflow-hidden">
                            <div style={{ width: `${pct(l0)}%`, background: 'var(--color-L0)', opacity: 0.7 }} />
                            <div style={{ width: `${pct(l1)}%`, background: 'var(--color-L1)' }} />
                            <div style={{ width: `${pct(l2)}%`, background: 'var(--color-L2)',
                                          boxShadow: '0 0 6px var(--color-L2)' }} />
                            <div style={{ width: `${pct(l3)}%`, background: 'var(--color-L3)',
                                          boxShadow: '0 0 6px var(--color-L3)' }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function AnalysisTab() {
    return (
        <div className="reveal-in p-6 space-y-8">
            {/* Pareto */}
            <section>
                <div className="tl-rule mb-4">
                    <span>FIG. 01 · COST × ACCURACY PARETO</span>
                </div>
                <div className="grid grid-cols-[1fr_280px] gap-8 items-center">
                    <ParetoChart />
                    <div className="space-y-3 text-[12px] text-[var(--color-text-muted)] leading-[1.7]">
                        <p>
                            <span className="text-[var(--color-amber)] font-mono tracking-[0.15em] text-[10px]">
                                READING ›
                            </span>
                            <br />
                            Pareto frontier connects non-dominated candidates. Any point above the
                            dashed line is sub-optimal — there exists a cheaper or more accurate alternative.
                        </p>
                        <p className="border-t border-[var(--color-border)] pt-3">
                            <span className="text-[var(--color-amber)] glow-amber-soft">★ DeepSeek-V3</span>
                            sits at the inflection point: <span className="font-data">−80%</span> cost
                            vs GPT-4o while sacrificing only <span className="font-data">2.7 pp</span> accuracy.
                            Recommended for production unless L2+ exposure is intolerable.
                        </p>
                    </div>
                </div>
            </section>

            {/* Radar */}
            <section>
                <div className="tl-rule mb-4">
                    <span>FIG. 02 · MULTI-DIMENSIONAL CAPABILITY</span>
                </div>
                <div className="grid grid-cols-[320px_1fr] gap-8 items-center">
                    <RadarChart />
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            {MODELS.map((m, i) => (
                                <div key={m.id} className="flex items-center gap-2.5 text-[11px] font-mono">
                                    <span className="inline-block w-3 h-[2px]"
                                          style={{ background: MODEL_COLORS[i], boxShadow: `0 0 4px ${MODEL_COLORS[i]}` }} />
                                    <span className={m.recommended ? 'text-[var(--color-amber)]' : 'text-[var(--color-text-bright)]'}>
                                        {m.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p className="text-[12px] text-[var(--color-text-muted)] leading-[1.7] border-t border-[var(--color-border)] pt-3">
                            <span className="text-[var(--color-amber)] font-mono tracking-[0.15em] text-[10px]">READING ›</span>
                            <br />
                            DeepSeek-V3 trails leaders by &lt; 4 pp on every dimension except <span className="font-data">BOUNDARY</span>.
                            For fraud detection — where boundary cases (ambiguous related-party signals) appear ~12% of the time —
                            this gap is the principal risk to monitor.
                        </p>
                    </div>
                </div>
            </section>

            {/* Severity */}
            <section>
                <div className="tl-rule mb-4">
                    <span>FIG. 03 · SEVERITY DISTRIBUTION</span>
                </div>
                <div className="grid grid-cols-[1fr_280px] gap-8 items-start">
                    <SeverityStack />
                    <div className="space-y-3 text-[12px] text-[var(--color-text-muted)] leading-[1.7]">
                        <p>
                            <span className="text-[var(--color-amber)] font-mono tracking-[0.15em] text-[10px]">READING ›</span>
                            <br />
                            Each bar = 160 cases per model. Width ∝ count.
                        </p>
                        <p className="text-[11px] border-t border-[var(--color-border)] pt-3 font-mono tracking-wide">
                            <span className="text-[var(--color-L0)]">L0</span> PASS ·{' '}
                            <span className="text-[var(--color-L1)]">L1</span> DATA·DEV ·{' '}
                            <span className="text-[var(--color-L2)]">L2</span> COMP·INC ·{' '}
                            <span className="text-[var(--color-L3)]">L3</span> DEC·ERR
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  Tab C · DECISION BOOK (Bureau Report aesthetic)
// ════════════════════════════════════════════════════════════════════

type Audience = 'boss' | 'compliance' | 'engineering';

const NARRATIVES: Record<Audience, { caps: string; title: string; body: string }> = {
    boss: {
        caps: 'FOR · LEADERSHIP',
        title: 'Pick DeepSeek-V3. You save ¥4 of every ¥5 on inference, and the team can ship next sprint.',
        body: 'On our fraud-detection benchmark of 160 cases, DeepSeek-V3 delivers 89.5% accuracy — within 2.7 percentage points of GPT-4o, the most expensive option — while costing one-fifth as much per call. At our projected query volume (~20,000 calls/day), this is the difference between ¥3.0M and ¥0.6M of annual model spend. The remaining accuracy gap shows up exclusively on boundary cases involving related-party concealment; we mitigate that with a downstream rule check rather than paying 5× for marginal precision.',
    },
    compliance: {
        caps: 'FOR · COMPLIANCE',
        title: 'Net L2 exposure is unchanged. No L3 events. We retain the right to escalate to GPT-4o for high-risk cases.',
        body: 'Across the audit, DeepSeek-V3 produced 5 L2-severity events (compliance-relevant errors) and 0 L3 events (decision-grade misjudgments). This is identical to Claude 4.6 and one event above GPT-4o. All 5 L2 events shared a common pattern — under-flagging when the related-party link was three hops away — which is documented in the failure-case appendix and addressable via the pre-existing related-party rule engine. We propose a routing policy: cases above the rule-engine confidence threshold proceed with DeepSeek-V3; the remainder escalate to GPT-4o for second opinion. Net L2+ exposure under this policy is projected at 1–2 events per 160 cases.',
    },
    engineering: {
        caps: 'FOR · ENGINEERING',
        title: 'Replace gpt-4o with deepseek-v3 in fraud-pipeline.yaml. Keep gpt-4o configured as the fallback.',
        body: 'Concrete changes: (1) update fraud-pipeline.yaml model field from openai/gpt-4o to siliconflow/deepseek-ai/DeepSeek-V3; (2) keep the existing OpenAI client and add SiliconFlow as a sibling — both speak the OpenAI Chat Completions schema, no adapter changes required; (3) wire the related-party rule engine output into a confidence gate that triggers an opportunistic re-run on GPT-4o when below threshold; (4) emit eval-studio:run-040 as the regression baseline in CI — any future change to this pipeline must clear ≥ 89.0% accuracy and ≤ 5 L2 events on the same 160-case set before merge. Estimated migration: 1 PR, 2 days including the gate.',
    },
};

function DecisionBookTab() {
    const [aud, setAud] = useState<Audience>('boss');

    return (
        <div className="bureau bureau-isolate reveal-in">
            <div className="max-w-[860px] mx-auto px-12 py-16 relative">
                {/* Header */}
                <div className="flex items-start justify-between mb-12 gap-6">
                    <div>
                        <div className="bureau-meta">DECISION · BOOK · MEMO No. 040</div>
                        <h1 className="mt-4 text-[42px] leading-[1.05] tracking-[-0.01em]">
                            Model Selection: Fraud Detection Pipeline
                        </h1>
                        <div className="mt-3 text-[14px] italic text-[var(--bureau-ink-soft)]">
                            Prepared by Eval Studio · Run #040 · 160 trials · 2026-05-24
                        </div>
                    </div>
                    <div className="bureau-stamp">
                        Recommendation<br />Approved
                    </div>
                </div>

                <div className="bureau-rule-thick mb-10" />

                {/* SECTION 01 — Recommendation */}
                <section className="grid grid-cols-[120px_1fr] gap-8 mb-14">
                    <div className="bureau-section-num">01</div>
                    <div>
                        <div className="bureau-caps mb-2">Recommendation</div>
                        <h2 className="text-[26px] leading-[1.25] tracking-[-0.005em] mb-4">
                            Adopt <span className="text-[var(--bureau-seal)]">DeepSeek-V3</span> as the
                            production model for fraud-detection.
                        </h2>
                        <div className="bureau-pull mt-6">
                            “Within 2.7 pp of the strongest candidate, at one-fifth the cost,
                            with zero L3 events across 160 cases.”
                        </div>
                    </div>
                </section>

                <div className="bureau-rule mb-10" />

                {/* SECTION 02 — Cost / Acc tradeoff */}
                <section className="grid grid-cols-[120px_1fr] gap-8 mb-14">
                    <div className="bureau-section-num">02</div>
                    <div>
                        <div className="bureau-caps mb-3">Tradeoff Snapshot</div>
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            {MODELS.map((m, i) => (
                                <div key={m.id} className={`pt-3 border-t-2
                                    ${m.recommended ? 'border-[var(--bureau-seal)]' : 'border-[var(--bureau-rule)]'}`}>
                                    <div className="bureau-caps">{m.recommended && '★ '}{m.name}</div>
                                    <div className="font-serif text-[24px] mt-1">{avgAcc(i).toFixed(1)}<span className="text-[14px] text-[var(--bureau-mute)]">%</span></div>
                                    <div className="font-mono text-[11px] text-[var(--bureau-mute)] mt-1 tracking-[0.05em]">
                                        ¥{m.costPer1k.toFixed(2)} / 1K
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="bureau-body">
                            Annual spend projection at 20,000 calls/day, 434 tokens/call:
                            GPT-4o ≈ <strong>¥3,170,000</strong> · Claude 4.6 ≈ <strong>¥1,900,000</strong> ·
                            DeepSeek-V3 ≈ <strong>¥634,000</strong> · Qwen-Max ≈ <strong>¥380,000</strong>.
                            Switching from GPT-4o to DeepSeek-V3 saves an estimated
                            <strong> ¥2.5 million</strong> per year on this pipeline alone.
                        </p>
                    </div>
                </section>

                <div className="bureau-rule mb-10" />

                {/* SECTION 03 — Stakeholder narratives (3 tabs) */}
                <section className="grid grid-cols-[120px_1fr] gap-8 mb-14">
                    <div className="bureau-section-num">03</div>
                    <div>
                        <div className="bureau-caps mb-4">Stakeholder Narratives</div>

                        {/* tab buttons */}
                        <div className="flex gap-0 mb-6 border-b border-[var(--bureau-rule)]">
                            {(['boss', 'compliance', 'engineering'] as Audience[]).map(a => (
                                <button key={a}
                                        onClick={() => setAud(a)}
                                        className={`px-4 py-2 font-mono text-[10.5px] tracking-[0.22em] uppercase
                                                   border-b-2 -mb-px transition-colors duration-150
                                                   ${aud === a
                                                     ? 'border-[var(--bureau-seal)] text-[var(--bureau-seal)]'
                                                     : 'border-transparent text-[var(--bureau-mute)] hover:text-[var(--bureau-ink)]'
                                                   }`}>
                                    {a}
                                </button>
                            ))}
                        </div>

                        {/* tab content */}
                        <div className="reveal-in" key={aud}>
                            <div className="bureau-caps mb-2">{NARRATIVES[aud].caps}</div>
                            <h3 className="text-[20px] leading-[1.35] mb-4 italic font-medium">
                                {NARRATIVES[aud].title}
                            </h3>
                            <p className="bureau-body">{NARRATIVES[aud].body}</p>
                        </div>
                    </div>
                </section>

                <div className="bureau-rule mb-10" />

                {/* SECTION 04 — Risk list */}
                <section className="grid grid-cols-[120px_1fr] gap-8 mb-14">
                    <div className="bureau-section-num">04</div>
                    <div>
                        <div className="bureau-caps mb-3">Known Risks & Mitigations</div>
                        <ul className="space-y-3 bureau-body">
                            {[
                                {
                                    sev: 'L2',
                                    risk: 'Related-party concealment 3+ hops deep occasionally under-flagged (5 / 160 cases).',
                                    mit: 'Route low-confidence outputs through the rule engine; escalate to GPT-4o on disagreement.',
                                },
                                {
                                    sev: 'L1',
                                    risk: 'Numeric extraction loses precision on hand-written Chinese amounts (¥四十二万).',
                                    mit: 'Pre-normalize via Tesseract OCR + amount-conversion rule before LLM call.',
                                },
                                {
                                    sev: 'L1',
                                    risk: 'Boundary on inventory write-down classification vs. normal turnover.',
                                    mit: 'Add 5-shot examples covering 4 industry baselines (manufacturing / retail / agri / pharma).',
                                },
                            ].map((r, i) => (
                                <li key={i} className="grid grid-cols-[42px_1fr] gap-3 pl-3 border-l border-[var(--bureau-rule)]">
                                    <span className={`font-mono text-[11px] tracking-[0.15em] pt-0.5
                                                     ${r.sev === 'L2' ? 'text-[var(--bureau-seal)]' : 'text-[var(--bureau-mark)]'}`}>
                                        {r.sev}
                                    </span>
                                    <div>
                                        <div>{r.risk}</div>
                                        <div className="text-[var(--bureau-mute)] text-[13px] italic mt-1">
                                            → {r.mit}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                <div className="bureau-rule mb-10" />

                {/* Footer */}
                <footer className="flex items-end justify-between text-[var(--bureau-mute)] mt-10 gap-6">
                    <div>
                        <div className="bureau-caps">Filed under</div>
                        <div className="font-serif italic text-[14px] mt-1">
                            eval-studio · /runs/run-040 · permalink at top right
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="bureau-caps">Approved by</div>
                        <div className="font-serif text-[20px] mt-1 italic">M. Mao</div>
                        <div className="bureau-caps mt-1">AI Product · 2026-05-24</div>
                    </div>
                </footer>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════
//  Page
// ════════════════════════════════════════════════════════════════════

export default function RunReport() {
    const { id } = useParams();
    const [tab, setTab] = useState<Tab>('matrix');

    return (
        <div className="max-w-[1320px] mx-auto reveal-in">
            <PageHeader id={id ?? 'run-040'} />
            <SummaryStrip />
            <div className="mt-8">
                <TabBar tab={tab} setTab={setTab} />
                {tab === 'matrix'   && <MatrixTab />}
                {tab === 'analysis' && <AnalysisTab />}
                {tab === 'decision' && <DecisionBookTab />}
            </div>
        </div>
    );
}
