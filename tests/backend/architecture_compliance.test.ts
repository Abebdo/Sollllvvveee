import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAnalysisRequest } from '../../functions/_lib/orchestrator';
import { AnalysisResult } from '../../functions/_lib/types';
import { ErrorCode } from '../../functions/_lib/errors';

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

// Mock Fetch
global.fetch = vi.fn().mockImplementation(async (urlOrRequest: string | Request) => {
    const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest.url;

    // Simulate specific behavior if needed, otherwise return same URL (no redirect)
    return {
        ok: true,
        status: 200,
        url: url, // Return input URL to simulate NO redirect by default
        text: async () => '<html></html>',
        headers: new Map()
    };
});

describe('Architecture Compliance', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv.ANALYSIS_CACHE.clear();
    });

    it('1. Google.com must be BENIGN and ROOT TRUSTED', async () => {
        const req = mockRequest({ artifact: 'https://google.com', forceRefresh: true });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;

        if (!data.ok) console.error("Google test failed:", data);

        expect(res.status).toBe(200);
        const result = data.data as AnalysisResult;

        expect(result.verdict).toBe('BENIGN');
        expect(result.root_trusted).toBe(true);
        expect(result.riskScore).toBe(0);
        expect(result.final_assessment).toBe('SAFE');
        expect(result.signals.some(s => s.includes('PASS') || s.includes('check'))).toBe(true);
    });

    it('2. Docs.google.com with Sensitive Keywords must be TRUSTED_SERVICE_ABUSED', async () => {
        const req = mockRequest({
            artifact: 'https://docs.google.com/forms/d/e/xxx/viewform?usp=sf_link&q=password',
            forceRefresh: true
        });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.root_trusted).toBe(true);
        expect(result.final_assessment).toBe('TRUSTED_SERVICE_ABUSED');
        expect(result.verdict).toBe('SUSPICIOUS');
    });

    it('3. PaypaI.com (Homograph) must be MALICIOUS/SUSPICIOUS', async () => {
        const req = mockRequest({ artifact: 'xn--paypa-8ve.com', forceRefresh: true });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.signals).toContain('Punycode Domain Detected');
        expect(result.riskScore).toBeGreaterThan(0);
    });

    it('4. Bit.ly Shortener must be SUSPICIOUS or have Warning', async () => {
        const req = mockRequest({ artifact: 'https://bit.ly/12345', forceRefresh: true });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.signals).toContain('URL Shortener Detected');
    });

    it('5. IP Address URL must be flagged', async () => {
        const req = mockRequest({ artifact: 'http://192.168.1.1', forceRefresh: true });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.signals).toContain('IP Address Usage');
    });

    it('6. Engine Failure MUST NOT 500', async () => {
        // Pass a clearly invalid URL that engines might choke on if not robust
        const req = mockRequest({ artifact: 'invalid-scheme://something', forceRefresh: true });
        const res = await handleAnalysisRequest(req, mockEnv);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.ok).toBe(true);
        expect(data.data.verdict).toBeDefined();
    });
});
