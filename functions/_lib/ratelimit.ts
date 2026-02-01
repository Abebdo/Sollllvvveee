import { Env } from './types';

interface RateLimitResult {
    limited: boolean;
    remaining: number;
    reset: number; // Unix timestamp
    retryAfter?: number; // Seconds
}

export class RateLimiter {
    private env: Env;
    private ip: string;

    // Config
    private static BURST_LIMIT = 30; // 30 req / min
    private static SUSTAINED_LIMIT = 500; // 500 req / hour

    constructor(env: Env, ip: string) {
        this.env = env;
        this.ip = ip;
    }

    async check(): Promise<RateLimitResult> {
        const now = Math.floor(Date.now() / 1000);
        const currentMinute = Math.floor(now / 60);
        const currentHour = Math.floor(now / 3600);

        const burstKey = `rl:burst:${this.ip}:${currentMinute}`;
        const sustainedKey = `rl:sus:${this.ip}:${currentHour}`;

        // Using Promise.all for parallel KV checks
        const [burstCountStr, sustainedCountStr] = await Promise.all([
            this.env.ANALYSIS_CACHE.get(burstKey),
            this.env.ANALYSIS_CACHE.get(sustainedKey)
        ]);

        const burstCount = parseInt(burstCountStr || '0');
        const sustainedCount = parseInt(sustainedCountStr || '0');

        if (burstCount >= RateLimiter.BURST_LIMIT) {
             return {
                 limited: true,
                 remaining: 0,
                 reset: (currentMinute + 1) * 60,
                 retryAfter: ((currentMinute + 1) * 60) - now
             };
        }

        if (sustainedCount >= RateLimiter.SUSTAINED_LIMIT) {
             return {
                 limited: true,
                 remaining: 0,
                 reset: (currentHour + 1) * 3600,
                 retryAfter: ((currentHour + 1) * 3600) - now
             };
        }

        // Increment counts (Fire and forget wait, but we need to ensure it happens)
        // We use expirationTtl to auto-cleanup
        try {
            await Promise.all([
                this.env.ANALYSIS_CACHE.put(burstKey, (burstCount + 1).toString(), { expirationTtl: 120 }), // 2 mins
                this.env.ANALYSIS_CACHE.put(sustainedKey, (sustainedCount + 1).toString(), { expirationTtl: 7200 }) // 2 hours
            ]);
        } catch (e) {
            console.warn('Rate limit write failed', e);
            // Fail open if KV is down, but log it
        }

        return {
            limited: false,
            remaining: Math.min(
                RateLimiter.BURST_LIMIT - burstCount - 1,
                RateLimiter.SUSTAINED_LIMIT - sustainedCount - 1
            ),
            reset: (currentMinute + 1) * 60
        };
    }
}
