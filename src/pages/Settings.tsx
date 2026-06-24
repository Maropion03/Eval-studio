import { useEffect, useState } from 'react';
import { api, APIError, type SettingsOut } from '../services/api';

type ProviderKey = 'siliconflow' | 'deepseek' | 'openai';

interface Provider {
    key: ProviderKey;
    label: string;
    hint: string;
    placeholder: string;
    field: 'siliconflow_api_key' | 'deepseek_api_key' | 'openai_api_key';
    configuredField: 'siliconflow_configured' | 'deepseek_configured' | 'openai_configured';
}

const PROVIDERS: Provider[] = [
    {
        key: 'siliconflow',
        label: 'SILICONFLOW',
        hint: 'DeepSeek / Qwen / GLM · OpenAI-compatible · 硅基流动',
        placeholder: 'sk-···',
        field: 'siliconflow_api_key',
        configuredField: 'siliconflow_configured',
    },
    {
        key: 'deepseek',
        label: 'DEEPSEEK',
        hint: 'deepseek-chat · deepseek-reasoner · native endpoint',
        placeholder: 'sk-···',
        field: 'deepseek_api_key',
        configuredField: 'deepseek_configured',
    },
    {
        key: 'openai',
        label: 'OPENAI',
        hint: 'gpt-4o · gpt-4o-mini',
        placeholder: 'sk-···',
        field: 'openai_api_key',
        configuredField: 'openai_configured',
    },
];

