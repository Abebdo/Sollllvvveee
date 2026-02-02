import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RiskEngine } from '../../services/intelligence';

global.fetch = vi.fn();

describe('Frontend Fail-Safe Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return NO_ANALYSIS status when backend fails (Network Error)', async () => {
        // Mock fetch to reject (network error)
        (global.fetch as any).mockRejectedValue(new Error('Network Error'));

        // Start the assessment
        const promise = RiskEngine.assess('https://example.com', 'url');

        // Fast-forward through retries
        // The service waits 1s (1000ms) for the first retry.
        await vi.advanceTimersByTimeAsync(2000);

        const assessment = await promise;

        expect(assessment.status).toBe('NO_ANALYSIS');
        expect(assessment.primary_hypothesis).toBe('Analysis Temporarily Unavailable');
        expect(assessment.uncertainty.confidence_percentage).toBeNull();

        // Expect 2 calls: Initial attempt (0) + 1 retry (attempt 1 <= MAX_RETRIES=1)
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should return NO_ANALYSIS status when backend returns 500', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error_code: 'E_INTERNAL', message: 'Internal Server Error' })
        });

        const promise = RiskEngine.assess('https://example.com', 'url');
        await vi.advanceTimersByTimeAsync(2000);
        const assessment = await promise;

        expect(assessment.status).toBe('NO_ANALYSIS');
        expect(assessment.summary).toContain('No judgment has been made');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should return SUCCESS status when backend recovers on retry', async () => {
        // First call fails
        (global.fetch as any).mockRejectedValueOnce(new Error('Network Error'));

        // Second call succeeds
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                result: {
                    verdict: 'BENIGN',
                    riskScore: 0,
                    final_assessment: 'SAFE',
                    root_trusted: false,
                    summary: 'Recovered',
                    explanation: { recommendedActions: [] },
                    features: [],
                    confidence: 0.95,
                    uncertainty_flags: []
                }
            })
        });

        const promise = RiskEngine.assess('https://example.com', 'url');
        await vi.advanceTimersByTimeAsync(2000);
        const assessment = await promise;

        expect(assessment.status).toBe('SUCCESS');
        expect(assessment.primary_hypothesis).toBe('Legitimate Activity');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});
