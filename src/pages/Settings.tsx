import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Gear,
    FloppyDisk,
    CircleNotch,
    CheckCircle,
} from '@phosphor-icons/react';
import { DEFAULT_SYSTEM_PROMPT } from '../data/mockData';
import { getSettings, updateSettings } from '../services/api';
import Select, { type SelectOption } from '../components/ui/Select';

const PROVIDER_OPTIONS: SelectOption[] = [
    { label: 'Silicon Cloud', value: 'siliconflow' },
    { label: 'DeepSeek', value: 'deepseek' },
    { label: 'Moonshot', value: 'moonshot' },
    { label: 'OpenAI', value: 'openai' },
    { label: 'Custom', value: 'custom' },
];

const DEFAULT_BASE_URLS: Record<string, string> = {
    siliconflow: 'https://api.siliconflow.cn/v1',
    deepseek: 'https://api.deepseek.com',
    moonshot: 'https://api.moonshot.cn/v1',
    openai: 'https://api.openai.com/v1',
};

export default function Settings() {
    const { t } = useTranslation();
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [threshold, setThreshold] = useState(0.7);

    // LLM Config State
    const [provider, setProvider] = useState('siliconflow');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('');
    const [baseUrl, setBaseUrl] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                // Load backend settings
                const settings = await getSettings();
                if (settings.system_prompt) setSystemPrompt(settings.system_prompt);
                setThreshold(settings.low_score_threshold);

                // Load local LLM settings
                const localProvider = localStorage.getItem('llm_provider') || 'siliconflow';
                const localKey = localStorage.getItem('llm_api_key') || ''; // Migrated from sf_api_key if needed? 
                const localModel = localStorage.getItem('llm_model') || 'Pro/zai-org/GLM-5';
                const localBaseUrl = localStorage.getItem('llm_base_url') || DEFAULT_BASE_URLS['siliconflow'];

                // Migration check (old sf_ keys)
                const oldKey = localStorage.getItem('sf_api_key');
                const oldModel = localStorage.getItem('sf_model');

                if (!localKey && oldKey) {
                    setProvider('siliconflow');
                    setApiKey(oldKey);
                    setModel(oldModel || 'Pro/zai-org/GLM-5');
                    setBaseUrl(DEFAULT_BASE_URLS['siliconflow']);
                } else {
                    setProvider(localProvider);
                    setApiKey(localKey);
                    setModel(localModel);
                    setBaseUrl(localBaseUrl);
                }

            } catch (err) {
                console.error('Failed to load settings:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleProviderChange = (val: string) => {
        setProvider(val);
        if (val !== 'custom' && DEFAULT_BASE_URLS[val]) {
            setBaseUrl(DEFAULT_BASE_URLS[val]);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            // Save backend settings
            await updateSettings({
                system_prompt: systemPrompt,
                low_score_threshold: threshold,
            });

            // Save local LLM settings
            localStorage.setItem('llm_provider', provider);
            localStorage.setItem('llm_api_key', apiKey);
            localStorage.setItem('llm_model', model);
            localStorage.setItem('llm_base_url', baseUrl);

            // Clear old keys to avoid confusion
            localStorage.removeItem('sf_api_key');
            localStorage.removeItem('sf_model');

            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Failed to save settings:', err);
            alert(`Failed to save: ${err}`);
        } finally {
            setSaving(false);
        }
    };

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

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
                <CircleNotch weight="bold" className="text-3xl text-indigo-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-900 border border-zinc-700/50 shadow-sm">
                        <Gear weight="duotone" className="text-xl text-zinc-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
                            {t('settings.title')}
                        </h2>
                        <p className="text-sm text-zinc-500 mt-0.5">
                            {t('settings.subtitle')}
                        </p>
                    </div>
                </div>
            </div>

            {/* System Prompt */}
            <div className="bg-zinc-900/40 rounded-xl border border-zinc-700/50 p-6 shadow-sm">
                <label className="block text-[13px] font-semibold text-zinc-300 mb-2">
                    {t('settings.prompt_label')}
                </label>
                <p className="text-[12px] text-zinc-500 mb-3">
                    {t('settings.prompt_desc')}
                </p>
                <div className="relative">
                    <div
                        ref={overlayRef}
                        className="absolute inset-0 px-3.5 py-3 text-[13px] font-mono leading-relaxed whitespace-pre-wrap pointer-events-none overflow-hidden text-zinc-300 border border-transparent rounded-lg"
                        aria-hidden
                    >
                        {renderHighlighted(systemPrompt)}
                    </div>
                    <textarea
                        ref={textareaRef}
                        onScroll={handleScroll}
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        rows={14}
                        className="relative z-10 w-full px-3.5 py-3 text-[13px] font-mono leading-relaxed border border-zinc-700/70 rounded-lg bg-zinc-950/50 text-transparent caret-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none selection:bg-indigo-500/30 overflow-auto shadow-sm"
                        spellCheck={false}
                    />
                </div>
            </div>

            {/* Threshold */}
            <div className="bg-zinc-900/40 rounded-xl border border-zinc-700/50 p-6 shadow-sm">
                <label className="block text-[13px] font-semibold text-zinc-300 mb-2">
                    {t('settings.threshold_label')}
                </label>
                <p className="text-[12px] text-zinc-500 mb-3">
                    {t('settings.threshold_desc')}
                </p>
                <div className="flex items-center gap-4">
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={threshold}
                        onChange={(e) => setThreshold(parseFloat(e.target.value))}
                        className="flex-1 accent-indigo-500"
                    />
                    <span className="text-lg font-mono font-semibold text-zinc-200 w-16 text-right">
                        {threshold.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* LLM Configuration */}
            <div className="bg-zinc-900/40 rounded-xl border border-zinc-700/50 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                        <CircleNotch weight="duotone" className="text-indigo-400 animate-spin-slow" />
                    </div>
                    <div>
                        <label className="block text-[13px] font-semibold text-zinc-300">
                            {t('settings.llm_config_title')}
                        </label>
                        <p className="text-[12px] text-zinc-500">
                            {t('settings.llm_config_desc')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Provider */}
                    <div className="space-y-2">
                        <label className="block text-[12px] font-medium text-zinc-400 uppercase tracking-wider">
                            {t('settings.provider_label')}
                        </label>
                        <Select
                            value={provider}
                            onChange={handleProviderChange}
                            options={PROVIDER_OPTIONS}
                        />
                    </div>

                    {/* Model Name */}
                    <div className="space-y-2">
                        <label className="block text-[12px] font-medium text-zinc-400 uppercase tracking-wider">
                            {t('settings.model_label')}
                        </label>
                        <input
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="e.g. gpt-4o, deepseek-chat"
                            className="w-full px-3 py-2.5 text-[13px] font-mono border border-zinc-700/70 rounded-lg bg-zinc-950/50 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                        />
                    </div>

                    {/* API Key */}
                    <div className="space-y-2 md:col-span-2">
                        <label className="block text-[12px] font-medium text-zinc-400 uppercase tracking-wider">
                            {t('settings.api_key_label')}
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full px-3 py-2.5 text-[13px] font-mono border border-zinc-700/70 rounded-lg bg-zinc-950/50 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                        />
                    </div>

                    {/* Base URL (only if Custom) */}
                    <div className="space-y-2 md:col-span-2">
                        <label className="block text-[12px] font-medium text-zinc-400 uppercase tracking-wider">
                            {t('settings.base_url_label')}
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                disabled={provider !== 'custom'}
                                className={`w-full px-3 py-2.5 text-[13px] font-mono border border-zinc-700/70 rounded-lg bg-zinc-950/50 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm ${provider !== 'custom' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                            {provider !== 'custom' && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500 bg-zinc-900/80 px-1.5 py-0.5 rounded">
                                    Auto-managed
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-[13px] font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-500/20"
                >
                    {saving ? (
                        <>
                            <CircleNotch weight="bold" className="text-base animate-spin" />
                            {t('common.saving')}
                        </>
                    ) : saved ? (
                        <>
                            <CheckCircle weight="fill" className="text-base text-emerald-400" />
                            {t('common.saved')}
                        </>
                    ) : (
                        <>
                            <FloppyDisk weight="duotone" className="text-base" />
                            {t('settings.save')}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