export default function Settings() {
    const [settings, setSettings] = useState<SettingsOut | null>(null);
    const [drafts, setDrafts] = useState<Record<ProviderKey, string>>({
        siliconflow: '', deepseek: '', openai: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<string | null>(null);

    const load = () => {
        api.settings.get()
            .then(setSettings)
            .catch((e) => setError(e instanceof APIError ? `${e.status} — backend unreachable` : 'backend unreachable'));
    };
    useEffect(load, []);

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const body: Record<string, string | null> = {};
            for (const p of PROVIDERS) {
                const v = drafts[p.key].trim();
                if (v) body[p.field] = v;
            }
            const next = await api.settings.put(body);
            setSettings(next);
            setDrafts({ siliconflow: '', deepseek: '', openai: '' });
            setSavedAt(new Date().toLocaleTimeString('en-GB', { hour12: false }));
        } catch (e) {
            setError(e instanceof APIError ? `save failed (${e.status})` : 'save failed');
        } finally {
            setSaving(false);
        }
    };

    const clearKey = async (p: Provider) => {
        setSaving(true);
        setError(null);
        try {
            const next = await api.settings.put({ [p.field]: '' });
            setSettings(next);
            setSavedAt(new Date().toLocaleTimeString('en-GB', { hour12: false }));
        } catch {
            setError('clear failed');
        } finally {
            setSaving(false);
        }
    };

    const dirty = PROVIDERS.some((p) => drafts[p.key].trim().length > 0);

    return (
        <div className="max-w-[920px] mx-auto reveal-in">
            {/* Header */}
            <header className="mb-8">
                <div className="flex items-center gap-3 text-[10.5px] tracking-[0.28em] text-[var(--color-text-dim)]">
                    <span className="text-[var(--color-amber)]">▌</span>
                    MODULE&nbsp;04&nbsp;·&nbsp;CREDENTIALS
                </div>
                <h1 className="font-crt text-[64px] leading-[0.9] text-[var(--color-text-bright)] mt-2">
                    SETTINGS<span className="blink text-[var(--color-amber)] glow-amber">_</span>
                </h1>
                <p className="mt-3 text-[12px] tracking-[0.06em] text-[var(--color-text-muted)] max-w-[600px]">
                    BYOK — bring your own key. Keys are held server-side against your
                    anonymous session only, never shared, and used solely to run your
                    evaluations. Any OpenAI-compatible endpoint works.
                </p>
            </header>

            {/* Mock-mode banner */}
            {settings?.mock_llm && (
                <div className="mb-6 flex items-start gap-3 border border-[var(--color-mint)] bg-[var(--color-mint-trace)] px-4 py-3">
                    <span className="text-[var(--color-mint)] glow-mint text-[14px] leading-none mt-0.5">◉</span>
                    <div className="text-[11.5px] leading-[1.6] text-[var(--color-text)]">
                        <span className="font-data tracking-[0.18em] text-[var(--color-mint)]">MOCK&nbsp;MODE&nbsp;ACTIVE</span>
                        <span className="text-[var(--color-text-muted)]">
                            {' '}— this instance runs a deterministic offline model, so the full
                            pipeline works with no key. Set <span className="font-data text-[var(--color-amber)]">MOCK_LLM=0</span> on
                            the server and add a key below for live model calls.
                        </span>
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-6 border border-[var(--color-L2)] bg-[var(--color-L2-trace)] px-4 py-3 text-[11.5px] text-[var(--color-L2)] font-data tracking-[0.06em]">
                    ✗ {error}
                </div>
            )}

            <div className="tl-rule mb-5"><span>PROVIDERS</span></div>

            <div className="space-y-4">
                {PROVIDERS.map((p) => {
                    const configured = settings?.[p.configuredField] ?? false;
                    return (
                        <div key={p.key} className="tl-panel px-5 py-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <span className="font-data text-[13px] tracking-[0.16em] text-[var(--color-text-bright)]">
                                        {p.label}
                                    </span>
                                    {configured ? (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-[1px] text-[9.5px] tracking-[0.16em] font-data uppercase
                                                         text-[var(--color-mint)] border border-[var(--color-mint)] bg-[var(--color-mint-trace)]">
                                            <span className="glow-mint">●</span> CONFIGURED
                                        </span>
                                    ) : (
                                        <span className="px-2 py-[1px] text-[9.5px] tracking-[0.16em] font-data uppercase
                                                         text-[var(--color-text-dim)] border border-[var(--color-border)]">
                                            ◌ NOT SET
                                        </span>
                                    )}
                                </div>
                                {configured && (
                                    <button
                                        onClick={() => clearKey(p)}
                                        disabled={saving}
                                        className="text-[10px] tracking-[0.16em] font-data uppercase text-[var(--color-text-dim)]
                                                   hover:text-[var(--color-L2)] transition-colors disabled:opacity-40"
                                    >
                                        ✗ CLEAR
                                    </button>
                                )}
                            </div>
                            <div className="text-[10.5px] tracking-[0.04em] text-[var(--color-text-dim)] mb-2.5">
                                {p.hint}
                            </div>
                            <input
                                type="password"
                                autoComplete="off"
                                spellCheck={false}
                                value={drafts[p.key]}
                                placeholder={configured ? '•••••••••• (replace)' : p.placeholder}
                                onChange={(e) => setDrafts((d) => ({ ...d, [p.key]: e.target.value }))}
                                className="w-full bg-[var(--color-canvas)] border border-[var(--color-border)] px-3 py-2.5
                                           font-data text-[12.5px] text-[var(--color-amber-bright)] tracking-[0.06em]
                                           placeholder:text-[var(--color-text-fade)]
                                           focus:outline-none focus:border-[var(--color-amber)] focus:ring-amber transition-colors"
                            />
                        </div>
                    );
                })}
            </div>

            {/* Save bar */}
            <div className="mt-6 flex items-center justify-between">
                <div className="text-[10.5px] tracking-[0.1em] font-data text-[var(--color-text-dim)]">
                    {settings?.server_fallback_siliconflow
                        ? '◉ server fallback key present — runs work without BYOK'
                        : '○ no server fallback — add at least one key to run'}
                    {savedAt && <span className="text-[var(--color-mint)] ml-3">saved {savedAt}</span>}
                </div>
                <button
                    onClick={save}
                    disabled={!dirty || saving}
                    className="relative px-6 py-3 font-mono text-[12px] tracking-[0.22em] uppercase
                               text-[var(--color-canvas)] bg-[var(--color-amber)] hover:bg-[var(--color-amber-bright)]
                               transition-colors duration-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ boxShadow: dirty ? '0 0 24px var(--color-amber-glow)' : undefined }}
                >
                    {saving ? 'SAVING…' : 'SAVE KEYS'}
                </button>
            </div>

            <div className="mt-10 text-[10px] tracking-[0.2em] text-[var(--color-text-fade)] font-data">
                ─── KEYS·SCOPED·TO·SESSION ─── NEVER·LOGGED ─── HTTPS·IN·PROD ───
            </div>
        </div>
    );
}
