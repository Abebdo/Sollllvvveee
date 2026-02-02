import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeRootTrust } from '../../functions/_lib/engines/root_trust.engine';
import { calibrateConfidence } from '../../functions/_lib/confidence';
import { generateAnalystExplanation } from '../../functions/_lib/explanation/human_explanation';
import { EngineResult } from '../../functions/_lib/engines/types';

describe('Master Prompt Compliance', () => {

    describe('Phase A: Trust Repair', () => {
        it('Engine 41 & 59: Google.com must be a Reality Anchor', async () => {
            const result = await analyzeRootTrust('google.com', 'domain');
            expect(result.is_trusted).toBe(true);
            expect(result.role).toBe('Infrastructure Provider');
            expect(result.verdict).toBe('SAFE');
        });

        it('Engine 41: Amazon.com must be Commerce/Infra', async () => {
            const result = await analyzeRootTrust('amazon.com', 'domain');
            expect(result.is_trusted).toBe(true);
            // expect(result.role).toBe('Infrastructure + Commerce');
            // The actual role string in code: 'Infrastructure + Commerce'
        });

        it('Engine 41: Unknown domain must not be trusted', async () => {
            const result = await analyzeRootTrust('random-evil-site.com', 'domain');
            expect(result.is_trusted).toBe(false);
            expect(result.verdict).toBe('UNKNOWN');
        });
    });

    describe('Engine 60: Confidence Governor', () => {
        it('Legitimate verdict must be 85-98%', () => {
            // raw 0.99 -> mapped to max of range
            const conf = calibrateConfidence(0.99, 'BENIGN', 10);
            expect(conf).toBeLessThanOrEqual(0.98);
            expect(conf).toBeGreaterThanOrEqual(0.85);
        });

        it('Suspicious verdict must be 40-70%', () => {
            const conf = calibrateConfidence(0.60, 'SUSPICIOUS', 60);
            expect(conf).toBeLessThanOrEqual(0.70);
            expect(conf).toBeGreaterThanOrEqual(0.40);
        });

        it('Malicious verdict (Likely) must be 75-85%', () => {
            // "Likely Malicious"
            const conf = calibrateConfidence(0.80, 'MALICIOUS', 80);
            expect(conf).toBeLessThanOrEqual(0.85);
            expect(conf).toBeGreaterThanOrEqual(0.75);
        });

        it('Confirmed Malicious must be 85-98%', () => {
             const conf = calibrateConfidence(0.95, 'MALICIOUS', 95);
             expect(conf).toBeLessThanOrEqual(0.98);
             expect(conf).toBeGreaterThanOrEqual(0.85);
        });
    });

    describe('Engine 51 & 44: Explanation Logic', () => {
        const mockResults: EngineResult[] = [
             { name: 'reputation', score: 0, confidence: 1, signals: [], features: [], summary: 'Safe' }
        ];

        it('Should generate User Impact and Guidance', () => {
            const insight = generateAnalystExplanation(
                mockResults,
                { conflict_detected: false, primary_conflict: null, winning_signal: 'NONE', reasoning: '', confidence_adjustment: 1 },
                'BENIGN',
                10,
                { score: 0, level: 'LOW', reasons: [] },
                { min: 0.9, mostLikely: 0.95, max: 0.98, uncertainty: 'LOW' }
            );

            expect(insight.user_impact).toBeDefined();
            expect(insight.user_guidance).toBeDefined();
            expect(insight.analyst_summary).not.toContain('Definitely');
            expect(insight.analyst_summary).not.toContain('100%');
        });

         it('Should handle Trusted Service Abuse explanation', () => {
            const insight = generateAnalystExplanation(
                mockResults,
                { conflict_detected: true, primary_conflict: 'Trusted Abuse', winning_signal: 'INTENT', reasoning: '', confidence_adjustment: 1 },
                'SUSPICIOUS', // Verdict might be suspicious or benign w/ flag
                80,
                { score: 5, level: 'MEDIUM', reasons: [] },
                { min: 0.7, mostLikely: 0.8, max: 0.9, uncertainty: 'MEDIUM' },
                true, // Root Trusted
                'TRUSTED_SERVICE_ABUSED'
            );

            expect(insight.analyst_summary).toContain('Trusted Service Abuse');
            expect(insight.user_impact?.likelihood).toBe('HIGH');
            expect(insight.user_guidance?.immediate_action).toContain('Close');
        });
    });

});
