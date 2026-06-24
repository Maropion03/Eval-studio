import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, APIError, type Dataset, type DatasetCases } from '../services/api';

const SEV_COLOR: Record<string, string> = {
    L0: 'var(--color-L0)', L1: 'var(--color-L1)', L2: 'var(--color-L2)', L3: 'var(--color-L3)',
};

function extractErrors(e: unknown): string[] {
    if (e instanceof APIError) {
        const d = e.detail as { detail?: string | { errors?: string[]; message?: string } } | undefined;
        if (typeof d?.detail === 'string') return [d.detail];            // e.g. 413 "file too large"
        if (d?.detail?.errors?.length) return d.detail.errors;           // 422 validation list
        if (d?.detail?.message) return [d.detail.message];
        return [`${e.status} ${e.message}`];
    }
    return [e instanceof Error ? e.message : 'upload failed'];
}

function DatasetCard({
    ds, selected, onSelect, onDelete, onRun,
}: {
    ds: Dataset; selected: boolean;
    onSelect: () => void; onDelete: () => void; onRun: () => void;
}) {
    return (
        <button
            onClick={onSelect}
            className={`group block w-full text-left tl-panel px-4 py-3.5 transition-colors duration-100
                        ${selected ? 'ring-amber' : 'hover:bg-[var(--color-amber-trace)]'}`}
        >
            <div className="flex items-center justify-between">
                <span className="font-data text-[11px] tracking-[0.16em] text-[var(--color-amber)]">{ds.code}</span>
                {ds.is_starter ? (
                    <span className="text-[9px] tracking-[0.18em] font-data text-[var(--color-text-dim)] uppercase">starter</span>
                ) : (
                    <span className="text-[9px] tracking-[0.18em] font-data text-[var(--color-mint)] uppercase">upload</span>
                )}
            </div>
            <div className="mt-1.5 text-[14px] text-[var(--color-text-bright)] tracking-[0.01em]">{ds.name}</div>
            <div className="mt-0.5 text-[10.5px] text-[var(--color-text-muted)] uppercase tracking-[0.08em]">
                {ds.scenario.replace(/_/g, ' ')}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 font-data text-[10.5px]">
                <div>
                    <div className="text-[var(--color-text-fade)] tracking-[0.12em]">CASES</div>
                    <div className="text-[var(--color-text-bright)] text-[13px]">{ds.cases_count}</div>
                </div>
                <div>
                    <div className="text-[var(--color-text-fade)] tracking-[0.12em]">~TOK</div>
                    <div className="text-[var(--color-text-bright)] text-[13px]">{ds.avg_tokens}</div>
                </div>
                <div>
                    <div className="text-[var(--color-text-fade)] tracking-[0.12em]">L2+ %</div>
                    <div className="text-[var(--color-L2)] text-[13px]">{ds.typical_l2_rate}</div>
                </div>
            </div>
            <div className="mt-3 flex items-center gap-3 text-[10px] tracking-[0.16em] font-data uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                <span
                    role="button"
                    tabIndex={0}
                    onClick={(ev) => { ev.stopPropagation(); onRun(); }}
                    onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); onRun(); } }}
                    className="text-[var(--color-amber)] hover:glow-amber-soft cursor-pointer"
                >
                    ▸ NEW RUN
                </span>
                {!ds.is_starter && (
                    <span
                        role="button"
                        tabIndex={0}
                        onClick={(ev) => { ev.stopPropagation(); onDelete(); }}
                        onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); onDelete(); } }}
                        className="text-[var(--color-text-dim)] hover:text-[var(--color-L2)] cursor-pointer"
                    >
                        ✗ DELETE
                    </span>
                )}
            </div>
        </button>
    );
}

