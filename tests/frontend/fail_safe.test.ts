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

    it('should return NO_ANALYSIS status when health check fails', async () => {
        // Health check fails
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 500
        });

        const promise = RiskEngine.assess('https://example.com', 'url');
        const assessment = await promise;

        expect(assessment.status).toBe('NO_ANALYSIS');
        expect(assessment.primary_hypothesis).toBe('Analysis Temporarily Unavailable');
        // Should NOT attempt analysis (fetch called only once for health)
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should proceed to analysis if health check passes', async () => {
        // 1. Health check passes
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'ok' })
        });

        // 2. Analysis succeeds
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                result: {
                    verdict: 'BENIGN',
                    riskScore: 0,
                    final_assessment: 'SAFE',
                    root_trusted: false,
                    summary: 'Safe',
                    explanation: { recommendedActions: [] },
                    features: [],
                    confidence: 0.95
                }
            })
        });

        const promise = RiskEngine.assess('https://example.com', 'url');
        const assessment = await promise;

        expect(assessment.status).toBe('SUCCESS');
        expect(global.fetch).toHaveBeenCalledTimes(2); // Health + Analysis
    });

    it('should return NO_ANALYSIS status when backend fails analysis (Network Error) after passing health', async () => {
         // 1. Health check passes
         (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ status: 'ok' })
        });

        // 2. Analysis fails (override mock for subsequent calls to fail)
        (global.fetch as any).mockRejectedValue(new Error('Network Error'));
        // Re-mock first call to be success (because mockRejectedValue overwrites everything)
        (global.fetch as any).mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: async () => ({ status: 'ok' })
        }));


        // Start the assessment
        const promise = RiskEngine.assess('https://example.com', 'url');

        // Fast-forward through retries
        await vi.advanceTimersByTimeAsync(2000);

        const assessment = await promise;

        expect(assessment.status).toBe('NO_ANALYSIS');
        // 1 Health + 1 Analysis + 1 Retry = 3 calls
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });
});
