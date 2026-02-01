import { describe, it, expect } from 'vitest';
import { analyzeMeta } from '../../functions/_lib/engines/meta.engine';
import { performCounterfactualAnalysis } from '../../functions/_lib/reasoning/counterfactual';
import { EngineResult } from '../../functions/_lib/engines/types';

describe('Meta-Analysis Engine', () => {
    it('should detect high disagreement', () => {
        const results: EngineResult[] = [
            { name: 'A', score: 10, confidence: 0.9, signals: [], features: [] },
            { name: 'B', score: 90, confidence: 0.9, signals: [], features: [] }
        ];
        const meta = analyzeMeta(results);
        expect(meta.disagreement_level).toBe('high');
        expect(meta.consensus_score).toBeLessThan(0.5);
    });

    it('should detect low disagreement (consensus)', () => {
        const results: EngineResult[] = [
            { name: 'A', score: 85, confidence: 0.9, signals: [], features: [] },
            { name: 'B', score: 90, confidence: 0.9, signals: [], features: [] }
        ];
        const meta = analyzeMeta(results);
        expect(meta.disagreement_level).toBe('low');
        expect(meta.consensus_score).toBeGreaterThan(0.8);
    });

    it('should identify dominant engines', () => {
        const results: EngineResult[] = [
            { name: 'A', score: 10, confidence: 0.9, signals: [], features: [] },
            { name: 'B', score: 10, confidence: 0.9, signals: [], features: [] },
            { name: 'C', score: 90, confidence: 0.9, signals: [], features: [] }
        ];
        const meta = analyzeMeta(results);
        expect(meta.dominant_engines).toContain('C');
        expect(meta.dominant_engines).not.toContain('A');
    });
});

describe('Counterfactual Reasoning', () => {
    const baseFeatures = [
        { id: 'f1', riskContribution: 50, description: 'Critical feature', tier: 'TIER_1_LOCAL' as const, detected: true, evidence: [] },
        { id: 'f2', riskContribution: 10, description: 'Minor feature', tier: 'TIER_1_LOCAL' as const, detected: true, evidence: [] }
    ];

    it('should detect high sensitivity to a single feature', () => {
        const results: EngineResult[] = [
            {
                name: 'A',
                score: 60,
                confidence: 0.9,
                signals: [],
                features: baseFeatures
            }
        ];

        // Initial score is max(60) = 60.
        // Removing f1 (50) -> score 10. Drop 50.
        // Sensitivity = 50 / 60 = 0.83

        const cf = performCounterfactualAnalysis(results, 60);
        expect(cf.sensitivity).toBeGreaterThan(0.8);
        expect(cf.critical_dependencies).toContain('f1');
        expect(cf.critical_dependencies).not.toContain('f2');
    });

    it('should show low sensitivity when redundant evidence exists', () => {
        // Engine A finds f1 (50) -> 60
        // Engine B finds f3 (50) -> 60
        // Removing f1 drops A to 10, but B stays at 60. Max is still 60. Drop 0.

        const results: EngineResult[] = [
            {
                name: 'A',
                score: 60,
                confidence: 0.9,
                signals: [],
                features: [baseFeatures[0], baseFeatures[1]]
            },
            {
                name: 'B',
                score: 60,
                confidence: 0.9,
                signals: [],
                features: [{ id: 'f3', riskContribution: 50, description: 'Redundant Critical', tier: 'TIER_1_LOCAL' as const, detected: true, evidence: [] }]
            }
        ];

        const cf = performCounterfactualAnalysis(results, 60);
        expect(cf.sensitivity).toBe(0); // Robust
    });

    it('should flag fragile assumptions', () => {
        // High impact feature from low confidence engine
        const results: EngineResult[] = [
            {
                name: 'LowConfEngine',
                score: 80,
                confidence: 0.4,
                signals: [],
                features: [{ id: 'weak_signal', riskContribution: 70, description: 'Weak', tier: 'TIER_1_LOCAL' as const, detected: true, evidence: [] }]
            }
        ];

        const cf = performCounterfactualAnalysis(results, 80);
        expect(cf.fragile_assumptions).toContain('weak_signal');
    });
});
