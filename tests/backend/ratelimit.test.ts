import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../../functions/_lib/ratelimit';

class MockKV {
    store: Record<string, string> = {};
    async get(key: string) { return this.store[key] || null; }
    async put(key: string, value: string) { this.store[key] = value; }
}

describe('RateLimiter', () => {
    it('should allow initial request', async () => {
        const kv = new MockKV();
        const rl = new RateLimiter({ ANALYSIS_CACHE: kv } as any, '127.0.0.1');
        const result = await rl.check();
        expect(result.limited).toBe(false);
    });

    it('should limit after burst exceeded', async () => {
        const kv = new MockKV();
        const rl = new RateLimiter({ ANALYSIS_CACHE: kv } as any, '127.0.0.1');

        // Burst limit is 30. RateLimiter increments AFTER check returns false.
        // So checking 30 times consumes 30 slots (0 to 29).
        // 31st check should fail.

        for(let i=0; i<30; i++) {
            const res = await rl.check();
            expect(res.limited).toBe(false);
        }

        const result = await rl.check();
        expect(result.limited).toBe(true);
    });
});
