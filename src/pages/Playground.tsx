import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Play,
    CircleNotch,
    Terminal,
    TestTube,
    Lightning,
    Code,
} from '@phosphor-icons/react';
import Select from '../components/ui/Select';
import { DEFAULT_SYSTEM_PROMPT } from '../data/mockData';
import { playgroundEvaluate, type PlaygroundResult } from '../services/api';

/* ── Prompt Templates ────────────────────────────── */
const TEMPLATES = {
    faithfulness: `You are an impartial AI judge. Evaluate the faithfulness of the Response against the given Context.

Steps:
1. Extract core facts from {{context}}.
2. Compare each claim in {{response}} against the facts.
3. Flag contradictions as "hallucination".
4. Output a JSON with "score" (0-1) and "reasoning".

Score Guide:
- 1.0 = Fully faithful
- 0.5 = Partially faithful
- 0.0 = Completely fabricated`,
    relevance: `You are an impartial AI judge. Evaluate how relevant the Response is to the User Query.

Steps:
1. Understand the intent of {{query}}.
2. Assess whether {{response}} directly addresses the question.
3. Penalize tangential or off-topic content.
4. Output a JSON with "score" (0-1) and "reasoning".

Score Guide:
- 1.0 = Perfectly relevant
- 0.5 = Partially relevant
- 0.0 = Completely irrelevant`,
    custom: DEFAULT_SYSTEM_PROMPT,
};

/* ── Component ───────────────────────────────────── */
type RunState = 'idle' | 'loading' | 'success' | 'error';

