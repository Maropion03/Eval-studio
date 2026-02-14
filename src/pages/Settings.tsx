import { useEffect, useState } from 'react'; // FIXED: Removed 'React'
import { useTranslation } from 'react-i18next';
import { FloppyDisk, ArrowCounterClockwise, Key, Robot, Faders } from '@phosphor-icons/react';
import { api } from '../services/api';
import Select from '../components/ui/Select';

// UPDATED: User's specific model list
const SILICON_MODELS = [
    { value: 'Pro/zai-org/GLM-4-9B-Chat', label: 'GLM-4-9B-Chat' },
    { value: 'Pro/deepseek-ai/DeepSeek-V3', label: 'DeepSeek-V3 (Pro)' },
    { value: 'Pro/deepseek-ai/DeepSeek-R1', label: 'DeepSeek-R1 (Pro)' },
    { value: 'Pro/Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5-72B (Pro)' },
    { value: 'Pro/Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5-7B (Pro)' }
];

const SILICON_BASE_URL = 'https://api.siliconflow.cn/v1';

export default function Settings() {
    const { t } = useTranslation();
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState(SILICON_MODELS[0].value);

    // Global Settings
    const [systemPrompt, setSystemPrompt] = useState('');
    const [lowScoreThreshold, setLowScoreThreshold] = useState(0.6);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        // Load LLM Local Settings
        setApiKey(localStorage.getItem('llm_api_key') || '');
        const savedModel = localStorage.getItem('llm_model');
        // Check if saved model is valid in new list, else default
        if (savedModel && SILICON_MODELS.some(m => m.value === savedModel)) {
            setModel(savedModel);
        } else {
            setModel(SILICON_MODELS[0].value);
        }

        // Load Global Settings
        try {
            const settings = await api.getSettings();
            setSystemPrompt(settings.system_prompt || '');
            setLowScoreThreshold(settings.low_score_threshold);
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            localStorage.setItem('llm_api_key', apiKey);
            localStorage.setItem('llm_model', model);
            localStorage.setItem('llm_base_url', SILICON_BASE_URL);

            await api.updateSettings({
                system_prompt: systemPrompt,
                low_score_threshold: lowScoreThreshold,
            });

            alert(t('settings.saved_success'));
        } catch (error) {
            console.error(error);
            alert(t('settings.saved_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
                    {t('settings.title')}
                </h1>
                <p className="text-zinc-400 mt-2">
                    {t('settings.subtitle')}
                </p>
            </div>

            {/* Section 1: SiliconFlow Configuration */}
            <section className="bg-zinc-900/30 border border-zinc-700/50 rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                        <Robot size={24} className="text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-200">
                            {t('settings.silicon_title')}
                        </h2>
                        <p className="text-sm text-zinc-500">
                            {t('settings.silicon_desc')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* API Key */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                            {t('settings.api_key_label')}
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 pl-10 text-zinc-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                            />
                            <Key size={16} className="absolute left-3 top-3 text-zinc-600" />
                        </div>
                    </div>

                    {/* Model Select */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                            {t('settings.model_label')}
                        </label>
                        <Select
                            value={model}
                            onChange={setModel}
                            options={SILICON_MODELS}
                        />
                    </div>
                </div>
            </section>

            {/* Section 2: Global Evaluation Settings */}
            <section className="bg-zinc-900/30 border border-zinc-700/50 rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <Faders size={24} className="text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-200">
                            {t('settings.global_title')}
                        </h2>
                        <p className="text-sm text-zinc-500">
                            {t('settings.global_desc')}
                        </p>
                    </div>
                </div>

                {/* Threshold */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        {t('settings.threshold_label')} ({lowScoreThreshold})
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={lowScoreThreshold}
                        onChange={(e) => setLowScoreThreshold(parseFloat(e.target.value))}
                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-xs text-zinc-500 font-mono">
                        <span>Strict (0.0)</span>
                        <span>Lenient (1.0)</span>
                    </div>
                </div>

                {/* System Prompt */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        {t('settings.prompt_label')}
                    </label>
                    <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="w-full h-32 bg-zinc-950 border border-zinc-700 rounded-lg p-4 text-zinc-300 focus:outline-none focus:border-indigo-500/50 transition-all font-mono text-sm resize-y"
                        placeholder="You are an expert judge..."
                    />
                </div>
            </section>

            {/* Actions */}
            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <ArrowCounterClockwise className="animate-spin" size={20} /> : <FloppyDisk size={20} />}
                    {t('settings.save_btn')}
                </button>
            </div>
        </div>
    );
}
