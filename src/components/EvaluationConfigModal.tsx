import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    X,
    Lightning,
} from '@phosphor-icons/react';
import {
    AVAILABLE_MODELS,
    AVAILABLE_METRICS,
    DEFAULT_SYSTEM_PROMPT,
} from '../data/mockData';
import Select from './ui/Select';
import { createRun } from '../services/api';

function HighlightedPrompt({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleScroll = () => {
        if (overlayRef.current && textareaRef.current) {
            overlayRef.current.scrollTop = textareaRef.current.scrollTop;
            overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };

    const renderHighlighted = (text: string) => {
        const parts = text.split(/({{.*?}})/g);
        return parts.map((part, i) =>
            part.startsWith('{{') && part.endsWith('}}') ? (
                <span key={i} className="bg-indigo-500/15 text-indigo-300 rounded px-0.5 border border-indigo-500/20">
                    {part}
                </span>
            ) : (
                <span key={i}>{part}</span>
            )
        );
    };

    return (
        <div className="relative">
            <div
                ref={overlayRef}
                className="absolute inset-0 px-3.5 py-3 text-[13px] font-mono leading-relaxed whitespace-pre-wrap pointer-events-none overflow-hidden text-zinc-300 border border-transparent"
                aria-hidden
            >
                {renderHighlighted(value)}
            </div>
            <textarea
                ref={textareaRef}
                onScroll={handleScroll}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={14}
                className="relative z-10 w-full px-3.5 py-3 text-[13px] font-mono leading-relaxed border border-white/10 rounded-lg bg-transparent text-transparent caret-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 resize-none selection:bg-indigo-500/30 overflow-auto"
                spellCheck={false}
            />
        </div>
    );
}

interface Props {
    datasetId: string;
    onClose: () => void;
}

export default function EvaluationConfigModal({ datasetId, onClose }: Props) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
        'faithfulness',
        'relevance',
        'coherence',
    ]);
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleMetric = (id: string) => {
        setSelectedMetrics((prev) =>
            prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
        );
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            const run = await createRun({
                dataset_id: datasetId,
                model: selectedModel,
                metrics: selectedMetrics,
                system_prompt: systemPrompt,
            });

            // Navigate immediately to results page to show progress
            navigate(`/results?runId=${run.id}`);
        } catch (err) {
            console.error('Failed to start evaluation:', err);
            setError(String(err));
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-zinc-900 rounded-2xl shadow-2xl w-[640px] max-h-[90vh] overflow-y-auto border border-zinc-700/50 ring-1 ring-white/10">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-white/5 to-white/0 border border-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]">
                            <Lightning weight="duotone" className="text-lg text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-semibold text-zinc-100">{t('modal.title')}</h3>
                            <p className="text-[12px] text-zinc-500">{t('modal.subtitle')}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        <X weight="bold" className="text-lg" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-6">
                    {/* Model selector */}
                    <div>
                        <label className="block text-[13px] font-semibold text-zinc-300 mb-2">
                            {t('modal.model_label')}
                        </label>
                        <Select
                            value={selectedModel}
                            onChange={setSelectedModel}
                            options={AVAILABLE_MODELS.map((m) => ({
                                value: m.id,
                                label: `${m.name} (${m.provider})`,
                            }))}
                        />
                    </div>

                    {/* Metrics checkboxes */}
                    <div>
                        <label className="block text-[13px] font-semibold text-zinc-300 mb-2.5">
                            {t('modal.metrics_label')}
                        </label>
                        <div className="space-y-2">
                            {AVAILABLE_METRICS.map((metric) => (
                                <label
                                    key={metric.id}
                                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedMetrics.includes(metric.id)
                                        ? 'border-indigo-500/30 bg-indigo-500/5'
                                        : 'border-white/5 bg-zinc-950/30 hover:border-white/10'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedMetrics.includes(metric.id)}
                                        onChange={() => toggleMetric(metric.id)}
                                        className="mt-0.5 rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500/20"
                                    />
                                    <div>
                                        <p className="text-[13px] font-medium text-zinc-200">{t(`metrics.${metric.id}.label`)}</p>
                                        <p className="text-[12px] text-zinc-500 mt-0.5">
                                            {t(`metrics.${metric.id}.desc`)} (Scale: <span className="font-mono">{metric.scale}</span>)
                                        </p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* System Prompt */}
                    <div>
                        <label className="block text-[13px] font-semibold text-zinc-300 mb-2">
                            {t('modal.prompt_label')}
                            <span className="ml-2 text-[11px] font-normal text-zinc-600">
                                {t('modal.prompt_hint')}
                            </span>
                        </label>
                        <HighlightedPrompt value={systemPrompt} onChange={setSystemPrompt} />
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="bg-red-500/5 border border-red-500/15 rounded-lg px-4 py-3">
                            <p className="text-[12px] text-red-400">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-[13px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] rounded-lg transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || selectedMetrics.length === 0}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-[13px] font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t('modal.submitting')}
                            </>
                        ) : (
                            <>
                                <Lightning weight="duotone" className="text-base" />
                                {t('modal.submit')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