export default function Playground() {
    const { t } = useTranslation();
    const location = useLocation();

    /* Column 1: System Prompt */
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [selectedTemplate, setSelectedTemplate] = useState('custom');

    /* Column 2: Test Case */
    const [query, setQuery] = useState('');
    const [context, setContext] = useState('');
    const [response, setResponse] = useState('');

    /* Column 3: Result */
    const [runState, setRunState] = useState<RunState>('idle');
    const [result, setResult] = useState<PlaygroundResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    /* Pre-fill from navigation state (Results.tsx "Debug in Playground") */
    useEffect(() => {
        const state = location.state as {
            query?: string;
            context?: string;
            response?: string;
        } | null;
        if (state) {
            if (state.query) setQuery(state.query);
            if (state.context) setContext(state.context);
            if (state.response) setResponse(state.response);
        }
    }, [location.state]);

    const handleTemplateChange = (key: string) => {
        setSelectedTemplate(key);
        setSystemPrompt(TEMPLATES[key as keyof typeof TEMPLATES] || DEFAULT_SYSTEM_PROMPT);
    };

    const handleRun = async () => {
        setRunState('loading');
        setResult(null);
        setError(null);
        try {
            const res = await playgroundEvaluate({
                system_prompt: systemPrompt,
                query,
                context,
                response,
                model: 'gpt-4',
                metric: selectedTemplate === 'custom' ? 'faithfulness' : selectedTemplate,
            });
            setResult(res);
            setRunState('success');
        } catch (err) {
            console.error('Playground evaluation failed:', err);
            setError(String(err));
            setRunState('error');
        }
    };

    const canRun = query.trim() && context.trim() && response.trim();

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
        <div className="h-[calc(100vh-3.5rem)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-zinc-100 tracking-tight">{t('playground.title')}</h2>
                    <p className="text-[12.5px] text-zinc-500 mt-0.5">{t('playground.subtitle')}</p>
                </div>
            </div>

            {/* 3-Column Layout */}
            <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden p-6 pt-2">

                {/* Column 1: System Prompt */}
                <div className="flex flex-col overflow-hidden bg-zinc-900/50 border border-zinc-700/50 ring-1 ring-white/5 shadow-sm rounded-xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/50 shrink-0 bg-white/[0.02]">
                        <div className="flex items-center gap-2">
                            <Terminal weight="duotone" className="text-base text-indigo-400" />
                            <h3 className="text-[13px] font-semibold text-zinc-200">{t('playground.system_prompt')}</h3>
                        </div>
                        {/* Template Dropdown */}
                        <Select
                            size="sm"
                            value={selectedTemplate}
                            onChange={handleTemplateChange}
                            options={[
                                { value: 'custom', label: t('playground.template_custom') },
                                { value: 'faithfulness', label: t('playground.template_faithfulness') },
                                { value: 'relevance', label: t('playground.template_relevance') },
                            ]}
                            className="w-[130px]"
                        />
                    </div>
                    <div className="flex-1 relative overflow-hidden">
                        {/* Highlight overlay */}
                        <div
                            className="absolute inset-0 px-4 py-3 text-[12.5px] font-mono leading-relaxed whitespace-pre-wrap pointer-events-none overflow-hidden text-zinc-300 border border-transparent"
                            aria-hidden
                        >
                            {renderHighlighted(systemPrompt)}
                        </div>
                        <textarea
                            value={systemPrompt}
                            onChange={(e) => {
                                setSystemPrompt(e.target.value);
                                setSelectedTemplate('custom');
                            }}
                            className="w-full h-full px-4 py-3 text-[12.5px] font-mono leading-relaxed bg-transparent text-transparent border-none focus:outline-none resize-none caret-zinc-100 selection:bg-indigo-500/30 overflow-auto"
                            spellCheck={false}
                        />
                    </div>
                </div>

                {/* Column 2: Test Case */}
                <div className="flex flex-col overflow-hidden bg-zinc-900/50 border border-zinc-700/50 ring-1 ring-white/5 shadow-sm rounded-xl">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-700/50 shrink-0 bg-white/[0.02]">
                        <TestTube weight="duotone" className="text-base text-emerald-400" />
                        <h3 className="text-[13px] font-semibold text-zinc-200">{t('playground.test_case')}</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                        {/* Query */}
                        <div>
                            <label className="block text-[11.5px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                                {t('playground.user_query')}
                            </label>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t('playground.query_placeholder')}
                                className="w-full px-3.5 py-2.5 text-[13px] border border-zinc-700 rounded-lg bg-zinc-950/50 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                            />
                        </div>

                        {/* Context */}
                        <div className="flex-1 flex flex-col">
                            <label className="block text-[11.5px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                                {t('playground.retrieved_context')}
                            </label>
                            <textarea
                                value={context}
                                onChange={(e) => setContext(e.target.value)}
                                placeholder={t('playground.context_placeholder')}
                                rows={6}
                                className="w-full px-3.5 py-2.5 text-[12.5px] font-mono border border-zinc-700 rounded-lg bg-zinc-950/50 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none leading-relaxed transition-all shadow-sm"
                            />
                        </div>

                        {/* Response */}
                        <div className="flex-1 flex flex-col">
                            <label className="block text-[11.5px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                                {t('playground.model_response')}
                            </label>
                            <textarea
                                value={response}
                                onChange={(e) => setResponse(e.target.value)}
                                placeholder={t('playground.response_placeholder')}
                                rows={6}
                                className="w-full px-3.5 py-2.5 text-[12.5px] font-mono border border-zinc-700 rounded-lg bg-zinc-950/50 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none leading-relaxed transition-all shadow-sm"
                            />
                        </div>

                        {/* Run Button */}
                        <button
                            onClick={handleRun}
                            disabled={!canRun || runState === 'loading'}
                            className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 bg-indigo-600 text-white rounded-xl text-[14px] font-semibold hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
                        >
                            {runState === 'loading' ? (
                                <>
                                    <CircleNotch weight="bold" className="text-lg animate-spin" />
                                    {t('playground.running')}
                                </>
                            ) : (
                                <>
                                    <Play weight="fill" className="text-lg" />
                                    {t('playground.run_eval')}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Column 3: Verdict / Result */}
                <div className="flex flex-col overflow-hidden bg-zinc-900/50 border border-zinc-700/50 ring-1 ring-white/5 shadow-sm rounded-xl">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-700/50 shrink-0 bg-white/[0.02]">
                        <Lightning weight="duotone" className="text-base text-amber-400" />
                        <h3 className="text-[13px] font-semibold text-zinc-200">{t('playground.opus_result')}</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {runState === 'idle' && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-zinc-900/50 border border-white/5 mb-4">
                                    <Code weight="duotone" className="text-2xl text-zinc-600" />
                                </div>
                                <p className="text-[13px] text-zinc-600">{t('playground.idle_hint')}</p>
                            </div>
                        )}

                        {runState === 'loading' && (
                            <div className="space-y-4">
                                {/* Skeleton */}
                                <div className="bg-zinc-900/30 rounded-xl border border-white/5 p-5">
                                    <div className="h-3 w-20 bg-zinc-800 rounded animate-pulse mb-3" />
                                    <div className="h-8 w-24 bg-zinc-800 rounded animate-pulse mb-4" />
                                    <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse mb-2" />
                                    <div className="space-y-2">
                                        <div className="h-3 w-full bg-zinc-800 rounded animate-pulse" />
                                        <div className="h-3 w-4/5 bg-zinc-800 rounded animate-pulse" />
                                        <div className="h-3 w-3/5 bg-zinc-800 rounded animate-pulse" />
                                    </div>
                                </div>
                                <div className="bg-zinc-900/30 rounded-xl border border-white/5 p-5">
                                    <div className="h-3 w-24 bg-zinc-800 rounded animate-pulse mb-3" />
                                    <div className="space-y-2">
                                        <div className="h-3 w-full bg-zinc-800 rounded animate-pulse" />
                                        <div className="h-3 w-2/3 bg-zinc-800 rounded animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {runState === 'error' && (
                            <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-5">
                                <p className="text-[13px] font-semibold text-red-300 mb-1">{t('playground.eval_failed')}</p>
                                <p className="text-[12px] text-red-400/70">{error}</p>
                            </div>
                        )}

                        {runState === 'success' && result && (
                            <div className="space-y-4">
                                {/* Score Card */}
                                <div className="bg-zinc-900/30 rounded-xl border border-white/5 p-5">
                                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                                        {t('playground.score_label')}
                                    </p>
                                    <div className="flex items-end gap-3 mb-4">
                                        <span
                                            className={`text-4xl font-bold font-mono ${result.score >= 0.8
                                                ? 'text-emerald-400'
                                                : result.score >= 0.5
                                                    ? 'text-amber-400'
                                                    : 'text-red-400'
                                                }`}
                                        >
                                            {result.score.toFixed(2)}
                                        </span>
                                        <span className="text-[13px] text-zinc-600 pb-1">/ 1.00</span>
                                    </div>
                                    {/* Score Bar */}
                                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ease-out ${result.score >= 0.8
                                                ? 'bg-emerald-500'
                                                : result.score >= 0.5
                                                    ? 'bg-amber-500'
                                                    : 'bg-red-500'
                                                }`}
                                            style={{ width: `${result.score * 100}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Reasoning Card */}
                                <div className="bg-zinc-900/30 rounded-xl border border-white/5 p-5">
                                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                                        {t('playground.reasoning_label')}
                                    </p>
                                    <p className="text-[13px] text-zinc-300 leading-relaxed">
                                        {result.reasoning}
                                    </p>
                                </div>

                                {/* Raw JSON Output */}
                                <div className="bg-zinc-900/30 rounded-xl border border-white/5 p-5">
                                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                                        {t('playground.raw_output')}
                                    </p>
                                    <pre className="text-[12px] font-mono text-zinc-400 bg-zinc-950/50 rounded-lg p-3.5 border border-white/5 overflow-x-auto leading-relaxed">
                                        <code>
                                            {JSON.stringify(
                                                {
                                                    score: result.score,
                                                    reasoning: result.reasoning,
                                                    model: result.model,
                                                    latency_ms: result.latency_ms,
                                                    usage: result.tokens,
                                                },
                                                null,
                                                2
                                            )}
                                        </code>
                                    </pre>
                                </div>

                                {/* Meta Info */}
                                <div className="flex items-center gap-4 text-[11px] text-zinc-600 font-mono px-1">
                                    <span>model: {result.model}</span>
                                    <span>latency: {result.latency_ms}ms</span>
                                    <span>tokens: {result.tokens.prompt + result.tokens.completion}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
