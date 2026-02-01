import { describe, it, expect, vi } from 'vitest';
import { handleAnalysisRequest } from '../../functions/_lib/orchestrator';
import { calculateContextAdjustment } from '../../functions/_lib/context';
import { buildReasoningGraph } from '../../functions/_lib/reasoning';
import { calculateConfidence } from '../../functions/_lib/confidence';
import { analyzeTemporal } from '../../functions/_lib/temporal';
import { Env, FeatureResult } from '../../functions/_lib/types';
import { EngineResult } from '../../functions/_lib/engines/types';

describe('Context Logic', () => {
    it('should increase score for URL in email context', () => {
        const adj = calculateContextAdjustment({ source: 'email' }, 'url');
        expect(adj.scoreModifier).toBeGreaterThan(0);
        expect(adj.reason).toContain('Phishing');
    });

    it('should be neutral for API context', () => {
        const adj = calculateContextAdjustment({ source: 'api' }, 'url');
        expect(adj.scoreModifier).toBe(0);
    });
});

describe('Reasoning Graph', () => {
    it('should build a chain from features', () => {
        const features: Record<string, FeatureResult> = {
            'f1': {
                id: 'f1', tier: 'TIER_1_LOCAL', detected: true, riskContribution: 20,
                description: 'Bad thing', evidence: ['proof']
            },
            'f2': {
                id: 'f2', tier: 'TIER_1_LOCAL', detected: true, riskContribution: 50,
                description: 'Worse thing', evidence: ['more proof']
            }
        };

        const graph = buildReasoningGraph(features, 'MALICIOUS');

        expect(graph.conclusion).toBe('High Risk Artifact');
        expect(graph.chain).toHaveLength(2);
        expect(graph.chain[0].signal).toBe('f2'); // Higher impact first
        expect(graph.chain[1].signal).toBe('f1');
    });
});

describe('Confidence Model', () => {
    it('should calculate high confidence when engines agree', () => {
        const results: EngineResult[] = [
            { name: 'e1', confidence: 0.9, score: 90, signals: [], features: [] },
            { name: 'e2', confidence: 0.8, score: 80, signals: [], features: [] }
        ];

        const profile = calculateConfidence(results);
        expect(profile.score).toBeGreaterThan(0.85);
        expect(profile.reasons[1]).toContain('Consensus');
    });

    it('should penalty confidence when engines disagree', () => {
        const results: EngineResult[] = [
            { name: 'e1', confidence: 0.9, score: 90, signals: [], features: [] }, // Risky
            { name: 'e2', confidence: 0.8, score: 10, signals: [], features: [] }  // Safe
        ];

        const profile = calculateConfidence(results);
        expect(profile.reasons[1]).toContain('Conflicting');
    });
});

describe('Temporal Logic', () => {
    it('should detect degrading trend', async () => {
        const mockEnv = {
            ANALYSIS_CACHE: {
                get: vi.fn().mockResolvedValue(JSON.stringify({ riskScore: 50 })),
                put: vi.fn()
            }
        } as unknown as Env;

        const result = await analyzeTemporal(mockEnv, 'key', 80);

        expect(result.trend).toBe('degrading');
        expect(result.delta).toBe(30);
    });

    it('should return insufficient data if no history', async () => {
        const mockEnv = {
            ANALYSIS_CACHE: {
                get: vi.fn().mockResolvedValue(null),
                put: vi.fn()
            }
        } as unknown as Env;

        const result = await analyzeTemporal(mockEnv, 'key', 80);

        expect(result.trend).toBe('insufficient_data');
    });
});