function CaseInspector({ data }: { data: DatasetCases }) {
    const [open, setOpen] = useState<string | null>(null);
    return (
        <div className="tl-panel">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <span className="font-data text-[12px] tracking-[0.14em] text-[var(--color-text-bright)]">{data.name}</span>
                <span className="font-data text-[10.5px] text-[var(--color-text-muted)]">
                    {data.cases.length} / {data.total} CASES
                </span>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
                {data.cases.map((c) => {
                    const isOpen = open === c.case_code;
                    return (
                        <div key={c.case_code} className="border-b border-[var(--color-border)]">
                            <button
                                onClick={() => setOpen(isOpen ? null : c.case_code)}
                                className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-panel-2)] transition-colors flex items-center gap-3"
                            >
                                <span
                                    className="w-2 h-2 shrink-0"
                                    style={{ background: SEV_COLOR[c.risk_tier], boxShadow: `0 0 6px ${SEV_COLOR[c.risk_tier]}` }}
                                />
                                <span className="font-data text-[10.5px] text-[var(--color-text-fade)] w-[96px] shrink-0">{c.case_code}</span>
                                <span className="text-[12px] text-[var(--color-text)] truncate flex-1">{c.question}</span>
                                <span className="font-data text-[9.5px] tracking-[0.12em] text-[var(--color-text-dim)] uppercase">{c.difficulty}</span>
                                <span className="font-data text-[10px]" style={{ color: SEV_COLOR[c.risk_tier] }}>{c.risk_tier}</span>
                            </button>
                            {isOpen && (
                                <div className="px-4 pb-4 pt-1 space-y-3 bg-[var(--color-canvas)]">
                                    {c.context_preview && (
                                        <Field label="CONTEXT">
                                            <div className="text-[11.5px] leading-[1.6] text-[var(--color-text-muted)] whitespace-pre-wrap max-h-[160px] overflow-y-auto">
                                                {c.context_preview}
                                            </div>
                                        </Field>
                                    )}
                                    <Field label="QUESTION">
                                        <div className="text-[12px] text-[var(--color-text-bright)]">{c.question}</div>
                                    </Field>
                                    {!!c.reference.must_contain_facts?.length && (
                                        <Field label="MUST CONTAIN FACTS">
                                            <ul className="space-y-1">
                                                {c.reference.must_contain_facts.map((f, i) => (
                                                    <li key={i} className="text-[11.5px] text-[var(--color-mint)] font-data">✓ {f}</li>
                                                ))}
                                            </ul>
                                        </Field>
                                    )}
                                    {!!c.reference.must_cite_sources?.length && (
                                        <Field label="MUST CITE SOURCES">
                                            <ul className="space-y-1">
                                                {c.reference.must_cite_sources.map((f, i) => (
                                                    <li key={i} className="text-[11.5px] text-[var(--color-amber)] font-data">§ {f}</li>
                                                ))}
                                            </ul>
                                        </Field>
                                    )}
                                    {!!c.reference.forbidden_claims?.length && (
                                        <Field label="FORBIDDEN (RED LINE)">
                                            <ul className="space-y-1">
                                                {c.reference.forbidden_claims.map((f, i) => (
                                                    <li key={i} className="text-[11.5px] text-[var(--color-L2)] font-data">⊘ {f}</li>
                                                ))}
                                            </ul>
                                        </Field>
                                    )}
                                    {c.reference.golden_answer && (
                                        <Field label="GOLDEN ANSWER">
                                            <div className="text-[12px] leading-[1.6] text-[var(--color-text)]">{c.reference.golden_answer}</div>
                                        </Field>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[9.5px] tracking-[0.2em] font-data text-[var(--color-text-dim)] mb-1">{label}</div>
            {children}
        </div>
    );
}

export default function Datasets() {
    const navigate = useNavigate();
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [cases, setCases] = useState<DatasetCases | null>(null);
    const [loadingCases, setLoadingCases] = useState(false);
    const [uploadErrors, setUploadErrors] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);

    const reload = () =>
        api.datasets.list().then((rows) => {
            setDatasets(rows);
            return rows;
        });

    useEffect(() => { reload().catch(() => setUploadErrors(['backend unreachable'])); }, []);

    const select = (id: string) => {
        setSelected(id);
        setCases(null);
        setLoadingCases(true);
        api.datasets.cases(id, 500)
            .then(setCases)
            .catch(() => setCases(null))
            .finally(() => setLoadingCases(false));
    };

    const doUpload = async (file: File) => {
        setUploading(true);
        setUploadErrors([]);
        try {
            const ds = await api.datasets.upload(file);
            await reload();
            select(ds.id);
        } catch (e) {
            setUploadErrors(extractErrors(e));
        } finally {
            setUploading(false);
            if (fileInput.current) fileInput.current.value = '';
        }
    };

    const remove = async (id: string) => {
        await api.datasets.remove(id).catch(() => undefined);
        if (selected === id) { setSelected(null); setCases(null); }
        reload();
    };

    const startRun = (ds: Dataset) =>
        navigate('/new', { state: { datasetId: ds.id } });

    return (
        <div className="max-w-[1200px] mx-auto reveal-in">
            <header className="mb-8">
                <div className="flex items-center gap-3 text-[10.5px] tracking-[0.28em] text-[var(--color-text-dim)]">
                    <span className="text-[var(--color-amber)]">▌</span>
                    MODULE&nbsp;03&nbsp;·&nbsp;CASE&nbsp;LIBRARY
                </div>
                <h1 className="font-crt text-[64px] leading-[0.9] text-[var(--color-text-bright)] mt-2">
                    DATASETS<span className="blink text-[var(--color-amber)] glow-amber">_</span>
                </h1>
                <p className="mt-3 text-[12px] tracking-[0.06em] text-[var(--color-text-muted)] max-w-[640px]">
                    Starter pack · 4 scenarios. Inspect any case, or upload your own
                    JSON / CSV — validated against the case schema on the way in.
                </p>
            </header>

            {/* Upload zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) doUpload(f);
                }}
                className={`mb-4 border border-dashed px-6 py-6 text-center transition-colors
                            ${dragOver ? 'border-[var(--color-amber)] bg-[var(--color-amber-trace)]' : 'border-[var(--color-border-strong)]'}`}
            >
                <div className="text-[12px] tracking-[0.08em] text-[var(--color-text-muted)]">
                    {uploading ? 'VALIDATING…' : (
                        <>
                            Drop a <span className="text-[var(--color-amber)] font-data">.json</span> / <span className="text-[var(--color-amber)] font-data">.csv</span> file here, or{' '}
                            <button
                                onClick={() => fileInput.current?.click()}
                                className="text-[var(--color-amber)] underline underline-offset-2 hover:glow-amber-soft"
                            >
                                browse
                            </button>
                        </>
                    )}
                </div>
                <div className="mt-1.5 text-[10px] tracking-[0.1em] text-[var(--color-text-fade)] font-data">
                    each case needs input.question + one reference field · max 500 cases / 5MB
                </div>
                <input
                    ref={fileInput}
                    type="file"
                    accept=".json,.csv,application/json,text/csv"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(f); }}
                />
            </div>

            {uploadErrors.length > 0 && (
                <div className="mb-6 border border-[var(--color-L2)] bg-[var(--color-L2-trace)] px-4 py-3">
                    <div className="text-[10.5px] tracking-[0.16em] font-data text-[var(--color-L2)] mb-1.5">
                        ✗ VALIDATION FAILED — {uploadErrors.length} ISSUE(S)
                    </div>
                    <ul className="space-y-0.5 max-h-[160px] overflow-y-auto">
                        {uploadErrors.map((e, i) => (
                            <li key={i} className="text-[11px] text-[var(--color-text-muted)] font-data">· {e}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6 items-start">
                {/* Left: dataset list */}
                <div>
                    <div className="tl-rule mb-3"><span>{datasets.length} DATASETS</span></div>
                    <div className="space-y-3">
                        {datasets.map((ds) => (
                            <DatasetCard
                                key={ds.id}
                                ds={ds}
                                selected={selected === ds.id}
                                onSelect={() => select(ds.id)}
                                onDelete={() => remove(ds.id)}
                                onRun={() => startRun(ds)}
                            />
                        ))}
                        {datasets.length === 0 && (
                            <div className="text-[11px] text-[var(--color-text-dim)] font-data py-8 text-center">
                                no datasets — upload one above
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: inspector */}
                <div>
                    <div className="tl-rule mb-3"><span>INSPECT</span></div>
                    {!selected && (
                        <div className="tl-panel px-6 py-16 text-center text-[11.5px] text-[var(--color-text-dim)] font-data tracking-[0.1em]">
                            ◌ select a dataset to inspect its cases
                        </div>
                    )}
                    {loadingCases && (
                        <div className="tl-panel px-6 py-16 text-center text-[11.5px] text-[var(--color-amber)] font-data tracking-[0.1em] blink">
                            loading cases…
                        </div>
                    )}
                    {cases && !loadingCases && <CaseInspector data={cases} />}
                </div>
            </div>
        </div>
    );
}
