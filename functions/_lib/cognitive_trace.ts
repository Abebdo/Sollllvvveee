export interface CognitiveTraceStep {
    engine: string;
    observation: string;
    rationale: string;
    impact: number;
    confidence: number;
    meta?: Record<string, any>;
}
