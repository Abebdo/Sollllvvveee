import { describe, it, expect, vi } from 'vitest';
import { RiskEngine } from '../../services/intelligence';
import { RiskAssessment } from '../../types';

// Mock fetch
global.fetch = vi.fn();

describe('Frontend Risk Mapping', () => {

    it('should map TRUSTED_SERVICE_ABUSED to "Trusted Service – Suspicious Usage"', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({
                result: {
                    verdict: 'SUSPICIOUS',
                    riskScore: 65,
                    final_assessment: 'TRUSTED_SERVICE_ABUSED',
                    root_trusted: true,
                    summary: 'Test Summary',
                    explanation: { recommendedActions: [] },
                    features: [],
                    confidence: 0.8
                }
            })
        });

        const assessment = await RiskEngine.assess('https://docs.google.com/forms/...,', 'url');
        expect(assessment.primary_hypothesis).toBe('Trusted Service – Suspicious Usage');

        // Check Domain Trust Signal
        const domainTrustSignal = assessment.technical_signals.find(s => s.name === 'Domain Trust');
        expect(domainTrustSignal).toBeDefined();
        expect(domainTrustSignal?.value).toBe('SAFE');
    });

    it('should map MALICIOUS_SERVICE to "Malicious Service"', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({
                result: {
                    verdict: 'MALICIOUS',
                    riskScore: 90,
                    final_assessment: 'MALICIOUS_SERVICE',
                    root_trusted: false,
                    summary: 'Test Summary',
                    explanation: { recommendedActions: [] },
                    features: [],
                    confidence: 0.9
                }
            })
        });

        const assessment = await RiskEngine.assess('https://evil.com', 'url');
        expect(assessment.primary_hypothesis).toBe('Malicious Service');
    });

    it('should map SAFE to "Legitimate Activity"', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({
                result: {
                    verdict: 'BENIGN',
                    riskScore: 0,
                    final_assessment: 'SAFE',
                    root_trusted: false, // or true
                    summary: 'Test Summary',
                    explanation: { recommendedActions: [] },
                    features: [],
                    confidence: 0.9
                }
            })
        });

        const assessment = await RiskEngine.assess('https://example.com', 'url');
        expect(assessment.primary_hypothesis).toBe('Legitimate Activity');
    });

});
