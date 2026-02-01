import { describe, it, expect } from 'vitest';
import { handleAnalysisRequest } from '../../functions/_lib/orchestrator';

// Mock Env
class MockKV {
    store: Record<string, string> = {};
    async get(key: string) { return this.store[key] || null; }
    async put(key: string, value: string) { this.store[key] = value; }
}

const mockEnv = {
    ANALYSIS_CACHE: new MockKV(),
    AI: {} // Not used yet
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

describe('API Integration', () => {
    it('should return 200 and formatted response', async () => {
        const req = mockRequest({ artifact: 'google.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        expect(res.status).toBe(200);

        const data = await res.json() as any;
        expect(data.ok).toBe(true);
        expect(data.result).toBeDefined(); // Legacy
        expect(data.data).toBeDefined(); // New structure
        expect(data.data.verdict).toBeDefined();
    });

    it('should handle rate limiting', async () => {
        // We need to trigger rate limit. Mock KV persists in this suite if I reuse mockEnv?
        // Actually I should create fresh env for each test or reuse.

        const env = { ANALYSIS_CACHE: new MockKV(), AI: {} } as any;

        // Burst is 30.
        for(let i=0; i<30; i++) {
             await handleAnalysisRequest(mockRequest({ artifact: 'test.com' }), env);
        }

        const res = await handleAnalysisRequest(mockRequest({ artifact: 'test.com' }), env);
        // Should be 429
        expect(res.status).toBe(429);
        const data = await res.json() as any;
        expect(data.ok).toBe(false);
        expect(data.error_code).toContain('RATE_LIMIT');
    });
});
