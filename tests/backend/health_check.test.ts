import { describe, it, expect, vi } from 'vitest';
import { onRequestGet } from '../../functions/api/health';

class MockKV {
    store: Record<string, string> = {};
    async get(key: string) { return this.store[key] || null; }
    async put(key: string, value: string) { this.store[key] = value; }
}

describe('Backend Health Check', () => {
    it('should return ok status when environment is correct', async () => {
        const mockEnv = {
            ANALYSIS_CACHE: new MockKV(),
            AI: {} // Mock AI binding
        } as any;

        const context = {
            env: mockEnv,
            request: new Request('http://localhost/api/health'),
            functionPath: '',
            waitUntil: vi.fn(),
            next: vi.fn(),
            params: {},
            data: {}
        } as any;

        const response = await onRequestGet(context);
        expect(response.status).toBe(200);

        const data = await response.json() as any;
        expect(data.status).toBe('ok');
        expect(data.engine).toBe('solveya-analysis');
        expect(data._diagnostics).toBeUndefined();
    });

    it('should return degraded status if env is missing', async () => {
         const mockEnv = {
            // No ANALYSIS_CACHE
            // No AI
        } as any;

        const context = {
            env: mockEnv,
            request: new Request('http://localhost/api/health'),
            functionPath: '',
            waitUntil: vi.fn(),
            next: vi.fn(),
            params: {},
            data: {}
        } as any;

        const response = await onRequestGet(context);
        expect(response.status).toBe(200);

        const data = await response.json() as any;
        expect(data.status).toBe('degraded');
        expect(data._diagnostics).toContain('ANALYSIS_CACHE missing');
    });

    it('should return error status if KV fails', async () => {
        const mockKV = new MockKV();
        mockKV.get = vi.fn().mockRejectedValue(new Error('Connection failure'));

        const mockEnv = {
            ANALYSIS_CACHE: mockKV,
            AI: {}
        } as any;

        const context = {
            env: mockEnv,
            request: new Request('http://localhost/api/health'),
            functionPath: '',
            waitUntil: vi.fn(),
            next: vi.fn(),
            params: {},
            data: {}
        } as any;

        const response = await onRequestGet(context);
        expect(response.status).toBe(200);

        const data = await response.json() as any;
        expect(data.status).toBe('error');
        expect(data._diagnostics[0]).toContain('KV access failed');
    });
});
