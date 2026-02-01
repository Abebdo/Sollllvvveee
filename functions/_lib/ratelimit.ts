import { Env } from './types';

export interface RateLimitResult {
    limited: boolean;
    remaining: number;
    reset: number; // Unix timestamp
    retryAfter?: number; // Seconds
    limit: number;
}

export class RateLimiter {
    private env: Env;
    private ip: string;
    private userAgent: string;
    private fingerprint: string | null = null;

    // Config
    private static BURST_LIMIT = 30; // 30 req / min per IP
    private static SUSTAINED_LIMIT = 500; // 500 req / hour per IP

    // Fingerprint limits (stricter to catch bots rotating IPs)
    private static FP_BURST_LIMIT = 30;

    constructor(env: Env, request: Request) {
        this.env = env;
        this.ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
        this.userAgent = request.headers.get('User-Agent') || '';
    }

    private async getFingerprint(): Promise<string> {
        if (this.fingerprint) return this.fingerprint;

        const data = `${this.userAgent}-${this.ip.split('.').slice(0, 3).join('.')}`; // Subnet + UA
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        this.fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);

        return this.fingerprint;
    }

    async check(weight: number = 1): Promise<RateLimitResult> {
        const fingerprint = await this.getFingerprint();
        const now = Math.floor(Date.now() / 1000);
        const currentMinute = Math.floor(now / 60);
        const currentHour = Math.floor(now / 3600);

        const keys = {
            ipBurst: `rl:burst:${this.ip}:${currentMinute}`,
            ipSus: `rl:sus:${this.ip}:${currentHour}`,
            fpBurst: `rl:fp:${fingerprint}:${currentMinute}`
        };

        const results = await Promise.all([
            this.env.ANALYSIS_CACHE.get(keys.ipBurst),
            this.env.ANALYSIS_CACHE.get(keys.ipSus),
            this.env.ANALYSIS_CACHE.get(keys.fpBurst)
        ]);

        const counts = {
            ipBurst: parseInt(results[0] || '0'),
            ipSus: parseInt(results[1] || '0'),
            fpBurst: parseInt(results[2] || '0')
        };

        // Check Limits
        if (counts.ipBurst + weight > RateLimiter.BURST_LIMIT) {
             return this.reject((currentMinute + 1) * 60, RateLimiter.BURST_LIMIT);
        }

        if (counts.ipSus + weight > RateLimiter.SUSTAINED_LIMIT) {
             return this.reject((currentHour + 1) * 3600, RateLimiter.SUSTAINED_LIMIT);
        }

        if (counts.fpBurst + weight > RateLimiter.FP_BURST_LIMIT) {
             return this.reject((currentMinute + 1) * 60, RateLimiter.FP_BURST_LIMIT);
        }

        // Increment
        try {
            await Promise.all([
                this.env.ANALYSIS_CACHE.put(keys.ipBurst, (counts.ipBurst + weight).toString(), { expirationTtl: 120 }),
                this.env.ANALYSIS_CACHE.put(keys.ipSus, (counts.ipSus + weight).toString(), { expirationTtl: 7200 }),
                this.env.ANALYSIS_CACHE.put(keys.fpBurst, (counts.fpBurst + weight).toString(), { expirationTtl: 120 })
            ]);
        } catch (e) {
            console.error('Rate limit write failed', e);
        }

        const remaining = Math.min(
            RateLimiter.BURST_LIMIT - counts.ipBurst - weight,
            RateLimiter.SUSTAINED_LIMIT - counts.ipSus - weight
        );

        return {
            limited: false,
            remaining: Math.max(0, remaining),
            reset: (currentMinute + 1) * 60,
            limit: RateLimiter.BURST_LIMIT
        };
    }

    private reject(reset: number, limit: number): RateLimitResult {
        const now = Math.floor(Date.now() / 1000);
        return {
            limited: true,
            remaining: 0,
            reset: reset,
            retryAfter: Math.max(0, reset - now),
            limit: limit
        };
    }
}
