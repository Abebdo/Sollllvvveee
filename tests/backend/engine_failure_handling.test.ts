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

    it('should SUCCEED for benign domain (was failing with 500)', async () => {
        const req = mockRequest({ artifact: 'https://example.com', forceRefresh: true });

        try {
            const res = await handleAnalysisRequest(req, mockEnv);
            const data = await res.json() as any;

            console.log('Analysis Result Status:', res.status);
            if (res.status !== 200) {
                 console.log('Analysis Result Data:', JSON.stringify(data, null, 2));
            }

            expect(res.status).toBe(200);
            const result = data.data as AnalysisResult;
            expect(result.verdict).toBe('BENIGN');
            expect(result.signals.length).toBeGreaterThan(0);
            expect(result.signals).toContain('reputation_neutral');

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

            console.log('Analysis Result Status:', res.status);
            console.log('Analysis Result Data:', JSON.stringify(data, null, 2));

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
