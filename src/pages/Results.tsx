import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ShieldCheck,
    Target,
    Brain,
    CaretDown,
    CaretUp,
    Warning,
    CheckCircle,
    XCircle,
    ShieldWarning,
    GitDiff,
    Bug,
    CircleNotch,
} from '@phosphor-icons/react';
import { type EvaluationItem } from '../data/mockData';
import { getRunItems, getRun } from '../services/api';

function ScoreBadge({ score, max = 1 }: { score: number; max?: number }) {
    const normalized = max === 1 ? score : score / 5;
    const isLow = normalized < 0.7;
    const isMid = normalized >= 0.7 && normalized < 0.85;

    return (
        <span
            className={`inline-flex items-center gap-1 text-[12px] font-semibold font-mono px-2 py-0.5 rounded-full border ${isLow
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : isMid
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
        >
            {isLow && <Warning weight="duotone" className="text-xs" />}
            {score.toFixed(max === 1 ? 2 : 1)}
        </span>
    );
}

function FailureTypeBadge({ type, t }: { type: string; t: (key: string) => string }) {
    const config: Record<string, { color: string; icon: React.ReactNode; labelKey: string }> = {
        Retrieval_Failure: {
            color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
            icon: <XCircle weight="duotone" className="text-sm" />,
            labelKey: 'results.failure_retrieval',
        },
        Reasoning_Error: {
            color: 'bg-red-500/10 text-red-400 border-red-500/20',
            icon: <Warning weight="duotone" className="text-sm" />,
            labelKey: 'results.failure_reasoning',
        },
        Safety_Refusal: {
            color: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
            icon: <ShieldWarning weight="duotone" className="text-sm" />,
            labelKey: 'results.failure_safety',
        },
    };
    const c = config[type] || config.Reasoning_Error;
    return (
        <span
            className={`inline-flex items-center gap-1 text-[11.5px] font-medium px-2 py-0.5 rounded-full border ${c.color}`}
        >
            {c.icon} {t(c.labelKey)}
        </span>
    );
}

function HighlightedResponse({ item }: { item: EvaluationItem }) {
    if (!item.hallucinationSpans || item.hallucinationSpans.length === 0) {
        return <span>{item.response}</span>;
    }

    const sortedSpans = [...item.hallucinationSpans].sort((a, b) => a.start - b.start);
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;

    sortedSpans.forEach((span, i) => {
        if (span.start > lastIdx) {
            parts.push(<span key={`normal-${i}`}>{item.response.slice(lastIdx, span.start)}</span>);
        }
        parts.push(
            <span
                key={`hl-${i}`}
                className="bg-red-500/20 text-red-300 px-0.5 rounded-sm border-b-2 border-red-500/50"
            >
                {item.response.slice(span.start, span.end)}
            </span>
        );
        lastIdx = span.end;
    });

    if (lastIdx < item.response.length) {
        parts.push(<span key="tail">{item.response.slice(lastIdx)}</span>);
    }

    return <>{parts}</>;
}

function DiffView({ item, t }: { item: EvaluationItem; t: (key: string) => string }) {
    return (
        <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
                <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-[12px] font-semibold text-zinc-500 uppercase tracking-wide">
                        {t('results.context_source')}
                    </span>
                </div>
                <div className="text-[12.5px] font-mono bg-zinc-900/50 p-3.5 rounded-lg border border-white/5 leading-relaxed text-zinc-400 whitespace-pre-wrap">
                    {item.context}
                </div>
            </div>
            <div>
                <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-[12px] font-semibold text-zinc-500 uppercase tracking-wide">
                        {t('results.response_model')}
                    </span>
                </div>
                <div className="text-[12.5px] font-mono bg-zinc-900/50 p-3.5 rounded-lg border border-white/5 leading-relaxed text-zinc-400 whitespace-pre-wrap">
                    <HighlightedResponse item={item} />
                </div>
            </div>
        </div>
    );
}

export default function Results() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const runId = searchParams.get('runId');

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [items, setItems] = useState<EvaluationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [runInfo, setRunInfo] = useState<{ datasetName: string; model: string; totalItems: number } | null>(null);

    useEffect(() => {
        if (!runId) {
            setLoading(false);
            return;
        }

        let intervalId: ReturnType<typeof setInterval>;

        async function fetchData() {
            try {
                const [run, runItems] = await Promise.all([
                    getRun(runId!),
                    getRunItems(runId!),
                ]);
                setRunInfo({
                    datasetName: run.datasetName,
                    model: run.model,
                    totalItems: run.totalItems,
                });
                setItems(runItems);

                // If running, keep polling
                if (run.status === 'running') {
                    return true; // continue polling
                }
                return false; // stop polling
            } catch (err) {
                console.error('Failed to load results:', err);
                return false;
            } finally {
                setLoading(false);
            }
        }

        // Initial fetch
        fetchData().then((shouldPoll) => {
            if (shouldPoll) {
                intervalId = setInterval(async () => {
                    const continuePolling = await fetchData();
                    if (!continuePolling) {
                        clearInterval(intervalId);
                    }
                }, 2000);
            }
        });

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [runId]);

    const avgScores = useMemo(() => {
        const len = items.length;
        if (len === 0) return { faithfulness: 0, relevance: 0, coherence: 0 };
        return {
            faithfulness: items.reduce((s, i) => s + i.scores.faithfulness, 0) / len,
            relevance: items.reduce((s, i) => s + i.scores.relevance, 0) / len,
            coherence: items.reduce((s, i) => s + i.scores.coherence, 0) / len,
        };
    }, [items]);

    const summaryCards = [
        { title: t('results.avg_faithfulness'), value: avgScores.faithfulness, max: 1, icon: ShieldCheck, accent: 'text-purple-400' },
        { title: t('results.avg_relevance'), value: avgScores.relevance, max: 1, icon: Target, accent: 'text-blue-400' },
        { title: t('results.avg_coherence'), value: avgScores.coherence, max: 5, icon: Brain, accent: 'text-teal-400' },
    ];

    const lowScoreCount = items.filter(
        (i) => i.scores.faithfulness < 0.7 || i.scores.relevance < 0.7
    ).length;

    const handleDebugInPlayground = (item: EvaluationItem) => {
        navigate('/playground', {
            state: {
                query: item.query,
                context: item.context,
                response: item.response,
            },
        });
    };

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto flex items-center justify-center py-20">
                <CircleNotch weight="bold" className="text-3xl text-indigo-400 animate-spin" />
            </div>
        );
    }

    if (!runId) {
        return (
            <div className="max-w-6xl mx-auto flex flex-col items-center justify-center py-20 text-zinc-600">
                <p className="text-lg font-medium">{t('results.no_run_selected')}</p>
                <p className="text-sm text-zinc-500">{t('results.select_run_hint')}</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-3">
                        {t('results.title')}
                        {/* Running Indicator */}
                        {runInfo && (
                            <div className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border uppercase tracking-wider flex items-center gap-1.5 ${items.length < (runInfo as any).totalItems // heuristic for running
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                {items.length < (runInfo as any).totalItems ? (
                                    <>
                                        <CircleNotch weight="bold" className="animate-spin text-xs" />
                                        {t('status.running').toUpperCase()}
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle weight="fill" className="text-xs" />
                                        {t('status.completed').toUpperCase()}
                                    </>
                                )}
                            </div>
                        )}
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1">
                        {t('results.subtitle', {
                            dataset: runInfo?.datasetName ?? 'Unknown',
                            model: runInfo?.model ?? 'Unknown',
                            count: items.length,
                        })}
                    </p>
                </div>

                {/* Progress Bar (if running) */}
                {runInfo && items.length < (runInfo as any).totalItems && (
                    <div className="flex flex-col items-end gap-1.5">
                        <p className="text-[11px] font-mono text-zinc-500">
                            {t('results.processed').toUpperCase()} <span className="text-zinc-200 font-semibold">{items.length}</span> / {(runInfo as any).totalItems}
                        </p>
                        <div className="w-48 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-500 ease-out relative"
                                style={{ width: `${(items.length / (runInfo as any).totalItems) * 100}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite]" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {summaryCards.map((card) => (
                    <div
                        key={card.title}
                        className="bg-zinc-900/30 rounded-xl border border-white/5 p-5 hover:border-white/10 transition-colors"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-white/5 to-white/0 border border-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]">
                                <card.icon weight="duotone" className={`text-2xl ${card.accent}`} />
                            </div>
                            <ScoreBadge score={card.value} max={card.max} />
                        </div>
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{card.title}</p>
                        <p className="text-3xl font-bold text-zinc-100 mt-0.5 font-mono">
                            {card.value.toFixed(card.max === 1 ? 2 : 1)}
                            <span className="text-[14px] font-normal text-zinc-600 ml-1">/ {card.max}</span>
                        </p>
                    </div>
                ))}
            </div>

            {/* Alert for low scores */}
            {lowScoreCount > 0 && (
                <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/15 rounded-xl px-5 py-4">
                    <Warning weight="duotone" className="text-xl text-red-400 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-[13px] font-semibold text-red-300">
                            {t('results.low_score_alert', { count: lowScoreCount })}
                        </p>
                        <p className="text-[12px] text-red-400/70 mt-0.5">
                            {t('results.low_score_hint')}
                        </p>
                    </div>
                </div>
            )}

            {/* Detailed Results List */}
            <div className="space-y-3">
                {items.map((item) => {
                    const isLow = item.scores.faithfulness < 0.7 || item.scores.relevance < 0.7;
                    const isExpanded = expandedId === item.id;

                    return (
                        <div
                            key={item.id}
                            className={`bg-zinc-900/30 rounded-xl border transition-all duration-200 ${isLow
                                ? 'border-red-500/15 hover:border-red-500/25'
                                : 'border-white/5 hover:border-white/10'
                                } ${isExpanded ? 'ring-1 ring-white/5' : ''}`}
                        >
                            <div
                                className="flex items-center justify-between px-5 py-4 cursor-pointer"
                                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            >
                                <div className="flex items-center gap-3.5 min-w-0">
                                    {isLow ? (
                                        <Warning weight="duotone" className="text-xl text-red-400 shrink-0" />
                                    ) : (
                                        <CheckCircle weight="duotone" className="text-xl text-emerald-400 shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px] font-mono text-indigo-400 font-medium">{item.id}</span>
                                            {item.failureType && <FailureTypeBadge type={item.failureType} t={t} />}
                                        </div>
                                        <p className="text-[13.5px] text-zinc-300 mt-0.5 truncate">{item.query}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div className="text-right">
                                            <p className="text-[10.5px] text-zinc-600 leading-tight">{t('results.faithfulness_label')}</p>
                                            <ScoreBadge score={item.scores.faithfulness} />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10.5px] text-zinc-600 leading-tight">{t('results.relevance_label')}</p>
                                            <ScoreBadge score={item.scores.relevance} />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10.5px] text-zinc-600 leading-tight">{t('results.coherence_label')}</p>
                                            <ScoreBadge score={item.scores.coherence} max={5} />
                                        </div>
                                    </div>
                                    {isExpanded ? (
                                        <CaretUp weight="bold" className="text-sm text-zinc-600" />
                                    ) : (
                                        <CaretDown weight="bold" className="text-sm text-zinc-600" />
                                    )}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
                                    <div>
                                        <p className="text-[12px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                                            {t('results.reasoning')}
                                        </p>
                                        <p className="text-[13px] text-zinc-400 bg-zinc-900/50 rounded-lg p-3.5 border border-white/5 leading-relaxed">
                                            {item.reasoning}
                                        </p>
                                    </div>

                                    {isLow && (
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <GitDiff weight="duotone" className="text-base text-zinc-500" />
                                                <p className="text-[12px] font-semibold text-zinc-500 uppercase tracking-wide">
                                                    {t('results.diff_view')}
                                                </p>
                                            </div>
                                            <DiffView item={item} t={t} />
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4 text-[11.5px] text-zinc-600 font-mono">
                                            <span>prompt_tokens: {item.usage.prompt_tokens}</span>
                                            <span>completion_tokens: {item.usage.completion_tokens}</span>
                                        </div>

                                        {/* Debug in Playground button — shown for low-score items */}
                                        {isLow && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDebugInPlayground(item);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-[12px] font-medium text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-colors"
                                            >
                                                <Bug weight="duotone" className="text-sm" />
                                                {t('results.debug_in_playground')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
