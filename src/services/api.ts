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

export interface CaseRow {
    case_code: string;
    difficulty: string;
    risk_tier: Severity;
    question: string;
    context_preview: string;
    reference: {
        must_contain_facts?: string[];
        must_cite_sources?: string[];
        forbidden_claims?: string[];
        golden_answer?: string;
        scoring_rubric?: string;
    };
    metadata: Record<string, unknown> | null;
}

export interface DatasetCases {
    dataset_id: string;
    name: string;
    scenario: string;
    total: number;
    cases: CaseRow[];
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

export interface CandidateDimensions {
    fact_accuracy: number;   // 0-100
    halluc_avoid: number;
    citation: number;
    no_forbidden: number;
    pass_rate: number;
}

export interface CandidateSummary {
    model: string;
    display_name: string;
    trials: number;
    pass_rate: number;
    l1: number;
    l2: number;
    l3: number;
    avg_latency_ms: number;
    total_cost: number;
    cost_per_trial: number;
    pareto: boolean;
    dimensions?: CandidateDimensions;
}

export interface RunFailure {
    trial_idx: number;
    case_id: string;
    model: string;
    severity: Severity;
    explanation: string;
    output_excerpt: string;
}

export interface DecisionBook {
    recommendation: { model: string; headline: string; pull_quote: string };
    tradeoff_paragraph?: string;
    annual_spend_table?: { assumptions: string; rows: { model: string; yuan_per_year: number }[] };
    narratives: {
        boss: { title: string; body: string };
        compliance: { title: string; body: string };
        engineering: { title: string; body: string };
    };
    risks: { severity: string; risk: string; mitigation: string }[];
    scoreboard?: CandidateSummary[];
    failures?: RunFailure[];
    _source?: string;
}

export interface RunReportData {
    run: {
        id: string;
        status: RunStatus;
        trial_count: number;
        trials_done: number;
        cost_actual: number;
        started_at: string | null;
        finished_at: string | null;
    };
    experiment: {
        id: string;
        title: string;
        kind: ExperimentKind;
        scenario: string;
    };
    candidates: CandidateSummary[];
    severity_breakdown: Record<string, { l0: number; l1: number; l2: number; l3: number }>;
    failures: RunFailure[];
    decision_book: DecisionBook | null;
}

export interface SettingsOut {
    siliconflow_configured: boolean;
    deepseek_configured: boolean;
    openai_configured: boolean;
    server_fallback_siliconflow: boolean;
    mock_llm: boolean;
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
        cases: (id: string, limit = 50, offset = 0) =>
            http<DatasetCases>(`/api/datasets/${id}/cases?limit=${limit}&offset=${offset}`),
        remove: (id: string) => http<void>(`/api/datasets/${id}`, { method: 'DELETE' }),
        /** Upload a JSON/CSV dataset (multipart). Resolves to the new Dataset. */
        upload: async (file: File, name?: string): Promise<Dataset> => {
            const form = new FormData();
            form.append('file', file);
            if (name) form.append('name', name);
            const res = await fetch(`${BASE}/api/datasets/upload`, {
                method: 'POST',
                credentials: 'include',
                body: form,
            });
            if (!res.ok) {
                let detail: unknown;
                try { detail = await res.json(); } catch { /* ignore */ }
                throw new APIError(res.status, `${res.status} ${res.statusText}`, detail);
            }
            return (await res.json()) as Dataset;
        },
    },

    experiments: {
        list:   () => http<Experiment[]>('/api/experiments'),
        get:    (id: string) => http<Experiment>(`/api/experiments/${id}`),
        create: (body: CreateExperimentIn) =>
            http<Experiment>('/api/experiments', { method: 'POST', body: JSON.stringify(body) }),
    },

    runs: {
        get:    (id: string) => http<Run>(`/api/runs/${id}`),
        report: (id: string) => http<RunReportData>(`/api/runs/${id}/report`),
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
