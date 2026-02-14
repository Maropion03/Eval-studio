export interface EvaluationItem {
    id: string;
    query: string;
    context: string;
    response: string;
    groundTruth: string;
    scores: {
        faithfulness: number;
        relevance: number;
        coherence: number; // 1-5 scale
    };
    reasoning: string;
    failureType?: 'Retrieval_Failure' | 'Reasoning_Error' | 'Safety_Refusal';
    // For Diff View: indices into the response string marking hallucinated spans
    hallucinationSpans?: { start: number; end: number; text: string }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
    };
}

export interface Dataset {
    id: string;
    name: string;
    itemCount: number;
    createdAt: string;
    status: 'ready' | 'evaluating' | 'completed';
}

export interface EvaluationRun {
    id: string;
    datasetId: string;
    datasetName: string;
    model: string;
    metrics: string[];
    status: 'running' | 'completed' | 'failed';
    createdAt: string;
    completedAt?: string;
    totalItems: number;
    completedItems?: number;
    averageScores?: {
        faithfulness: number;
        relevance: number;
        coherence: number;
    };
}

export interface PlaygroundResult {
    score: number;
    reasoning: string;
    model: string;
    latency_ms: number;
    tokens: { prompt: number; completion: number };
}

export interface AppSettings {
    system_prompt: string | null;
    low_score_threshold: number;
}
