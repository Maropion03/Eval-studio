/**
 * Eval Studio API Client
 *
 * Centralized fetch wrapper for all backend API calls.
 * Includes snake_case → camelCase adapters to match existing frontend types.
 */

import type { EvaluationItem, EvaluationRun, Dataset } from '../data/mockData';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

// ── Session Management (Volatile) ────────────────
// Generates a random session ID every time the module loads (page refresh)
const SESSION_ID = crypto.randomUUID();
console.log('[Eval Studio] Session ID:', SESSION_ID);

// ── Helper ──────────────────────────────────────

async function request<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const url = `${BASE_URL}${path}`;

    const headers: Record<string, string> = {};
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    // Generic LLM credentials
    const llmApiKey = localStorage.getItem('llm_api_key');
    const llmBaseUrl = localStorage.getItem('llm_base_url');
    const llmModel = localStorage.getItem('llm_model');

    if (llmApiKey) headers['x-llm-key'] = llmApiKey;
    if (llmBaseUrl) headers['x-llm-base-url'] = llmBaseUrl;
    if (llmModel) headers['x-llm-model'] = llmModel;

    // Session ID Injection (Volatile)
    // Generated once per page load (in global scope below)
    headers['x-session-id'] = SESSION_ID;

    const res = await fetch(url, {
        headers: { ...headers, ...(options.headers as Record<string, string>) },
        ...options,
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`API ${res.status}: ${body}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
}

// ── snake_case → camelCase adapters ─────────────

interface ApiDataset {
    id: string;
    name: string;
    item_count: number;
    status: string;
    created_at: string;
}

function adaptDataset(d: ApiDataset): Dataset {
    return {
        id: d.id,
        name: d.name,
        itemCount: d.item_count,
        status: d.status as Dataset['status'],
        createdAt: d.created_at,
    };
}

interface ApiScores {
    faithfulness?: number;
    relevance?: number;
    coherence?: number;
}

interface ApiRun {
    id: string;
    dataset_id: string;
    dataset_name: string;
    model: string;
    metrics: string[];
    status: string;
    total_items: number;
    completed_items: number;
    average_scores: ApiScores | null;
    created_at: string;
    completed_at: string | null;
}

function adaptRun(r: ApiRun): EvaluationRun {
    return {
        id: r.id,
        datasetId: r.dataset_id,
        datasetName: r.dataset_name,
        model: r.model,
        metrics: r.metrics,
        status: r.status as EvaluationRun['status'],
        createdAt: r.created_at,
        completedAt: r.completed_at ?? undefined,
        totalItems: r.total_items,
        averageScores: r.average_scores
            ? {
                faithfulness: r.average_scores.faithfulness ?? 0,
                relevance: r.average_scores.relevance ?? 0,
                coherence: r.average_scores.coherence ?? 0,
            }
            : undefined,
    };
}

interface ApiHallucinationSpan {
    start: number;
    end: number;
    text: string;
}

interface ApiItem {
    id: string;
    run_id: string;
    query: string;
    context: string;
    response: string;
    ground_truth: string;
    scores: ApiScores | null;
    reasoning: string | null;
    failure_type: string | null;
    hallucination_spans: ApiHallucinationSpan[] | null;
    usage: { prompt_tokens: number; completion_tokens: number } | null;
}

function adaptItem(item: ApiItem): EvaluationItem {
    return {
        id: item.id,
        query: item.query,
        context: item.context,
        response: item.response,
        groundTruth: item.ground_truth,
        scores: {
            faithfulness: item.scores?.faithfulness ?? 0,
            relevance: item.scores?.relevance ?? 0,
            coherence: item.scores?.coherence ?? 0,
        },
        reasoning: item.reasoning ?? '',
        failureType: (item.failure_type as EvaluationItem['failureType']) ?? undefined,
        hallucinationSpans: item.hallucination_spans ?? undefined,
        usage: item.usage ?? { prompt_tokens: 0, completion_tokens: 0 },
    };
}

// ── Playground result type ──────────────────────

export interface PlaygroundResult {
    score: number;
    reasoning: string;
    model: string;
    latency_ms: number;
    tokens: { prompt: number; completion: number };
}

// ── Datasets ────────────────────────────────────

export async function listDatasets(): Promise<Dataset[]> {
    const raw = await request<ApiDataset[]>('/datasets');
    return raw.map(adaptDataset);
}

export async function createDataset(
    name: string,
    items: Record<string, unknown>[],
): Promise<Dataset> {
    const raw = await request<ApiDataset>('/datasets', {
        method: 'POST',
        body: JSON.stringify({ name, items }),
    });
    return adaptDataset(raw);
}

export async function uploadDatasetFile(file: File, name?: string): Promise<Dataset> {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);

    const res = await fetch(`${BASE_URL}/datasets/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Upload failed (${res.status}): ${body}`);
    }
    return adaptDataset(await res.json());
}

export async function getDatasetItems(
    id: string,
    skip = 0,
    limit = 50,
): Promise<{ total: number; items: Record<string, unknown>[] }> {
    return request(`/datasets/${id}/items?skip=${skip}&limit=${limit}`);
}

export async function deleteDataset(id: string): Promise<void> {
    return request<void>(`/datasets/${id}`, { method: 'DELETE' });
}

// ── Evaluation Runs ─────────────────────────────

export async function listRuns(): Promise<EvaluationRun[]> {
    const raw = await request<ApiRun[]>('/runs');
    return raw.map(adaptRun);
}

export async function createRun(params: {
    dataset_id: string;
    model: string;
    metrics: string[];
    system_prompt?: string;
}): Promise<EvaluationRun> {
    const raw = await request<ApiRun>('/runs', {
        method: 'POST',
        body: JSON.stringify(params),
    });
    return adaptRun(raw);
}

export async function getRun(id: string): Promise<EvaluationRun & { completedItems: number }> {
    const raw = await request<ApiRun>(`/runs/${id}`);
    return { ...adaptRun(raw), completedItems: raw.completed_items };
}

export async function getRunItems(
    id: string,
    skip = 0,
    limit = 200,
): Promise<EvaluationItem[]> {
    const raw = await request<ApiItem[]>(`/runs/${id}/items?skip=${skip}&limit=${limit}`);
    return raw.map(adaptItem);
}

/**
 * Poll a run until it completes or fails.
 */
export async function pollRunUntilDone(
    id: string,
    intervalMs = 1000,
    onProgress?: (run: EvaluationRun & { completedItems: number }) => void,
): Promise<EvaluationRun & { completedItems: number }> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const run = await getRun(id);
        onProgress?.(run);

        if (run.status === 'completed' || run.status === 'failed') {
            return run;
        }

        await new Promise((r) => setTimeout(r, intervalMs));
    }
}

// ── Playground ──────────────────────────────────

export async function playgroundEvaluate(params: {
    system_prompt: string;
    query: string;
    context: string;
    response: string;
    model?: string;
    metric?: string;
}): Promise<PlaygroundResult> {
    const raw = await request<{
        score: number;
        reasoning: string;
        model: string;
        latency_ms: number;
        usage: { prompt_tokens: number; completion_tokens: number };
    }>('/playground/evaluate', {
        method: 'POST',
        body: JSON.stringify(params),
    });

    return {
        score: raw.score,
        reasoning: raw.reasoning,
        model: raw.model,
        latency_ms: raw.latency_ms,
        tokens: {
            prompt: raw.usage.prompt_tokens,
            completion: raw.usage.completion_tokens,
        },
    };
}

// ── Compare ─────────────────────────────────────

export async function compareRuns(
    baseId: string,
    targetId: string,
): Promise<{
    baseRun: EvaluationRun;
    targetRun: EvaluationRun;
    baseItems: EvaluationItem[];
    targetItems: EvaluationItem[];
}> {
    const raw = await request<{
        base_run: ApiRun;
        target_run: ApiRun;
        base_items: ApiItem[];
        target_items: ApiItem[];
    }>(`/compare?baseId=${baseId}&targetId=${targetId}`);

    return {
        baseRun: adaptRun(raw.base_run),
        targetRun: adaptRun(raw.target_run),
        baseItems: raw.base_items.map(adaptItem),
        targetItems: raw.target_items.map(adaptItem),
    };
}

// ── Settings ────────────────────────────────────

export interface AppSettings {
    system_prompt: string | null;
    low_score_threshold: number;
}

export async function getSettings(): Promise<AppSettings> {
    return request<AppSettings>('/settings');
}

export async function updateSettings(
    params: Partial<AppSettings>,
): Promise<AppSettings> {
    return request<AppSettings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(params),
    });
}

// ── Health ──────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
    try {
        const res = await fetch('/health');
        return res.ok;
    } catch {
        return false;
    }
}
