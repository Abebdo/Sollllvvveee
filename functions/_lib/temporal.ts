import { Env, TemporalAnalysis } from './types';

export async function analyzeTemporal(
    env: Env,
    cacheKey: string,
    currentScore: number
): Promise<TemporalAnalysis> {
    try {
        // Look up the *previous* analysis.
        // NOTE: In a real system, we might need a separate history store.
        // For now, we check if the current cache key exists BEFORE we overwrite it.
        // However, the cacheKey is typically versioned.

        const cachedString = await env.ANALYSIS_CACHE.get(cacheKey);

        if (!cachedString) {
            return {
                last_score: null,
                delta: null,
                trend: 'insufficient_data',
                velocity: null
            };
        }

        const cached = JSON.parse(cachedString);
        const lastScore = cached.riskScore;

        if (typeof lastScore !== 'number') {
             return {
                last_score: null,
                delta: null,
                trend: 'insufficient_data',
                velocity: null
            };
        }

        const delta = currentScore - lastScore;
        let trend: 'improving' | 'degrading' | 'stable' = 'stable';

        // Threshold for change significance
        if (delta > 5) trend = 'degrading'; // Risk significantly increasing
        else if (delta < -5) trend = 'improving'; // Risk significantly decreasing

        return {
            last_score: lastScore,
            delta,
            trend,
            velocity: delta // Simple velocity
        };

    } catch (e) {
        console.warn('Temporal analysis failed', e);
         return {
            last_score: null,
            delta: null,
            trend: 'insufficient_data',
            velocity: null
        };
    }
}
