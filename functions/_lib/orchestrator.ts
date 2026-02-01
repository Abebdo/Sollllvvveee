import { Env, AnalysisRequest, AnalysisResult, RiskVerdict, FeatureResult, ApiResponse } from './types';
import { validateInput, sanitizeInput, classifyArtifact } from './validation';
import { RateLimiter } from './ratelimit';
import { analyzeHeuristic, analyzeReputation, analyzeStructure, analyzeContext, EngineResult } from './engines';
import { analyzeMeta } from './engines/meta.engine';
import { performCounterfactualAnalysis } from './reasoning/counterfactual';
import { consultMemory, updateMemory } from './memory/analytical_memory';
import { AppError, ErrorCode, createErrorResponse } from './errors';
import { analyzeTemporal } from './temporal';
import { calculateConfidence } from './confidence';
import { buildReasoningGraph } from './reasoning';
import { CognitiveTraceStep } from './cognitive_trace';
import { SelfCritique } from './types';

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

    // --- PHASE 1: Aggregation & Meta-Analysis ---

    let totalScore = 0;
    const aggregatedFeatures: Record<string, FeatureResult> = {};
    const signals: string[] = [];
    const whyItMatters: string[] = [];
    const executionDetails: any[] = [];
    const cognitiveTrace: CognitiveTraceStep[] = [];
    const validEngineResults: EngineResult[] = [];
    let isSafeListed = false;

    // Collect results
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            const r = result.value as (EngineResult & { _meta: any });
            executionDetails.push(r._meta);
            validEngineResults.push(r);

            if (r.name === 'reputation' && r.confidence === 1.0 && r.score === 0) {
                isSafeListed = true;
            }

            if (r.features) r.features.forEach(f => aggregatedFeatures[f.id] = f);
            if (r.signals) signals.push(...r.signals);
            if (r.trace) cognitiveTrace.push(...r.trace);

            // Base scoring (Max approach)
            if (r.score > totalScore) totalScore = r.score;
            if (r.summary) whyItMatters.push(`${r.name}: ${r.summary}`);
        }
    }

    if (isSafeListed) {
        totalScore = 0;
        whyItMatters.unshift("Artifact is on a known safe list.");
    }

    // Meta-Engine Execution
    const metaAnalysis = analyzeMeta(validEngineResults);

    // --- PHASE 2: Counterfactual Reasoning ---

    const counterfactual = performCounterfactualAnalysis(validEngineResults, totalScore);

    // --- PHASE 3: Analytical Memory & Temporal ---

    // Consult memory
    const memory = await consultMemory(env, artifact);

    // Consult temporal (short-term cache diff)
    const temporalAnalysis = await analyzeTemporal(env, cacheKey, totalScore);

    // --- PHASE 4: Confidence Calibration ---

    const baseConfidence = calculateConfidence(validEngineResults);
    let finalConfidence = baseConfidence.score;
    const uncertaintyFlags: string[] = [];

    // Downgrade based on Meta-Analysis (Disagreement)
    if (metaAnalysis.disagreement_level === 'medium') {
        finalConfidence *= 0.85;
        uncertaintyFlags.push('Moderate disagreement between analytical engines');
    } else if (metaAnalysis.disagreement_level === 'high') {
        finalConfidence *= 0.6;
        uncertaintyFlags.push('High conflict between engines reduces certainty');
    }

    // Downgrade based on Sensitivity
    if (counterfactual.sensitivity > 0.6) {
        finalConfidence *= 0.9;
        uncertaintyFlags.push('Result is highly sensitive to a single factor');
    }

    // Memory Influence
    // If novel (never seen), slight uncertainty
    if (memory.seen_count === 0) {
        uncertaintyFlags.push('First time seeing this specific artifact pattern');
    } else if (memory.volatility > 20) {
        // If historically volatile, we are less sure about *this* specific score staying static
        finalConfidence *= 0.95;
        uncertaintyFlags.push('Artifact demonstrates volatile behavior historically');
    }

    // Update profile
    baseConfidence.score = parseFloat(finalConfidence.toFixed(2));
    baseConfidence.reasons.push(...uncertaintyFlags);

    // Verdict Logic
    let verdict: RiskVerdict = 'UNKNOWN';
    if (totalScore > 80) verdict = 'MALICIOUS';
    else if (totalScore > 50) verdict = 'SUSPICIOUS';
    else verdict = 'BENIGN';

    const reasoningGraph = buildReasoningGraph(aggregatedFeatures, verdict);

    // --- PHASE 5: Self-Critique ---

    const selfCritique: SelfCritique = {
        assumptions_made: [
            ...metaAnalysis.weak_assumptions,
            `Assuming ${validEngineResults.length} engines cover relevant attack surfaces`
        ],
        what_might_be_wrong: [
            ...counterfactual.fragile_assumptions.map(id => `Reliance on fragile signal '${id}'`),
            metaAnalysis.disagreement_level === 'high' ? 'Engines provided contradictory evidence' : ''
        ].filter(Boolean),
        missing_information: []
    };

    if (validEngineResults.length < 3) {
        selfCritique.missing_information.push('Limited engine coverage available');
    }
    if (memory.seen_count === 0) {
        selfCritique.missing_information.push('No historical context available for this artifact');
    }

    // --- Construct Final Result ---

    const analysisResult: AnalysisResult = {
        artifact: { raw: rawArtifact, type, canonical: artifact },
        verdict,
        riskScore: totalScore,
        confidence: baseConfidence.score, // Legacy field

        // Phase 3 Meta-Intelligence Fields
        confidence_level: baseConfidence.score,
        stability_score: parseFloat((1 - counterfactual.sensitivity).toFixed(2)),
        uncertainty_flags: uncertaintyFlags,
        self_critique: selfCritique,

        // Standard Fields
        confidence_detail: baseConfidence,
        reasoning: reasoningGraph,
        temporal: temporalAnalysis,
        cognitive_trace: cognitiveTrace,

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
            modelVersion: 'v3.2.0-analyst'
        }
    };

    // --- PHASE 6: Persistence ---

    // 1. Update Analytical Memory
    await updateMemory(env, artifact, totalScore);

    // 2. Cache Result
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
        confidence: baseConfidence.score,
        reasoning_conclusion: reasoningGraph.conclusion,
        engines: executionDetails
    }));

    return new Response(JSON.stringify(mixedResponse), {
        headers: { ...securityHeaders, ...rlHeaders, 'Content-Type': 'application/json' }
    });
}
