import { Env, AnalysisRequest, AnalysisResult, RiskVerdict, FeatureResult, ApiResponse } from './types';
import { validateInput, sanitizeInput, classifyArtifact } from './validation';
import { RateLimiter } from './ratelimit';
import { analyzeHeuristic, analyzeReputation, analyzeStructure, analyzeContext, EngineResult } from './engines';
import { AppError, ErrorCode, createErrorResponse } from './errors';
import { analyzeTemporal } from './temporal';
import { calculateConfidence } from './confidence';
import { buildReasoningGraph } from './reasoning';

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const securityHeaders = {
    ...corsHeaders,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';"
};

export async function handleAnalysisRequest(request: Request, env: Env): Promise<Response> {
    const start = Date.now();
    let rlStatus: any;

    try {
        // 1. Rate Limiting
        const rateLimiter = new RateLimiter(env, request);
        rlStatus = await rateLimiter.check(1); // Weight 1

        if (rlStatus.limited) {
            throw new AppError(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', 429, {
                retryAfter: rlStatus.retryAfter
            });
        }
    } catch (e) {
        if (e instanceof AppError) return createErrorResponse(e);
        console.error('Rate limit check failed', e);
    }

    const rlHeaders = rlStatus ? {
        'X-RateLimit-Limit': String(rlStatus.limit),
        'X-RateLimit-Remaining': String(rlStatus.remaining),
        'X-RateLimit-Reset': String(rlStatus.reset)
    } : {};

    // 2. Parse Body
    let body: AnalysisRequest;
    try {
        body = await request.json() as AnalysisRequest;
    } catch (e) {
        return createErrorResponse(new AppError(ErrorCode.VALIDATION_INVALID_JSON, 'Invalid JSON body', 400));
    }

    const rawArtifact = body.artifact;

    // 3. Validation
    const validation = validateInput(rawArtifact);
    if (!validation.valid) {
        return createErrorResponse(new AppError(ErrorCode.VALIDATION_INVALID_INPUT, validation.error || 'Invalid input', 400));
    }

    const artifact = sanitizeInput(rawArtifact);
    const type = classifyArtifact(artifact);
    const context = body.context;

    // 4. Cache Lookup
    const cacheKey = `v3:analysis:${type}:${encodeURIComponent(artifact)}`;

    if (!body.forceRefresh) {
        try {
            const cachedString = await env.ANALYSIS_CACHE.get(cacheKey);
            if (cachedString) {
                const cached = JSON.parse(cachedString);
                const newId = crypto.randomUUID();

                // Construct Response
                const responseData: ApiResponse<AnalysisResult> = {
                    ok: true,
                    error_code: null,
                    message: 'Analysis retrieved from cache',
                    data: { ...cached, meta: { ...cached.meta, cached: true } }
                };

                // Legacy + New Mixin
                const mixedResponse = {
                    ...responseData,
                    // Legacy root fields
                    id: newId,
                    timestamp: new Date().toISOString(),
                    status: 'completed',
                    result: responseData.data
                };

                return new Response(JSON.stringify(mixedResponse), {
                    headers: { ...securityHeaders, ...rlHeaders, 'Content-Type': 'application/json' }
                });
            }
        } catch (e) {
            console.warn('Cache lookup failed', e);
        }
    }

    // 5. Analysis Execution (Multi-Engine)
    const enginePromises = [
        { name: 'reputation', fn: () => analyzeReputation(artifact, type) },
        { name: 'structure', fn: () => analyzeStructure(artifact, type) },
        { name: 'context', fn: () => analyzeContext(artifact, type, context) },
        { name: 'heuristic', fn: () => analyzeHeuristic(artifact, type) }
    ];

    const results = await Promise.allSettled(enginePromises.map(async (e) => {
        const t0 = Date.now();
        try {
            const res = await e.fn();
            return { ...res, _meta: { name: e.name, duration: Date.now() - t0 } };
        } catch (err) {
            console.error(`Engine ${e.name} failed`, err);
            return null;
        }
    }));

    // Aggregation
    let totalScore = 0;
    const aggregatedFeatures: Record<string, FeatureResult> = {};
    const signals: string[] = [];
    const whyItMatters: string[] = [];
    const executionDetails: any[] = [];

    // Collect valid engine results for confidence calculation
    const validEngineResults: EngineResult[] = [];

    let isSafeListed = false;

    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            const r = result.value as (EngineResult & { _meta: any });
            executionDetails.push(r._meta);
            validEngineResults.push(r);

            if (r.name === 'reputation' && r.confidence === 1.0 && r.score === 0) {
                isSafeListed = true;
            }

            // Merge features
            if (r.features) {
                r.features.forEach(f => {
                    aggregatedFeatures[f.id] = f;
                });
            }
            if (r.signals) signals.push(...r.signals);

            // Score Logic (Max score approach)
            if (r.score > totalScore) totalScore = r.score;

            if (r.summary) whyItMatters.push(`${r.name}: ${r.summary}`);
        }
    }

    if (isSafeListed) {
        totalScore = 0;
        whyItMatters.unshift("Artifact is on a known safe list.");
    }

    // Verdict
    let verdict: RiskVerdict = 'UNKNOWN';
    if (totalScore > 80) verdict = 'MALICIOUS';
    else if (totalScore > 50) verdict = 'SUSPICIOUS';
    else verdict = 'BENIGN';

    // 6. Enhanced Intelligence (Confidence, Temporal, Reasoning)
    const confidenceProfile = calculateConfidence(validEngineResults);
    const reasoningGraph = buildReasoningGraph(aggregatedFeatures, verdict);

    // Temporal (Async lookup, but we await it for response completeness in this design)
    // Pass totalScore to compare with history
    const temporalAnalysis = await analyzeTemporal(env, cacheKey, totalScore);


    // Construct Result
    const analysisResult: AnalysisResult = {
        artifact: { raw: rawArtifact, type, canonical: artifact },
        verdict,
        riskScore: totalScore,
        confidence: confidenceProfile.score,

        // New Fields
        confidence_detail: confidenceProfile,
        reasoning: reasoningGraph,
        temporal: temporalAnalysis,

        signals: Array.from(new Set(signals)),
        why_it_matters: whyItMatters,
        summary: whyItMatters[0] || 'No significant indicators found.',
        features: aggregatedFeatures,
        explanation: {
            primaryFactors: Object.values(aggregatedFeatures).map(f => f.description),
            technicalAnalysis: whyItMatters.join(' '),
            recommendedActions: verdict === 'MALICIOUS' ? ['Block Traffic', 'Quarantine Asset'] : (verdict === 'SUSPICIOUS' ? ['Monitor Activity', 'Verify Source'] : ['No Action Required'])
        },
        meta: {
            executionTimeMs: Date.now() - start,
            cached: false,
            tierUsed: ['TIER_1_LOCAL'],
            modelVersion: 'v3.1.0-production'
        }
    };

    // 7. Cache Storage
    try {
        await env.ANALYSIS_CACHE.put(cacheKey, JSON.stringify(analysisResult), { expirationTtl: 86400 });
    } catch (e) {
        console.error('Cache write failed', e);
    }

    // 8. Response Construction
    const resultId = crypto.randomUUID();
    const responseData: ApiResponse<AnalysisResult> = {
        ok: true,
        error_code: null,
        message: 'Analysis completed successfully',
        data: analysisResult
    };

    const mixedResponse = {
        ...responseData,
        id: resultId,
        timestamp: new Date().toISOString(),
        status: 'completed',
        result: analysisResult
    };

    // Logging (Structured Audit)
    console.log(JSON.stringify({
        event: 'analysis_completed',
        id: resultId,
        duration: Date.now() - start,
        verdict,
        score: totalScore,
        confidence: confidenceProfile.score,
        reasoning_conclusion: reasoningGraph.conclusion,
        engines: executionDetails
    }));

    return new Response(JSON.stringify(mixedResponse), {
        headers: { ...securityHeaders, ...rlHeaders, 'Content-Type': 'application/json' }
    });
}
