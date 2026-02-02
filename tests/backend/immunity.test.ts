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

describe('Infrastructure Immunity & Context Boundaries', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv.ANALYSIS_CACHE.clear();

        // Default safe
         (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://example.com',
            text: async () => '<html><body>Safe</body></html>',
            headers: new Map()
        });
    });

    it('should grant immunity to Infrastructure Root (google.com)', async () => {
        const req = mockRequest({ artifact: 'google.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.root_trusted).toBe(true);
        expect(result.final_assessment).toBe('SAFE');
        expect(result.verdict).toBe('BENIGN');
        expect(result.riskScore).toBe(0);

        // Verify Explanation
        expect(result.analyst_insight.analyst_summary).toBe("This domain is a globally trusted infrastructure root. Content-level threat analysis is not applicable at this level.");
        expect(result.analyst_insight.analyst_takeaways).toContain("Infrastructure Trust Confirmed");

        // Verify Engine Gating
        // If 'semantic' didn't run, it won't be in `weights`
        expect(result.explanation.weights['semantic']).toBeUndefined();
    });

    it('should analyze Content Artifacts on Trusted Services (docs.google.com/phishing)', async () => {
         // Mock content to be malicious to trigger detection
         (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://docs.google.com/document/d/phishing',
            text: async () => '<html><form><input type="password"></form></html>', // Triggers semantic malicious
            headers: new Map()
        });

        const req = mockRequest({ artifact: 'https://docs.google.com/document/d/phishing' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.root_trusted).toBe(true);
        expect(result.final_assessment).toBe('TRUSTED_SERVICE_ABUSED');
        // Semantic should have run
        expect(result.explanation.weights['semantic']).toBeDefined();
    });

});
