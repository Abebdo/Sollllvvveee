import { Env } from '../types';

export interface AnalyticalMemoryResult {
    seen_count: number;
    first_seen: string; // ISO date
    last_seen: string;
    volatility: number; // Variance of score
    average_score: number;
    trend_classification: 'stable' | 'volatile' | 'escalating' | 'novel';
    history_scores: number[];
}

interface MemoryRecord {
    first_seen: number;
    last_seen: number;
    count: number;
    scores: number[]; // Keep last N scores to calc variance
}

/**
 * Analytical Memory
 *
 * Stores hashed artifact patterns and tracks recurrence/drift.
 * Makes the system experience-aware without ML.
 */

export async function consultMemory(env: Env, artifact: string): Promise<AnalyticalMemoryResult> {
    const key = await getMemoryKey(artifact);
    let dataStr: string | null = null;

    try {
        dataStr = await env.ANALYSIS_CACHE.get(key);
    } catch (e) {
        console.error('Memory lookup failed', e);
        // Fail open
    }

    if (!dataStr) {
        return {
            seen_count: 0,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            volatility: 0,
            average_score: 0,
            trend_classification: 'novel'
        };
    }

    const record: MemoryRecord = JSON.parse(dataStr);

    // Calculate stats
    const avg = record.scores.reduce((a, b) => a + b, 0) / record.scores.length;
    const variance = record.scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / record.scores.length;
    const stdDev = Math.sqrt(variance);

    let trend: 'stable' | 'volatile' | 'escalating' | 'novel' = 'stable';

    if (stdDev > 15) {
        trend = 'volatile';
    } else if (record.scores.length >= 3) {
        // Simple linear check: is the latest score significantly higher than the average?
        const latest = record.scores[record.scores.length - 1];
        if (latest > avg + 10) {
            trend = 'escalating';
        }
    }

    return {
        seen_count: record.count,
        first_seen: new Date(record.first_seen).toISOString(),
        last_seen: new Date(record.last_seen).toISOString(),
        volatility: parseFloat(stdDev.toFixed(2)),
        average_score: parseFloat(avg.toFixed(2)),
        trend_classification: trend,
        history_scores: record.scores
    };
}

export async function updateMemory(env: Env, artifact: string, score: number) {
    const key = await getMemoryKey(artifact);

    let record: MemoryRecord;
    const now = Date.now();

    try {
        const dataStr = await env.ANALYSIS_CACHE.get(key);
        if (dataStr) {
            record = JSON.parse(dataStr);
            record.last_seen = now;
            record.count += 1;
            record.scores.push(score);
            if (record.scores.length > 10) record.scores.shift(); // Keep last 10
        } else {
            record = {
                first_seen: now,
                last_seen: now,
                count: 1,
                scores: [score]
            };
        }

        // Persist with long TTL (30 days)
        await env.ANALYSIS_CACHE.put(key, JSON.stringify(record), { expirationTtl: 2592000 });
    } catch (e) {
        console.error('Memory update failed', e);
    }
}

async function getMemoryKey(artifact: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(artifact);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `memory:v1:${hashHex}`;
}

export interface CampaignMemoryResult {
    campaign_id: string | null;
    related_count: number;
    confidence: number;
}

interface CampaignRecord {
    count: number;
    first_seen: number;
    last_seen: number;
    artifacts: string[]; // Store last 5 artifacts
}

export async function consultCampaignMemory(env: Env, fingerprint: string): Promise<CampaignMemoryResult> {
    const key = `campaign:v1:${fingerprint}`;
    let dataStr: string | null = null;

    try {
        dataStr = await env.ANALYSIS_CACHE.get(key);
    } catch (e) {
        // Fail open
    }

    if (!dataStr) {
        return {
            campaign_id: null,
            related_count: 0,
            confidence: 0
        };
    }

    const record: CampaignRecord = JSON.parse(dataStr);

    // Confidence based on count and recency
    let confidence = 0;
    if (record.count > 5) confidence = 0.6;
    if (record.count > 20) confidence = 0.8;

    return {
        campaign_id: fingerprint,
        related_count: record.count,
        confidence
    };
}

export async function updateCampaignMemory(env: Env, fingerprint: string, artifact: string) {
    const key = `campaign:v1:${fingerprint}`;
    let record: CampaignRecord;
    const now = Date.now();

    try {
        const dataStr = await env.ANALYSIS_CACHE.get(key);
        if (dataStr) {
            record = JSON.parse(dataStr);
            record.last_seen = now;
            record.count += 1;
            if (!record.artifacts.includes(artifact)) {
                record.artifacts.push(artifact);
                if (record.artifacts.length > 5) record.artifacts.shift();
            }
        } else {
            record = {
                first_seen: now,
                last_seen: now,
                count: 1,
                artifacts: [artifact]
            };
        }
        await env.ANALYSIS_CACHE.put(key, JSON.stringify(record), { expirationTtl: 2592000 });
    } catch (e) {
        console.error('Campaign memory update failed', e);
    }
}
