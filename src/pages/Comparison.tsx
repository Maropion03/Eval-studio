import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Scales,
    CircleNotch,
    ArrowRight,
    Warning,
    CheckCircle,
    ShieldCheck,
    Target,
    Brain,
} from '@phosphor-icons/react';
import type { EvaluationItem, EvaluationRun } from '../data/mockData';
import { compareRuns } from '../services/api';

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

function DeltaBadge({ delta }: { delta: number }) {
    const isPositive = delta > 0;
    const isNeutral = delta === 0;

    return (
        <span
            className={`text-[11px] font-mono font-semibold ${isNeutral
                ? 'text-zinc-500'
                : isPositive
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}
        >
            {isPositive ? '+' : ''}{delta.toFixed(2)}
        </span>
    );
}

export default function Comparison() {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const baseId = searchParams.get('baseId');
    const targetId = searchParams.get('targetId');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [baseRun, setBaseRun] = useState<EvaluationRun | null>(null);
    const [targetRun, setTargetRun] = useState<EvaluationRun | null>(null);
    const [baseItems, setBaseItems] = useState<EvaluationItem[]>([]);
    const [targetItems, setTargetItems] = useState<EvaluationItem[]>([]);

    useEffect(() => {
        async function load() {
            if (!baseId || !targetId) {
                setLoading(false);
                return;
            }
            try {
                const data = await compareRuns(baseId, targetId);
                setBaseRun(data.baseRun);
                setTargetRun(data.targetRun);
                setBaseItems(data.baseItems);
                setTargetItems(data.targetItems);
            } catch (err) {
                console.error('Failed to load comparison:', err);
                setError(String(err));
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [baseId, targetId]);

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto flex items-center justify-center py-20">
                <CircleNotch weight="bold" className="text-3xl text-indigo-400 animate-spin" />
            </div>
        );
    }

    if (!baseId || !targetId) {
        return (
            <div className="max-w-6xl mx-auto flex flex-col items-center justify-center py-20 text-zinc-600">
                <Scales weight="duotone" className="text-4xl mb-3" />
                <p className="text-lg font-medium">{t('compare.no_runs') || 'No runs selected for comparison'}</p>
                <p className="text-sm mt-1">{t('compare.select_hint') || 'Select two completed runs from the Dashboard.'}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-6xl mx-auto py-10">
                <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-5">
                    <p className="text-[13px] font-semibold text-red-300">Comparison Failed</p>
                    <p className="text-[12px] text-red-400/70 mt-1">{error}</p>
                </div>
            </div>
        );
    }

    if (!baseRun || !targetRun) return null;

    // Calculate aggregate deltas
    const baseAvg = baseRun.averageScores ?? { faithfulness: 0, relevance: 0, coherence: 0 };
    const targetAvg = targetRun.averageScores ?? { faithfulness: 0, relevance: 0, coherence: 0 };

    const metricConfigs = [
        { key: 'faithfulness', label: t('compare.faithfulness') || 'Faithfulness', icon: ShieldCheck, accent: 'text-purple-400', max: 1 },
        { key: 'relevance', label: t('compare.relevance') || 'Relevance', icon: Target, accent: 'text-blue-400', max: 1 },
        { key: 'coherence', label: t('compare.coherence') || 'Coherence', icon: Brain, accent: 'text-teal-400', max: 5 },
    ] as const;

    // Match items by their original evaluation id (position-based)
    const pairedItems = baseItems.map((baseItem, idx) => ({
        base: baseItem,
        target: targetItems[idx] ?? null,
    }));

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">{t('compare.title') || 'A/B Comparison'}</h2>
                <p className="text-sm text-zinc-500 mt-1">
                    {t('compare.subtitle') || 'Side-by-side comparison of two evaluation runs'}
                </p>
            </div>

            {/* Run labels */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900/30 rounded-xl border border-indigo-500/20 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-indigo-400" />
                        <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">{t('compare.base') || 'Base (A)'}</span>
                    </div>
                    <p className="text-[14px] font-medium text-zinc-200">{baseRun.datasetName}</p>
                    <p className="text-[12px] text-zinc-500">{baseRun.model} · {baseRun.totalItems} items</p>
                </div>
                <div className="bg-zinc-900/30 rounded-xl border border-emerald-500/20 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">{t('compare.target') || 'Target (B)'}</span>
                    </div>
                    <p className="text-[14px] font-medium text-zinc-200">{targetRun.datasetName}</p>
                    <p className="text-[12px] text-zinc-500">{targetRun.model} · {targetRun.totalItems} items</p>
                </div>
            </div>

            {/* Aggregate Score Comparison */}
            <div className="grid grid-cols-3 gap-4">
                {metricConfigs.map((mc) => {
                    const bScore = baseAvg[mc.key];
                    const tScore = targetAvg[mc.key];
                    const delta = tScore - bScore;
                    return (
                        <div key={mc.key} className="bg-zinc-900/30 rounded-xl border border-white/5 p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <mc.icon weight="duotone" className={`text-lg ${mc.accent}`} />
                                <span className="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider">{mc.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-center flex-1">
                                    <p className="text-[10px] text-indigo-400 font-semibold uppercase mb-1">A</p>
                                    <ScoreBadge score={bScore} max={mc.max} />
                                </div>
                                <ArrowRight weight="bold" className="text-zinc-600 shrink-0" />
                                <div className="text-center flex-1">
                                    <p className="text-[10px] text-emerald-400 font-semibold uppercase mb-1">B</p>
                                    <ScoreBadge score={tScore} max={mc.max} />
                                </div>
                                <div className="text-center flex-1">
                                    <p className="text-[10px] text-zinc-600 font-semibold uppercase mb-1">Δ</p>
                                    <DeltaBadge delta={delta} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Per-item comparison table */}
            <div className="bg-zinc-900/30 rounded-xl border border-white/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                    <h3 className="text-[15px] font-semibold text-zinc-200">{t('compare.per_item') || 'Per-Item Results'}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left px-4 py-3 text-[11.5px] font-semibold text-zinc-500 uppercase tracking-wider">Query</th>
                                <th className="text-center px-4 py-3 text-[11.5px] font-semibold text-indigo-400 uppercase tracking-wider">A Score</th>
                                <th className="text-center px-4 py-3 text-[11.5px] font-semibold text-emerald-400 uppercase tracking-wider">B Score</th>
                                <th className="text-center px-4 py-3 text-[11.5px] font-semibold text-zinc-500 uppercase tracking-wider">Δ</th>
                                <th className="text-center px-4 py-3 text-[11.5px] font-semibold text-zinc-500 uppercase tracking-wider">{t('compare.winner') || 'Winner'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pairedItems.map((pair, idx) => {
                                const bAvg = (pair.base.scores.faithfulness + pair.base.scores.relevance) / 2;
                                const tAvg = pair.target ? (pair.target.scores.faithfulness + pair.target.scores.relevance) / 2 : 0;
                                const delta = tAvg - bAvg;
                                const winner = delta > 0.02 ? 'B' : delta < -0.02 ? 'A' : 'Tie';

                                return (
                                    <tr
                                        key={idx}
                                        className={`hover:bg-white/[0.02] transition-colors ${idx < pairedItems.length - 1 ? 'border-b border-white/5' : ''}`}
                                    >
                                        <td className="px-4 py-3 text-[13px] text-zinc-300 max-w-[300px] truncate">
                                            {pair.base.query}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <ScoreBadge score={bAvg} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {pair.target ? <ScoreBadge score={tAvg} /> : <span className="text-zinc-600">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <DeltaBadge delta={delta} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {winner === 'A' && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400">
                                                    <CheckCircle weight="fill" className="text-sm" /> A
                                                </span>
                                            )}
                                            {winner === 'B' && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                                                    <CheckCircle weight="fill" className="text-sm" /> B
                                                </span>
                                            )}
                                            {winner === 'Tie' && (
                                                <span className="text-[11px] font-semibold text-zinc-500">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
