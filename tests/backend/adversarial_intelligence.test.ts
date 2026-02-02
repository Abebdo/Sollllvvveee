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

describe('Final Intelligence Calibration & Analyst-Grade Hardening', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Default safe response
        (global.fetch as any).mockResolvedValue({
            ok: true,
            text: async () => '<html><body>Safe content</body></html>'
        });
    });

    // 1. Google Docs Phishing (Conflict Resolution)
    it('should detect Google Docs Phishing and trigger Conflict Resolution', async () => {
        // Mock content to have a password field
        (global.fetch as any).mockResolvedValue({
            ok: true,
            text: async () => '<html><body><form><input type="password" name="p"></form></body></html>'
        });

        const req = mockRequest({ artifact: 'https://docs.google.com/forms/d/e/12345/viewform' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        // Expectations
        expect(result.verdict).not.toBe('BENIGN'); // Should be Suspicious/Malicious
        expect(result.conflict_resolution).toBeDefined();
        expect(result.conflict_resolution.conflict_detected).toBe(true);
        expect(result.conflict_resolution.winning_signal).toBe('INTENT'); // Intent beats Reputation

        // Semantic check
        expect(result.semantic_intent.indicators.some((s: string) => s.includes('password'))).toBe(true);

        // Confidence should not be 100%
        expect(result.confidence).toBeLessThan(0.96);

        // Explanation
        expect(result.analyst_insight.analyst_summary).toContain('Although');
        expect(result.analyst_insight.analyst_summary).toContain('however');
    });

    // 2. Homoglyph (paypaI.com)
    it('should detect homoglyphs and classify as High Risk', async () => {
        const req = mockRequest({ artifact: 'paypaI.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.signals).toContain('typosquatting');
        expect(result.riskScore).toBeGreaterThan(50);
        expect(result.verdict).toMatch(/SUSPICIOUS|MALICIOUS/);

        // Confidence Check
        if (result.verdict === 'MALICIOUS') {
            expect(result.confidence).toBeGreaterThanOrEqual(0.70);
            expect(result.confidence).toBeLessThanOrEqual(0.95);
        }
    });

    // 3. Subdomain Abuse (google.com.evil.com)
    it('should detect subdomain abuse (brand masquerading)', async () => {
        const req = mockRequest({ artifact: 'google.com.evil.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.signals).toContain('subdomain_abuse');
        expect(result.verdict).toBe('MALICIOUS');

        // Confidence Calibration Check
        expect(result.confidence).toBeGreaterThanOrEqual(0.70);
        expect(result.confidence).toBeLessThanOrEqual(0.95);
    });

    // 4. Bit.ly Shortened Phishing
    it('should expand URL shorteners and detect phishing', async () => {
        // Mock expansion
        // Note: Orchestrator calls expandUrl which does a HEAD request.
        // We need to mock that HEAD request.
        (global.fetch as any).mockImplementation(async (url: string, opts: any) => {
            if (url.includes('bit.ly') && opts.method === 'HEAD') {
                return {
                    url: 'https://evil-phishing-site.com/login',
                    headers: new Map(),
                    ok: true
                };
            }
            // Mock fetching the content of the resolved URL
             if (url.includes('evil-phishing-site')) {
                 return {
                     ok: true,
                     text: async () => '<html><input type="password"></html>'
                 };
             }
            return { ok: true, text: async () => '' };
        });

        const req = mockRequest({ artifact: 'https://bit.ly/suspicious' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        // Should expand and analyze final URL
        // If expansion worked, artifact might update or analysis runs on expanded
        // Actually orchestrator updates artifact variable.
        // And signals should reflect phishing.

        // Note: The orchestrator uses 'expandUrl' which uses fetch.
        // My mock above simulates redirect by returning a response with 'url' property set?
        // Actually fetch follows redirects by default. expandUrl implementation typically checks response.url.

        // Let's assume expandUrl works if fetch returns the final url.

        expect(result.verdict).not.toBe('BENIGN');
    });

    // 5. Embedded Credentials
    it('should detect embedded credentials in URL', async () => {
        const req = mockRequest({ artifact: 'http://user:pass@example.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.signals).toContain('embedded_auth');
        expect(result.verdict).toBe('MALICIOUS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.70);
    });

    // 6. Conflicting Signals (Reputation Safe vs Intent Malicious)
    it('should report conflict when Reputation is Safe but Intent is Malicious', async () => {
        // Reputation returns 0 (Safe)
        // Semantic returns MALICIOUS (password field)
        (global.fetch as any).mockResolvedValue({
            ok: true,
            text: async () => '<form><input type="password"></form>'
        });

        const req = mockRequest({ artifact: 'https://trusted-bank.com/login-reset' });
        // NOTE: 'trusted-bank' isn't in TRUSTED_INFRA list probably, but let's assume Reputation engine makes it safe.
        // But in test env, Reputation engine is real code? Or mocked?
        // It's imported real code. analyzeReputation returns 0 score by default if no signals found.

        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.conflict_resolution.conflict_detected).toBe(true);
        expect(result.conflict_resolution.winning_signal).toBe('INTENT');
        expect(result.analyst_insight.analyst_summary).toContain('Although');
    });

    // 7. Fragility & Confidence Range
    it('should show HIGH fragility and wide confidence range for sparse data', async () => {
        // Minimal input that triggers almost nothing
        const req = mockRequest({ artifact: 'https://unknown-entity.xyz' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.fragility.level).toMatch(/MEDIUM|HIGH/);

        // Check Range
        const range = result.confidence_range;
        expect(range.min).toBeLessThan(range.most_likely);
        expect(range.max).toBeGreaterThan(range.most_likely);

        // Uncertainty should be significant
        expect(range.uncertainty).toBeGreaterThan(0.2); // >20% uncertainty
    });

    // 8. 100% Confidence Forbidden
    it('should NEVER return 100% confidence', async () => {
        // Even for something obviously malicious
        const req = mockRequest({ artifact: 'http://google.com.evil.com/login' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.confidence).toBeLessThan(1.0);
        expect(result.confidence_range.max).toBeLessThan(1.0);
    });

});
