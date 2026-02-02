import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost as analyzeUrl } from '../../functions/analyze/url';
import { onRequestPost as analyzeText } from '../../functions/analyze/text';
import { onRequestPost as analyzeLegacy } from '../../functions/analyze/index';
import { onRequestPost as analyzeCanonical } from '../../functions/api/analyze/index';
import { onRequestGet as healthCheck } from '../../functions/api/health';

// Mock Env
class MockKV {
    store: Record<string, string> = {};
    async get(key: string) { return this.store[key] || null; }
    async put(key: string, value: string) { this.store[key] = value; }
    async list(options?: any) { return { keys: [], list_complete: true }; }
    clear() { this.store = {}; }
}

const mockEnv = {
    ANALYSIS_CACHE: new MockKV(),
    AI: {}
} as any;

const createMockContext = (body: any) => {
    return {
        request: {
            method: 'POST',
            url: 'https://api.solveya.com/analyze',
            headers: {
                get: (key: string) => {
                    if(key==='CF-Connecting-IP') return '1.2.3.4';
                    if(key==='User-Agent') return 'test-ua';
                    return null;
                }
            },
            json: async () => body
        } as unknown as Request,
        env: mockEnv,
        params: {},
        waitUntil: (promise: Promise<any>) => {},
        passThroughOnException: () => {},
        next: () => {},
        data: {},
        functionPath: ''
    } as any;
};

// Mock Fetch Global
global.fetch = vi.fn();

describe('System Restoration Verification', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv.ANALYSIS_CACHE.clear();
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://example.com',
            text: async () => '<html><body>Content</body></html>',
            headers: new Map()
        });
    });

    it('should successfully analyze URL via /analyze/url', async () => {
        // Mock fetch to return google.com to avoid expansion to example.com
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://google.com',
            text: async () => '<html><body>Google Search</body></html>',
            headers: new Map()
        });
        const ctx = createMockContext({ artifact: 'https://google.com' });
        const res = await analyzeUrl(ctx);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.ok).toBe(true);
        expect(data.data.verdict).toBeDefined();
        // Check engine execution
        expect(data.data.confidence).toBeGreaterThan(0);
        expect(data.data.root_trusted).toBe(true); // Google is root trusted
    });

    it('should successfully analyze Text via /analyze/text', async () => {
        const ctx = createMockContext({ artifact: 'Suspicious text content' });
        const res = await analyzeText(ctx);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.ok).toBe(true);
        expect(data.data.verdict).toBeDefined();
    });

    it('should successfully analyze via canonical API /api/analyze', async () => {
        const ctx = createMockContext({ artifact: 'https://paypal.com' });
        const res = await analyzeCanonical(ctx);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.ok).toBe(true);
        expect(data.data.final_assessment).toBeDefined();
    });

    it('should successfully analyze via legacy API /analyze', async () => {
        const ctx = createMockContext({ artifact: 'https://example.com' });
        const res = await analyzeLegacy(ctx);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.ok).toBe(true);
    });

    it('should pass health check with DB verification', async () => {
        const ctx = createMockContext({});
        const res = await healthCheck(ctx);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.status).toBe('alive');
        expect(data.checks.kv).toBe('connected');
    });

    it('should fail health check if KV is missing', async () => {
        const badCtx = createMockContext({});
        badCtx.env = { ...mockEnv, ANALYSIS_CACHE: undefined }; // Simulate missing binding
        const res = await healthCheck(badCtx);
        expect(res.status).toBe(500);
    });
});
