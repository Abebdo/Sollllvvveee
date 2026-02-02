import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAnalysisRequest } from '../../functions/_lib/orchestrator';

// Mock Env
class MockKV {
    store: Record<string, string> = {};
    async get(key: string) { return this.store[key] || null; }
    async put(key: string, value: string) { this.store[key] = value; }
}

const mockEnv = {
    ANALYSIS_CACHE: new MockKV(),
    AI: {}
} as any;

const mockRequest = (body: any) => {
    return {
        method: 'POST',
        headers: {
            get: (key: string) => {
                if(key==='CF-Connecting-IP') return '1.2.3.4';
                if(key==='User-Agent') return 'test-ua';
                return null;
            }
        },
        json: async () => body
    } as unknown as Request;
};

// Mock Fetch Global
global.fetch = vi.fn();

describe('Adversarial & Epistemic Intelligence Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Default fail fetch
        (global.fetch as any).mockResolvedValue({
            ok: false,
            text: async () => ''
        });
    });

    it('should detect Google Docs Phishing (Context Mismatch)', async () => {
        // Mock content fetch to return a password field
        (global.fetch as any).mockResolvedValue({
            ok: true,
            text: async () => '<html><body><form><input type="password" name="pass"></form></body></html>'
        });

        // Use a trusted domain with suspicious intent simulation
        const req = mockRequest({ artifact: 'https://docs.google.com/forms/d/e/12345/viewform' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        // Semantic engine should detect password field
        // Docs is trusted. Password field = Malicious Intent.
        // Result should be clamped to SUSPICIOUS (Reputation Abuse).

        expect(result.semantic_intent).toBeDefined();
        expect(result.semantic_intent.indicators).toContain('Credential entry field (password) detected');

        // Check Clamping logic (Trusted + Malicious Intent -> Suspicious)
        expect(result.semantic_intent.intent).toBe('SUSPICIOUS');

        // Ensure overall verdict is at least SUSPICIOUS
        expect(result.verdict).not.toBe('BENIGN');
    });

    it('should detect Typosquatting (paypaI.com)', async () => {
        // Note: capital 'I'
        const req = mockRequest({ artifact: 'paypaI.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.signals).toContain('typosquatting');
        expect(result.riskScore).toBeGreaterThan(40);
    });

    it('should downgrade verdict when context is Email', async () => {
        // example.com is usually benign
        const req = mockRequest({
            artifact: 'https://example.com',
            context: { source: 'email' }
        });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.contextual_verdict.context_downgrade).toBe(true);
        expect(result.verdict).toBe('SUSPICIOUS'); // Downgraded from Benign
        expect(result.risk_timeline.some((t: any) => t.stage === 'Contextual Adjustment')).toBe(true);
    });

    it('should report high fragility for low diversity analysis', async () => {
        const req = mockRequest({ artifact: 'https://example-unknown.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.fragility).toBeDefined();
        // Fragility should be elevated if few signals found
        expect(['MEDIUM', 'HIGH']).toContain(result.fragility.level);

        // Confidence should be adjusted
        expect(result.confidence_level).toBeLessThan(1.0);
    });

    it('should provide confidence range', async () => {
        const req = mockRequest({ artifact: 'https://test.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.confidence_range).toBeDefined();
        expect(result.confidence_range.min).toBeLessThanOrEqual(result.confidence_range.mostLikely);
        expect(result.confidence_range.max).toBeGreaterThanOrEqual(result.confidence_range.mostLikely);
        expect(result.confidence_range.uncertainty).toBeDefined();
    });

    it('should include explainable output with positive/negative factors', async () => {
        const req = mockRequest({ artifact: 'https://test.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.explanation).toBeDefined();
        expect(result.explanation.positive_factors).toBeDefined();
        expect(result.explanation.negative_factors).toBeDefined();
        expect(result.explanation.weights).toBeDefined();
    });
});
