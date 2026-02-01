import { describe, it, expect, vi } from 'vitest';
import { RateLimiter } from '../../functions/_lib/ratelimit';

class MockKV {
    store: Record<string, string> = {};
    async get(key: string) { return this.store[key] || null; }
    async put(key: string, value: string) { this.store[key] = value; }
}

function mockRequest(ip: string = '127.0.0.1', ua: string = 'test-agent') {
    return {
        headers: {
            get: (key: string) => {
                if (key === 'CF-Connecting-IP') return ip;
                if (key === 'User-Agent') return ua;
                return null;
            }
        }
    } as unknown as Request;
}

// Mock crypto for test environment if not available (Vitest usually needs polyfill or setup)
// But Cloudflare Workers environment usually has crypto.subtle.
// If this fails, I might need to mock crypto.subtle.
if (!globalThis.crypto) {
    (globalThis as any).crypto = {
        subtle: {
            digest: async (_algo: string, data: Uint8Array) => {
                // Simple mock hash
                return new TextEncoder().encode('mock-hash-' + new TextDecoder().decode(data));
            }
        }
    }
} else if (!globalThis.crypto.subtle) {
      (globalThis as any).crypto.subtle = {
            digest: async (_algo: string, data: Uint8Array) => {
                // Simple mock hash
                return new TextEncoder().encode('mock-hash-' + new TextDecoder().decode(data));
            }
        }
}


describe('RateLimiter', () => {
    it('should allow initial request', async () => {
        const kv = new MockKV();
        const rl = new RateLimiter({ ANALYSIS_CACHE: kv } as any, mockRequest());
        const result = await rl.check();
        expect(result.limited).toBe(false);
    });

    it('should limit after burst exceeded', async () => {
        const kv = new MockKV();
        const rl = new RateLimiter({ ANALYSIS_CACHE: kv } as any, mockRequest());

        // Burst limit is 30. RateLimiter increments AFTER check returns false.
        for(let i=0; i<30; i++) {
            const res = await rl.check();
            expect(res.limited).toBe(false);
        }

        const result = await rl.check();
        expect(result.limited).toBe(true);
    });

    it('should limit based on fingerprint (shared UA, different IPs)', async () => {
         const kv = new MockKV();
         // Same UA, different IPs in same subnet (mock implementation uses /24 roughly by simple split)
         // Actually my implementation uses `ip.split('.').slice(0, 3).join('.')` -> Class C subnet.

         const req1 = mockRequest('192.168.1.1', 'bot-agent');
         const req2 = mockRequest('192.168.1.2', 'bot-agent');

         const rl1 = new RateLimiter({ ANALYSIS_CACHE: kv } as any, req1);
         const rl2 = new RateLimiter({ ANALYSIS_CACHE: kv } as any, req2);

         // Consume 30 with IP 1
         for(let i=0; i<30; i++) {
             await rl1.check();
         }

         // IP 2 should be blocked because fingerprint is same (Same Subnet + Same UA)
         // Note: My implementation of fingerprint is `userAgent-${ip_subnet}`.
         // So yes, they share the fingerprint.

         const result = await rl2.check();
         expect(result.limited).toBe(true);
    });
});
