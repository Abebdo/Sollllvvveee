import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAnalysisRequest } from '../../functions/_lib/orchestrator';
import { AnalysisResult } from '../../functions/_lib/types';

// Mock Env
class MockKV {
    store: Record<string, string> = {};
    async get(key: string) { return this.store[key] || null; }
    async put(key: string, value: string) { this.store[key] = value; }
    clear() { this.store = {}; }
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
        mockEnv.ANALYSIS_CACHE.clear(); // Clear cache!

        // Default safe response
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://example.com',
            text: async () => '<html><body>Safe content</body></html>',
            headers: new Map()
        });
    });

    // 1. Google Docs Phishing (Conflict Resolution)
    it('should detect Google Docs Phishing and trigger Conflict Resolution', async () => {
        // Mock content to have a password field
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://docs.google.com/forms/d/e/12345/viewform',
            text: async () => '<html><body><form><input type="password" name="p"></form></body></html>',
            headers: new Map()
        });

        const req = mockRequest({ artifact: 'https://docs.google.com/forms/d/e/12345/viewform' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        // Expectations
        expect(result.verdict).toMatch(/SUSPICIOUS|MALICIOUS/);
        expect(result.conflict_resolution).toBeDefined();
        // Google Docs is trusted infrastructure, so Reputation=0. Intent=Malicious.
        expect(result.conflict_resolution?.conflict_detected).toBe(true);
        expect(result.conflict_resolution?.winning_signal).toBe('INTENT'); // Intent beats Reputation

        // Semantic check
        if (result.semantic_intent) {
             expect(result.semantic_intent.indicators.some((s: string) => s.includes('password'))).toBe(true);
        }

        // Confidence should not be 100%
        expect(result.confidence).toBeLessThan(0.96);

        // Explanation style
        expect(result.analyst_insight?.analyst_summary).toMatch(/Although.*however.*therefore/i);
    });

    // 2. Homoglyph (paypaI.com)
    it('should detect homoglyphs and classify as High Risk', async () => {
        const req = mockRequest({ artifact: 'paypaI.com' }); // Capital i
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.signals).toContain('typosquatting');
        expect(result.verdict).toMatch(/SUSPICIOUS|MALICIOUS/);
    });

    // 3. Subdomain Abuse (google.com.evil.com)
    it('should detect subdomain abuse', async () => {
        const req = mockRequest({ artifact: 'google.com.evil.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.signals).toContain('subdomain_abuse');
        expect(result.verdict).toBe('MALICIOUS');

        // Calibration Check for Malicious: [0.65, 0.90]
        expect(result.confidence).toBeGreaterThanOrEqual(0.65);
        expect(result.confidence).toBeLessThanOrEqual(0.90);
    });

    // 4. URL Shortener Expansion
    it('should expand URL shorteners and detect phishing', async () => {
         // Mock expansion logic
         (global.fetch as any).mockImplementation(async (url: string, opts: any) => {
            if (url.includes('bit.ly') && opts?.method === 'HEAD') {
                return {
                    url: 'https://evil.com/login',
                    ok: true,
                    status: 200,
                    headers: new Map(),
                    text: async () => ''
                };
            }
             if (url.includes('evil.com')) {
                 return {
                     ok: true,
                     status: 200,
                     url: 'https://evil.com/login',
                     text: async () => '<html><form><input type="password"></form></html>', // Phishing
                     headers: new Map()
                 };
             }
            return { ok: true, status: 200, text: async () => '' };
        });

        const req = mockRequest({ artifact: 'https://bit.ly/suspicious' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        // It should detect the evil.com logic
        expect(result.verdict).toMatch(/SUSPICIOUS|MALICIOUS/);
    });

    // 5. Embedded Credentials
    it('should detect embedded credentials', async () => {
        // Ensure expandUrl doesn't strip credentials by returning same URL
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'http://user:pass@example.com', // Must match input
            text: async () => '<html>Safe</html>',
            headers: new Map()
        });

        const req = mockRequest({ artifact: 'http://user:pass@example.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.signals).toContain('embedded_auth');
        expect(result.verdict).toBe('MALICIOUS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.60); // Directive says never below 60
    });

    // 7. Fragility & Confidence Range
    it('should show HIGH fragility and wide confidence range for sparse data', async () => {
        // Mock empty/unknown response
        (global.fetch as any).mockResolvedValue({
             ok: true, status: 200, text: async () => ''
        });

        const req = mockRequest({ artifact: 'https://unknown-entity.xyz' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.fragility?.level).toMatch(/MEDIUM|HIGH/);

        const range = result.confidence_range;
        expect(range.min).toBeLessThan(range.mostLikely);
        expect(range.max).toBeGreaterThan(range.mostLikely);
        // Expect string uncertainty
        expect(['MEDIUM', 'HIGH']).toContain(range.uncertainty);
    });

    // 8. 100% Confidence Forbidden
    it('should NEVER return 100% confidence', async () => {
        // Ensure expandUrl doesn't strip malicious subdomain by returning same URL
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'http://google.com.evil.com/login',
            text: async () => '<html>Safe</html>',
            headers: new Map()
        });

        const req = mockRequest({ artifact: 'http://google.com.evil.com/login' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.confidence).toBeLessThan(1.0);
        expect(result.confidence_range?.max).toBeLessThan(1.0);
    });

    // 9. Context Aware (Email -> Suspicious)
    it('should downgrade Legitimate to Suspicious if Context is Email', async () => {
        // Mock safe content
        (global.fetch as any).mockResolvedValue({
             ok: true,
             status: 200,
             url: 'https://example.com',
             text: async () => '<html>Safe</html>'
        });

        const req = mockRequest({
            artifact: 'https://example.com',
            context: { source: 'email' },
            forceRefresh: true // Bypass cache
        });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        // Example.com is safe (Benign), but Email context should force Suspicious
        expect(result.verdict).toBe('SUSPICIOUS');
        expect(result.contextual_verdict?.context_downgrade).toBe(true);
    });

    // 10. Phase 1: Epistemic Profile Verification
    it('should include a detailed Epistemic Profile', async () => {
        const req = mockRequest({ artifact: 'https://example.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.epistemic_profile).toBeDefined();
        expect(result.epistemic_profile?.confidence_range).toBeDefined();
        expect(result.epistemic_profile?.what_would_change_verdict).toBeInstanceOf(Array);
        expect(result.epistemic_profile?.uncertainty_sources).toBeInstanceOf(Array);

        // Check confidence range consistency
        const range = result.epistemic_profile?.confidence_range;
        if (range) {
            expect(range.min).toBeLessThanOrEqual(range.mostLikely);
            expect(range.max).toBeGreaterThanOrEqual(range.mostLikely);
        }
    });

    // 11. Phase 1: Trusted Infrastructure Abuse
    it('should detect Trusted Infrastructure Abuse when intent is Malicious', async () => {
        // Mock semantic intent as MALICIOUS for a trusted domain
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://docs.google.com/forms/d/e/12345/viewform',
            text: async () => '<html><body><form><input type="password" name="p"></form></body></html>', // Phishing indicator
            headers: new Map()
        });

        const req = mockRequest({ artifact: 'https://docs.google.com/forms/d/e/12345/viewform' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.infrastructure_intel?.trusted_infra_abuse).toBe(true);
        expect(result.infrastructure_intel?.abuse_type).toContain('Trusted infrastructure abused');
        expect(result.why_it_matters[0]).toContain('CRITICAL: Trusted infrastructure');
    });

    // 12. Phase 1: Contextual Verdict Multiplexing
    it('should generate Contextual Verdicts and detect divergence', async () => {
        // Use a trusted domain so base verdict is likely BENIGN
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://example.com',
            text: async () => '<html>Safe</html>',
            headers: new Map()
        });

        const req = mockRequest({ artifact: 'https://example.com' }); // Benign by default
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.contextual_verdicts).toBeDefined();
        expect(result.contextual_verdicts?.email).toBe('SUSPICIOUS'); // Email context should downgrade example.com

        // Check fragility increase or uncertainty flag if divergent
        expect(result.uncertainty_flags).toContain('This artifact is context-dependent and unsafe to generalize.');
    });

});
