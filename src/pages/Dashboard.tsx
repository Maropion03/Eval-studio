import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    HourglassHigh,
    ShieldCheck,
    Target,
    HardDrives,
    ArrowRight,
    CheckCircle,
    CircleNotch,
    Scales,
} from '@phosphor-icons/react';
import type { EvaluationRun, Dataset } from '../data/mockData';
import { listRuns, listDatasets } from '../services/api';

export default function Dashboard() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [selectedRuns, setSelectedRuns] = useState<string[]>([]);

    const [runs, setRuns] = useState<EvaluationRun[]>([]);
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [r, d] = await Promise.all([listRuns(), listDatasets()]);
                setRuns(r);
                setDatasets(d);
            } catch (err) {
                console.error('Failed to load dashboard data:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const completedRuns = runs.filter((r) => r.status === 'completed');
    const totalEvaluations = completedRuns.reduce((s, r) => s + r.totalItems, 0);
    const timeSavedMinutes = totalEvaluations * 10;
    const timeSavedDisplay =
        timeSavedMinutes >= 60
            ? t('dashboard.hours', { value: (timeSavedMinutes / 60).toFixed(1) })
            : t('dashboard.minutes', { value: timeSavedMinutes });

    const avgScores = useMemo(() => {
        const scored = completedRuns.filter((r) => r.averageScores);
        if (scored.length === 0) return { faithfulness: '0.00', relevance: '0.00', coherence: '0.0' };
        return {
            faithfulness: (scored.reduce((s, r) => s + (r.averageScores?.faithfulness ?? 0), 0) / scored.length).toFixed(2),
            relevance: (scored.reduce((s, r) => s + (r.averageScores?.relevance ?? 0), 0) / scored.length).toFixed(2),
            coherence: (scored.reduce((s, r) => s + (r.averageScores?.coherence ?? 0), 0) / scored.length).toFixed(1),
        };
    }, [completedRuns]);

    const statCards = [
        {
            title: t('dashboard.time_saved'),
            value: timeSavedDisplay,
            subtitle: t('dashboard.evaluations_formula', { count: totalEvaluations }),
            icon: HourglassHigh,
            accent: 'text-emerald-400',
        },
        {
            title: t('dashboard.avg_faithfulness'),
            value: avgScores.faithfulness,
            subtitle: t('dashboard.faithfulness_scale'),
            icon: ShieldCheck,
            accent: 'text-purple-400',
        },
        {
            title: t('dashboard.avg_relevance'),
            value: avgScores.relevance,
            subtitle: t('dashboard.relevance_scale'),
            icon: Target,
            accent: 'text-blue-400',
        },
        {
            title: t('dashboard.dataset_count'),
            value: datasets.length,
            subtitle: t('dashboard.data_count', { count: datasets.reduce((s, d) => s + d.itemCount, 0) }),
            icon: HardDrives,
            accent: 'text-orange-400',
        },
    ];

    const toggleRun = (id: string) => {
        setSelectedRuns((prev) =>
            prev.includes(id) ? prev.filter((r) => r !== id) : prev.length < 2 ? [...prev, id] : prev
        );
    };

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto flex items-center justify-center py-20">
                <CircleNotch weight="bold" className="text-3xl text-indigo-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">{t('dashboard.title')}</h2>
                <p className="text-sm text-zinc-500 mt-1">{t('dashboard.subtitle')}</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card) => (
                    <div
                        key={card.title}
                        className="relative overflow-hidden bg-zinc-900/50 rounded-xl border border-zinc-700/50 ring-1 ring-white/5 p-5 hover:border-zinc-600 transition-colors group shadow-sm"
                    >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-white/5 to-white/0 border border-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] mb-3">
                            <card.icon weight="duotone" className={`text-2xl ${card.accent}`} />
                        </div>
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{card.title}</p>
                        <p className="text-2xl font-semibold text-zinc-100 mt-0.5 font-mono">{card.value}</p>
                        <p className="text-[12px] text-zinc-600 mt-0.5">{card.subtitle}</p>
                    </div>
                ))}
            </div>

            {/* Recent Runs */}
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-700/50 ring-1 ring-white/5 shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <h3 className="text-[15px] font-semibold text-zinc-200">{t('dashboard.recent_runs')}</h3>
                    <button
                        onClick={() => navigate('/datasets')}
                        className="text-[13px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
                    >
                        {t('common.view_all')} <ArrowRight weight="bold" className="text-sm" />
                    </button>
                </div>
                <div>
                    {runs.length === 0 && (
                        <div className="px-5 py-8 text-center text-sm text-zinc-600">
                            {t('dashboard.no_runs')}
                        </div>
                    )}
                    {runs.map((run, idx) => {
                        const isSelected = selectedRuns.includes(run.id);
                        const isCompleted = run.status === 'completed';
                        return (
                            <div
                                key={run.id}
                                className={`flex items-center justify-between px-5 py-3.5 transition-colors ${isSelected ? 'bg-indigo-500/[0.06]' : 'hover:bg-white/[0.02]'
                                    } ${idx < runs.length - 1 ? 'border-b border-white/10' : ''}`}
                            >
                                {/* Checkbox */}
                                <div className="flex items-center gap-3.5">
                                    {isCompleted ? (
                                        <label
                                            className="flex items-center cursor-pointer"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleRun(run.id)}
                                                disabled={!isSelected && selectedRuns.length >= 2}
                                                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500/20 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                            />
                                        </label>
                                    ) : (
                                        <div className="w-4" />
                                    )}

                                    {run.status === 'completed' ? (
                                        <CheckCircle weight="duotone" className="text-xl text-emerald-400" />
                                    ) : (
                                        <CircleNotch weight="duotone" className="text-xl text-blue-400 animate-spin" />
                                    )}
                                    <div
                                        className={isCompleted ? 'cursor-pointer' : ''}
                                        onClick={() => isCompleted && navigate(`/results?runId=${run.id}`)}
                                    >
                                        <p className="text-[13.5px] font-medium text-zinc-200">{run.datasetName}</p>
                                        <p className="text-[12px] text-zinc-500">
                                            {t('dashboard.model_info', {
                                                model: run.model,
                                                metrics: run.metrics.join(', '),
                                                count: run.totalItems,
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span
                                        className={`inline-flex items-center text-[11.5px] font-medium px-2.5 py-1 rounded-full border ${run.status === 'completed'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse'
                                            }`}
                                    >
                                        {run.status === 'completed' ? t('status.completed') : t('status.running')}
                                    </span>
                                    <p className="text-[11px] text-zinc-600 mt-0.5">
                                        {new Date(run.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Floating Action Bar */}
            {selectedRuns.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-6 py-3.5 bg-zinc-900/95 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl shadow-black/40">
                    <span className="text-[13px] text-zinc-300 font-medium">
                        {t('dashboard.runs_selected', { count: selectedRuns.length })}
                    </span>
                    <button
                        onClick={() => {
                            if (selectedRuns.length === 2) {
                                navigate(`/compare?baseId=${selectedRuns[0]}&targetId=${selectedRuns[1]}`);
                            }
                        }}
                        disabled={selectedRuns.length !== 2}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[13px] font-medium hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        <Scales weight="duotone" className="text-base" />
                        {t('dashboard.compare_runs')}
                    </button>
                    <button
                        onClick={() => setSelectedRuns([])}
                        className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                </div>
            )}
        </div>
    );
}
