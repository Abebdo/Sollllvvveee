import { describe, it, expect } from 'vitest';
import { analyzeBaseline } from '../../functions/_lib/engines/baseline.engine';
import { analyzeMetaJudgment } from '../../functions/_lib/engines/meta_judgment.engine';
import { analyzeConfidenceFragility } from '../../functions/_lib/engines/confidence_fragility.engine';
import { EngineResult } from '../../functions/_lib/engines/types';

describe('V4 Intelligence - Baseline Engine', () => {
    it('should detect anomalies in known entities (Google with suspicious path)', () => {
        const artifact = 'https://google.com/login.php';
        const result = analyzeBaseline(artifact, 'url');

        expect(result.deviation_score).toBeGreaterThan(50);
        expect(result.deviation_reasoning).toContain('suspicious pattern');
        expect(result.features).toHaveLength(1);
        expect(result.features[0].id).toBe('baseline_deviation_google');
    });

    it('should validate normal behavior for known entities', () => {
        const artifact = 'google.com';
        const result = analyzeBaseline(artifact, 'domain');

        expect(result.deviation_score).toBe(0);
        expect(result.deviation_reasoning).toContain('aligns with expected baseline');
    });

    it('should validate normal behavior for allowlisted subdomains', () => {
        const artifact = 'accounts.google.com';
        const result = analyzeBaseline(artifact, 'domain');

        expect(result.deviation_score).toBe(0);
    });

    it('should detect generic anomalies for unknown entities', () => {
        // Deeply nested subdomain
        const artifact = 'a.b.c.d.e.f.example.com';
        const result = analyzeBaseline(artifact, 'domain');

        expect(result.deviation_score).toBeGreaterThan(0);
        expect(result.features[0].id).toBe('baseline_generic_depth');
    });
});

describe('V4 Intelligence - Meta-Judgment Engine', () => {
    it('should detect contradiction between Reputation (Safe) and Baseline (Risky)', () => {
        const results: EngineResult[] = [
            { name: 'reputation', score: 0, confidence: 1.0, signals: ['reputation_allowlist'], features: [] },
            { name: 'baseline', score: 75, confidence: 0.8, signals: ['baseline_deviation_google'], features: [] }
        ];

        const meta = analyzeMetaJudgment(results);

        expect(meta.contradictions.length).toBeGreaterThan(0);
        expect(meta.contradictions).toContain('Reputation safe-list contradicted by active risk signals');
        expect(meta.confidence_adjustment).toBeLessThan(1.0);
    });

    it('should detect contradiction: Low overall risk but specific high risk signal', () => {
        // Average score needs to be < 30.
        // (0 + 80 + 0 + 0)/4 = 20.
        const results: EngineResult[] = [
            { name: 'engineA', score: 0, confidence: 1.0, signals: [], features: [] },
            { name: 'engineB', score: 80, confidence: 1.0, signals: [], features: [] },
            { name: 'engineC', score: 0, confidence: 1.0, signals: [], features: [] },
            { name: 'engineD', score: 0, confidence: 1.0, signals: [], features: [] }
        ];

        const meta = analyzeMetaJudgment(results);

        expect(meta.contradictions).toContain('Engines disagree significantly on the risk level.');
        expect(meta.confidence_adjustment).toBeLessThan(0.8);
    });

    it('should respect consensus when all agree', () => {
        const features = [
            { id: 'f1', riskContribution: 10, description: 'd', tier: 'TIER_1_LOCAL' as const, detected: true, evidence: [] },
            { id: 'f2', riskContribution: 10, description: 'd', tier: 'TIER_1_LOCAL' as const, detected: true, evidence: [] }
        ];

        // Use distinct engine families to avoid Echo Chamber penalty
        const results: EngineResult[] = [
            { name: 'heuristic', score: 80, confidence: 1.0, signals: [], features: [features[0], features[1]] },
            { name: 'semantic', score: 85, confidence: 1.0, signals: [], features: [features[0], features[1]] },
            { name: 'structure', score: 82, confidence: 1.0, signals: [], features: [features[0]] }
        ];

        const meta = analyzeMetaJudgment(results);
        expect(meta.disagreement_level).toBe('low');
        expect(meta.confidence_adjustment).toBe(1.0);
    });
});

describe('V4 Intelligence - Confidence Fragility', () => {
    it('should detect fragility when verdict depends heavily on one engine (Risk)', () => {
        // Scenario: Only 'heuristic' finds risk. Others find nothing.
        const results: EngineResult[] = [
            { name: 'reputation', score: 0, confidence: 1.0, signals: [], features: [] },
            { name: 'heuristic', score: 80, confidence: 1.0, signals: [], features: [
                { id: 'h1', riskContribution: 80, description: 'bad', tier: 'TIER_1_LOCAL' as const, detected: true, evidence: [] }
            ]},
            { name: 'baseline', score: 0, confidence: 1.0, signals: [], features: [] }
        ];

        const finalScore = 80; // Orchestrator takes max
        const fragility = analyzeConfidenceFragility(results, finalScore);

        // Removing 'heuristic' drops score to 0. Sensitivity = 1.0. Stability = 0.0.
        expect(fragility.stability_score).toBeLessThan(0.2);
        expect(fragility.fragility_reasons).toContain('Risk score is highly sensitive to a single signal feature.');
    });

    it('should detect stable risk when multiple engines agree', () => {
        const results: EngineResult[] = [
            { name: 'engineA', score: 80, confidence: 1.0, signals: [], features: [
                { id: 'f1', riskContribution: 80, description: 'bad1', tier: 'TIER_1_LOCAL' as const, detected: true, evidence: [] }
            ]},
            { name: 'engineB', score: 80, confidence: 1.0, signals: [], features: [
                { id: 'f2', riskContribution: 80, description: 'bad2', tier: 'TIER_1_LOCAL' as const, detected: true, evidence: [] }
            ]}
        ];

        const finalScore = 80;
        const fragility = analyzeConfidenceFragility(results, finalScore);

        // Removing engineA drops score to 80 (engineB). Sensitivity = 0. Stability = 1.0.
        expect(fragility.stability_score).toBeGreaterThan(0.9);
    });

    it('should detect fragility: Safe ONLY because of Allowlist (if score suppressed)', () => {
        // Scenario: Orchestrator suppressed score (Hypothetical logic test for engine)
        // If finalScore passed is low (0), but engines show high risk
        const results: EngineResult[] = [
            { name: 'reputation', score: 0, confidence: 1.0, signals: ['reputation_allowlist'], features: [] },
            { name: 'baseline', score: 90, confidence: 1.0, signals: [], features: [] }
        ];

        const finalScore = 0; // Simulated suppression
        const fragility = analyzeConfidenceFragility(results, finalScore);

        expect(fragility.stability_score).toBeLessThan(0.5);
        expect(fragility.fragility_reasons[0]).toContain("Verdict is heavily dependent on 'reputation' allowlist");
    });
});
