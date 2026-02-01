import { Env, AnalysisRequest, AnalysisResult, RiskVerdict } from './types';
import { validateInput, sanitizeInput, classifyArtifact } from './validation';
import { RateLimiter } from './ratelimit';
import { analyzeHeuristic } from './engines/heuristic';

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function handleAnalysisRequest(request: Request, env: Env): Promise<Response> {
    // 1. Rate Limiting
    const clientIp = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    const rateLimiter = new RateLimiter(env, clientIp);
    const rlStatus = await rateLimiter.check();

    if (rlStatus.limited) {
        return new Response(JSON.stringify({
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests. Please try again later.'
            }
        }), {
            status: 429,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Retry-After': String(rlStatus.retryAfter || 60),
                'X-RateLimit-Limit': '30',
                'X-RateLimit-Remaining': String(rlStatus.remaining),
                'X-RateLimit-Reset': String(rlStatus.reset)
            }
        });
    }

    // 2. Parse Body
    let body: AnalysisRequest;
    try {
        body = await request.json() as AnalysisRequest;
    } catch (e) {
        return new Response(JSON.stringify({
            error: { code: 'INVALID_JSON', message: 'Invalid JSON body' }
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const rawArtifact = body.artifact;

    // 3. Validation
    const validation = validateInput(rawArtifact);
    if (!validation.valid) {
        return new Response(JSON.stringify({
            error: { code: 'INVALID_INPUT', message: validation.error }
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const artifact = sanitizeInput(rawArtifact);
    const type = classifyArtifact(artifact);

    // 4. Cache Lookup
    // Key must include logic version to invalidate old mock data if needed, or we just trust the new key structure
    const cacheKey = `v2:analysis:${type}:${encodeURIComponent(artifact)}`;

    if (!body.forceRefresh) {
        try {
            const cached: any = await env.ANALYSIS_CACHE.get(cacheKey, 'json');
            if (cached) {
                const newId = crypto.randomUUID();
                // Store retrieval ID mapping
                await env.ANALYSIS_CACHE.put(newId, JSON.stringify(cached), { expirationTtl: 86400 });

                return new Response(JSON.stringify({
                    id: newId,
                    timestamp: new Date().toISOString(),
                    status: 'completed',
                    result: { ...cached, meta: { ...cached.meta, cached: true } }
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        } catch (e) {
            console.warn('Cache lookup failed', e);
        }
    }

    // 5. Analysis Execution (Deterministic)
    const start = Date.now();
    const heuristicResult = analyzeHeuristic(artifact, type);

    let verdict: RiskVerdict = 'UNKNOWN';
    if (heuristicResult.score > 80) verdict = 'MALICIOUS';
    else if (heuristicResult.score > 50) verdict = 'SUSPICIOUS';
    else verdict = 'BENIGN';

    const result: AnalysisResult = {
        artifact: { raw: rawArtifact, type, canonical: artifact },
        verdict,
        riskScore: heuristicResult.score,
        confidence: 0.9, // High confidence in deterministic rules
        summary: heuristicResult.summary,
        features: heuristicResult.features,
        explanation: {
            primaryFactors: Object.values(heuristicResult.features).map(f => f.description),
            technicalAnalysis: heuristicResult.explanation,
            recommendedActions: verdict === 'MALICIOUS' ? ['Block Traffic', 'Quarantine Asset'] : (verdict === 'SUSPICIOUS' ? ['Monitor Activity', 'Verify Source'] : ['No Action Required'])
        },
        meta: {
            executionTimeMs: Date.now() - start,
            cached: false,
            tierUsed: ['TIER_1_LOCAL'],
            modelVersion: 'v2.0.0-heuristic'
        }
    };

    // 6. Cache Storage
    try {
        // Store by Artifact (dedupe)
        await env.ANALYSIS_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 });

        // Store by ID (retrieval)
        const resultId = crypto.randomUUID();
        await env.ANALYSIS_CACHE.put(resultId, JSON.stringify(result), { expirationTtl: 86400 });

        return new Response(JSON.stringify({
            id: resultId,
            timestamp: new Date().toISOString(),
            status: 'completed',
            result
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (e) {
        console.error('Cache write failed', e);
        // Return anyway
        return new Response(JSON.stringify({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            status: 'completed',
            result
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
}
