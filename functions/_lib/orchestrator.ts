import { Env, AnalysisRequest, AnalysisResult, RiskVerdict, FeatureResult, ApiResponse, RiskTimelineStage } from './types';
import { validateInput, sanitizeInput, classifyArtifact } from './validation';
import { RateLimiter } from './ratelimit';
import {
    analyzeHeuristic,
    analyzeReputation,
    analyzeStructure,
    analyzeContext,
    analyzeBaseline,
    analyzeMetaJudgment,
    EngineResult
} from './engines';
import { analyzeSemantic } from './engines/semantic.engine';
import { analyzeFragility } from './analysis/fragility';
import { applyContextualVerdict } from './context/contextual_verdict';

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
    const cacheKey = `v4:analysis:${type}:${encodeURIComponent(artifact)}`;

    if (!body.forceRefresh) {
        try {
            const cachedString = await env.ANALYSIS_CACHE.get(cacheKey);
            if (cachedString) {
                const cached = JSON.parse(cachedString);
                const newId = crypto.randomUUID();

                const responseData: ApiResponse<AnalysisResult> = {
                    ok: true,
                    error_code: null,
                    message: 'Analysis retrieved from cache',
                    data: { ...cached, meta: { ...cached.meta, cached: true } }
                };

                const mixedResponse = {
                    ...responseData,
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
        { name: 'heuristic', fn: () => analyzeHeuristic(artifact, type) },
        { name: 'baseline', fn: () => analyzeBaseline(artifact, type) },
        { name: 'semantic', fn: () => analyzeSemantic(artifact, type) }
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

    // --- PHASE 1: Aggregation ---

    let totalScore = 0;
    const aggregatedFeatures: Record<string, FeatureResult> = {};
    const signals: string[] = [];
    const whyItMatters: string[] = [];
    const executionDetails: any[] = [];
    const cognitiveTrace: CognitiveTraceStep[] = [];
    const validEngineResults: EngineResult[] = [];
    let isAllowListed = false;

    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            const r = result.value as (EngineResult & { _meta: any });
            executionDetails.push(r._meta);
            validEngineResults.push(r);

            if (r.name === 'reputation' && r.confidence === 1.0 && r.score === 0) {
                isAllowListed = true;
            }

            if (r.features) r.features.forEach(f => aggregatedFeatures[f.id] = f);
            if (r.signals) signals.push(...r.signals);
            if (r.trace) cognitiveTrace.push(...r.trace);

            if (r.score > totalScore) totalScore = r.score;
            if (r.summary) whyItMatters.push(`${r.name}: ${r.summary}`);
            if (r.name === 'baseline' && r.deviation_reasoning) whyItMatters.push(`Baseline: ${r.deviation_reasoning}`);
        }
    }

    if (isAllowListed && totalScore < 10) {
        whyItMatters.unshift("Artifact is on a known safe list.");
    } else if (isAllowListed && totalScore >= 50) {
         whyItMatters.unshift("Artifact is on a known safe list, BUT abnormal behavior was detected.");
    }

    // Risk Timeline: Start
    const riskTimeline: RiskTimelineStage[] = [];
    riskTimeline.push({ stage: 'Initial Aggregation', score: totalScore });

    // --- PHASE 2: Meta-Judgment & Fragility ---

    const metaJudgment = analyzeMetaJudgment(validEngineResults);
    const fragility = analyzeFragility(validEngineResults);

    // --- PHASE 3: Analytical Memory & Temporal ---

    const memory = await consultMemory(env, artifact);
    const temporalAnalysis = await analyzeTemporal(env, cacheKey, totalScore);

    // --- PHASE 4: Confidence Calibration & Contextual Verdict ---

    let finalConfidence = calculateConfidence(validEngineResults).score;
    const uncertaintyFlags: string[] = [];

    // Apply Meta Adjustments
    finalConfidence *= metaJudgment.confidence_adjustment;
    uncertaintyFlags.push(...(metaJudgment.warnings || []));
    uncertaintyFlags.push(...metaJudgment.contradictions || []); // Compat

    // Apply Fragility Adjustments
    if (fragility.level === 'HIGH') {
        finalConfidence = Math.min(finalConfidence, 0.6);
        uncertaintyFlags.push('High fragility: verdict relies on weak or sparse evidence.');
    }

    if (memory.seen_count === 0) {
        uncertaintyFlags.push('First time seeing this specific artifact pattern');
    } else if (memory.volatility > 20) {
        finalConfidence *= 0.95;
        uncertaintyFlags.push('Artifact demonstrates volatile behavior historically');
    }

    finalConfidence = Math.max(0.1, Math.min(1.0, parseFloat(finalConfidence.toFixed(2))));

    // Calculate Uncertainty Range
    const uncertainty = parseFloat((1 - finalConfidence).toFixed(2));
    const confidenceRange = {
        min: parseFloat(Math.max(0, finalConfidence - (uncertainty * 0.5)).toFixed(2)),
        most_likely: finalConfidence,
        max: parseFloat(Math.min(1, finalConfidence + (uncertainty * 0.2)).toFixed(2)),
        uncertainty
    };

    // Verdict Logic (Initial)
    let verdict: RiskVerdict = 'UNKNOWN';
    if (totalScore > 80) verdict = 'MALICIOUS';
    else if (totalScore > 50) verdict = 'SUSPICIOUS';
    else verdict = 'BENIGN';

    // Contextual Verdict
    const contextDecision = applyContextualVerdict(verdict, context?.source);
    if (contextDecision.context_downgrade) {
        verdict = contextDecision.adjusted_verdict;
        // Adjust score implicitly if needed for consistency, or just log stage
        if (verdict === 'SUSPICIOUS' && totalScore < 50) {
             totalScore = 60; // Force score into suspicious range
        }
        riskTimeline.push({ stage: 'Contextual Adjustment', score: totalScore });
    }

    const reasoningGraph = buildReasoningGraph(aggregatedFeatures, verdict);

    // --- PHASE 5: Self-Critique & Output Construction ---

    const selfCritique: SelfCritique = {
        assumptions_made: [
            ...metaJudgment.judgment_notes || [],
            `Assuming ${validEngineResults.length} engines cover relevant attack surfaces`
        ],
        what_might_be_wrong: [
            ...fragility.reasons,
            ...(metaJudgment.warnings || [])
        ],
        missing_information: []
    };

    if (validEngineResults.length < 3) {
        selfCritique.missing_information.push('Limited engine coverage available');
    }

    const confidenceLevel = finalConfidence > 0.8 ? 'high' : (finalConfidence > 0.5 ? 'medium' : 'low');

    // Semantic Intent Extraction
    const semanticResult = validEngineResults.find(r => r.name === 'semantic');
    const semanticIntentData = semanticResult ? (semanticResult as any).semantic_intent : undefined;

    // Explanation Construction
    const explanation = {
        summary: whyItMatters[0] || 'No significant indicators found.',
        positive_factors: validEngineResults.filter(r => r.score < 20).map(r => r.summary || `${r.name}: Low Risk`),
        negative_factors: validEngineResults.filter(r => r.score >= 20).map(r => r.summary || `${r.name}: High Risk`),
        weights: validEngineResults.reduce((acc, r) => ({ ...acc, [r.name]: r.score }), {}),
        reasoning_steps: metaJudgment.warnings || [],
        primaryFactors: Object.values(aggregatedFeatures).map(f => f.description),
        technicalAnalysis: whyItMatters.join(' '),
        recommendedActions: verdict === 'MALICIOUS' ? ['Block Traffic', 'Quarantine Asset'] : (verdict === 'SUSPICIOUS' ? ['Monitor Activity', 'Verify Source'] : ['No Action Required'])
    };

    const analysisResult: AnalysisResult = {
        artifact: { raw: rawArtifact, type, canonical: artifact },
        verdict,
        riskScore: totalScore,
        confidence: finalConfidence,

        // New Structured Fields
        confidence_level: finalConfidence,
        stability_score: parseFloat((1 - (fragility.score / 10)).toFixed(2)),
        uncertainty_flags: uncertaintyFlags,
        self_critique: selfCritique,

        // Phase 5 Fields
        meta_judgment: metaJudgment,
        fragility: fragility,
        contextual_verdict: contextDecision,
        semantic_intent: semanticIntentData,
        risk_timeline: riskTimeline,
        confidence_range: confidenceRange,

        // Epistemic Intelligence
        analysis_quality: {
            confidence_level: confidenceLevel,
            stability_score: parseFloat((1 - (fragility.score / 10)).toFixed(2)),
            anomaly_flags: metaJudgment.warnings || [],
            judgment_notes: metaJudgment.judgment_notes || []
        },

        confidence_detail: { score: finalConfidence, reasons: uncertaintyFlags },
        reasoning: reasoningGraph,
        temporal: temporalAnalysis,
        cognitive_trace: cognitiveTrace,

        signals: Array.from(new Set(signals)),
        why_it_matters: whyItMatters,
        summary: whyItMatters[0] || 'No significant indicators found.',
        features: aggregatedFeatures,
        explanation,
        meta: {
            executionTimeMs: Date.now() - start,
            cached: false,
            tierUsed: ['TIER_1_LOCAL', 'TIER_4_PLATFORM'],
            modelVersion: 'v4.0.0-intel'
        }
    };

    // --- PHASE 6: Persistence ---

    await updateMemory(env, artifact, totalScore);

    try {
        await env.ANALYSIS_CACHE.put(cacheKey, JSON.stringify(analysisResult), { expirationTtl: 86400 });
    } catch (e) {
        console.error('Cache write failed', e);
    }

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

    console.log(JSON.stringify({
        event: 'analysis_completed',
        id: resultId,
        duration: Date.now() - start,
        verdict,
        score: totalScore,
        confidence: finalConfidence,
        meta_judgment: metaJudgment
    }));

    return new Response(JSON.stringify(mixedResponse), {
        headers: { ...securityHeaders, ...rlHeaders, 'Content-Type': 'application/json' }
    });
}
