import { describe, it, expect, vi } from 'vitest';
import { onRequestGet } from '../../functions/api/health';

class MockKV {
    store: Record<string, string> = {};
    async get(key: string) { return this.store[key] || null; }
    async put(key: string, value: string) { this.store[key] = value; }
}

describe('Backend Health Check', () => {
    it('should return operational status when environment is correct', async () => {
        const mockEnv = {
            ANALYSIS_CACHE: new MockKV()
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
        expect(data.status).toBe('operational');
        expect(data.services.database).toBe('connected');
    });

    it('should return operational but DB disconnected if env is missing', async () => {
         const mockEnv = {
            // No ANALYSIS_CACHE
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
        expect(response.status).toBe(200); // Still 200 as service is up

        const data = await response.json() as any;
        expect(data.status).toBe('operational');
        expect(data.services.database).toContain('disconnected');
    });
});
