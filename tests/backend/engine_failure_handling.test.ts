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

// Mock Fetch Global - Pure benign content
global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    url: 'https://example.com',
    text: async () => '<html><body>Hello world. No forms.</body></html>',
    headers: new Map()
});

describe('Root Cause Analysis Verification', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv.ANALYSIS_CACHE.clear();
    });

    it('should SUCCEED for benign domain with REAL PROOF-OF-WORK signals', async () => {
        const req = mockRequest({ artifact: 'https://example.com', forceRefresh: true });

        try {
            const res = await handleAnalysisRequest(req, mockEnv);
            const data = await res.json() as any;

            expect(res.status).toBe(200);
            const result = data.data as AnalysisResult;

            expect(result.verdict).toBe('BENIGN');
            expect(result.signals.length).toBeGreaterThan(0);

            // Assert exact proof-of-work signals, not just 'neutral' placeholders
            expect(result.signals).toContain('reputation_sources_checked'); // Evidence of list checking
            expect(result.signals).toContain('structure_entropy_verified'); // Evidence of calculation
            expect(result.signals).toContain('heuristic_checks_passed');    // Evidence of pattern matching

            // Check that features actually contain evidence
            const repFeature = result.features['reputation_sources_checked'];
            expect(repFeature).toBeDefined();
            expect(repFeature.evidence[0]).toContain('Checked');

            const structFeature = result.features['structure_entropy_verified'];
            expect(structFeature).toBeDefined();
            expect(structFeature.evidence[0]).toContain('Entropy:');

        } catch (e) {
            console.error('Test Execution Failed:', e);
            throw e;
        }
    });

    it('should FAIL EXPLICITLY for invalid URL', async () => {
        const req = mockRequest({ artifact: 'http://google.com:99999', forceRefresh: true });

        try {
            const res = await handleAnalysisRequest(req, mockEnv);
            const data = await res.json() as any;

            // Should be 500 (Internal Error) but with EngineFailureError details
            expect(res.status).toBe(500);
            expect(data.error_code).toBe('E_ENGINE_FAILURE'); // We expect code from EngineFailureError
            expect(data.message).toContain('root_trust failed: Invalid URL');

        } catch (e) {
            console.error('Test Execution Failed:', e);
            throw e;
        }
    });
});
