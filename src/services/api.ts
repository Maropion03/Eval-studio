/**
 * Eval Studio v2 — typed API client.
 *
 * - In dev, Vite proxies `/api/*` and `/health` to the FastAPI server on
 *   port 8000. Set VITE_API_BASE in `.env.production` for the deployed URL.
 * - Session cookies are session-scoped; we always send `credentials: 'include'`
 *   so the anonymous session_id flows.
 */

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

class APIError extends Error {
    status: number;
    detail?: unknown;
    constructor(status: number, message: string, detail?: unknown) {
        super(message);
        this.status = status;
        this.detail = detail;
    }
}

async function http<T>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
        ...init,
    });

    if (!res.ok) {
        let detail: unknown;
        try { detail = await res.json(); } catch { /* ignore */ }
        throw new APIError(res.status, `${res.status} ${res.statusText}`, detail);
    }

    // 204 / empty body
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

// ════════════════════════════════════════════════════════════════════
//  Types — mirrors backend Pydantic schemas
// ════════════════════════════════════════════════════════════════════

export type ExperimentKind = 'PROMPT' | 'MODEL' | 'PARAM' | 'SELECT';
export type RunStatus = 'draft' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
export type Severity = 'L0' | 'L1' | 'L2' | 'L3';

export interface Dataset {
    id: string;
    code: string;
    name: string;
    scenario: string;
    blurb: string | null;
    source: string | null;
    is_starter: boolean;
    cases_count: number;
    avg_tokens: number;
    typical_l2_rate: number;
}

export interface CreateExperimentIn {
    title: string;
    kind: ExperimentKind;
    dataset_id: string;
    variable_axes: {
        prompts?: string[];
        models?: string[];
        params?: Record<string, unknown>;
    };
    judge_dims: string[];
}

export interface Experiment {
    id: string;
    seq: number;
    title: string;
    kind: ExperimentKind;
    scenario: string;
    dataset_id: string;
    variable_axes: CreateExperimentIn['variable_axes'];
    judge_dims: string[];
    created_at: string;
}

export interface Run {
    id: string;
    experiment_id: string;
    status: RunStatus;
    trial_count: number;
    trials_done: number;
    cost_estimated: number;
    cost_actual: number;
    started_at: string | null;
    finished_at: string | null;
    error: string | null;
}

/** Single SSE event payload from /runs/:id/stream */
export interface TrialEvent {
    type: 'trial' | 'progress' | 'complete' | 'error';
    idx: number;
    model: string | null;
    case_code: string | null;
    severity: Severity | null;
    cost: number;
    latency_ms: number;
    done: number;
    total: number;
    cost_actual: number;
    message?: string | null;
}

export interface SettingsOut {
    siliconflow_configured: boolean;
    deepseek_configured: boolean;
    openai_configured: boolean;
    server_fallback_siliconflow: boolean;
}

export interface SettingsIn {
    siliconflow_api_key?: string | null;
    deepseek_api_key?: string | null;
    openai_api_key?: string | null;
}

// ════════════════════════════════════════════════════════════════════
//  Endpoints
// ════════════════════════════════════════════════════════════════════

export const api = {
    health: () => http<{ ok: boolean }>('/health'),

    datasets: {
        list: () => http<Dataset[]>('/api/datasets'),
    },

    experiments: {
        list:   () => http<Experiment[]>('/api/experiments'),
        get:    (id: string) => http<Experiment>(`/api/experiments/${id}`),
        create: (body: CreateExperimentIn) =>
            http<Experiment>('/api/experiments', { method: 'POST', body: JSON.stringify(body) }),
    },

    runs: {
        get:    (id: string) => http<Run>(`/api/runs/${id}`),
        create: (experimentId: string) =>
            http<Run>('/api/runs', {
                method: 'POST',
                body: JSON.stringify({ experiment_id: experimentId }),
            }),
        /**
         * Subscribe to a Run's live stream. Returns a cleanup function.
         */
        stream: (
            runId: string,
            handlers: {
                onTrial?: (e: TrialEvent) => void;
                onComplete?: (e: TrialEvent) => void;
                onError?: (err: Event) => void;
            },
        ): (() => void) => {
            const url = `${BASE}/api/runs/${runId}/stream`;
            const es = new EventSource(url, { withCredentials: true });

            es.addEventListener('trial', (ev) => {
                try {
                    const data = JSON.parse((ev as MessageEvent).data) as TrialEvent;
                    handlers.onTrial?.(data);
                } catch (e) {
                    console.error('parse trial event', e);
                }
            });
            es.addEventListener('complete', (ev) => {
                try {
                    const data = JSON.parse((ev as MessageEvent).data) as TrialEvent;
                    handlers.onComplete?.(data);
                    es.close();
                } catch (e) {
                    console.error('parse complete event', e);
                }
            });
            es.onerror = (e) => {
                handlers.onError?.(e);
                // Browser auto-reconnects unless we close. For our one-shot
                // run stream, close on first error.
                es.close();
            };

            return () => es.close();
        },
    },

    settings: {
        get: () => http<SettingsOut>('/api/settings'),
        put: (body: SettingsIn) =>
            http<SettingsOut>('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
    },
};

export { APIError };
