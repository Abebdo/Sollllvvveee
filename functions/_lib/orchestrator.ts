import { Env, AnalysisRequest, AnalysisResult, RiskVerdict, FeatureResult, ApiResponse } from './types';
import { validateInput, sanitizeInput, classifyArtifact } from './validation';
import { RateLimiter } from './ratelimit';
import {
    analyzeHeuristic,
    analyzeReputation,
    analyzeStructure,
    analyzeContext,
    analyzeBaseline,
    analyzeMetaJudgment,
    analyzeConfidenceFragility,
    EngineResult
} from './engines';
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
    const cacheKey = `v4:analysis:${type}:${encodeURIComponent(artifact)}`; // Version bumped to v4

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
    // "Mandatory Logic Order" executed in parallel for performance, but aggregated logically
    const enginePromises = [
        { name: 'reputation', fn: () => analyzeReputation(artifact, type) },
        { name: 'structure', fn: () => analyzeStructure(artifact, type) },
        { name: 'context', fn: () => analyzeContext(artifact, type, context) },
        { name: 'heuristic', fn: () => analyzeHeuristic(artifact, type) },
        { name: 'baseline', fn: () => analyzeBaseline(artifact, type) } // New Engine
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

    // Collect results
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

            // Base scoring (Max approach)
            // DECOUPLING: Even if allowlisted, we track the max score.
            // We do NOT reset totalScore to 0 here.
            if (r.score > totalScore) totalScore = r.score;
            if (r.summary) whyItMatters.push(`${r.name}: ${r.summary}`);
            if (r.name === 'baseline' && r.deviation_reasoning) whyItMatters.push(`Baseline: ${r.deviation_reasoning}`);
        }
    }

    // If on allowlist, we initially consider it safe, BUT...
    // The "Intent vs Reputation Decoupling" rule:
    // "Modify engines so reputation can NEVER fully neutralize intent-based risk"
    // So if totalScore is high (e.g. baseline found anomaly), we KEEP the high score.
    // If totalScore is low, and isAllowListed, it remains low.

    // However, if it IS allowlisted, we might want to mention it.
    if (isAllowListed && totalScore < 10) {
        whyItMatters.unshift("Artifact is on a known safe list.");
    } else if (isAllowListed && totalScore >= 50) {
         whyItMatters.unshift("Artifact is on a known safe list, BUT abnormal behavior was detected.");
    }

    // --- PHASE 2: Meta-Judgment & Fragility ---

    // New Meta-Judgment Engine
    const metaJudgment = analyzeMetaJudgment(validEngineResults);

    // Confidence Fragility Engine
    const fragility = analyzeConfidenceFragility(validEngineResults, totalScore);

    // Counterfactual (Legacy/Detail) - keep for compatibility and detailed reasoning
    const counterfactual = performCounterfactualAnalysis(validEngineResults, totalScore);

    // --- PHASE 3: Analytical Memory & Temporal ---

    // Consult memory
    const memory = await consultMemory(env, artifact);

    // Consult temporal (short-term cache diff)
    const temporalAnalysis = await analyzeTemporal(env, cacheKey, totalScore);

    // --- PHASE 4: Confidence Calibration ---

    // Start with base confidence
    let finalConfidence = calculateConfidence(validEngineResults).score;
    const uncertaintyFlags: string[] = [];

    // Apply Meta-Judgment Adjustments
    finalConfidence *= metaJudgment.confidence_adjustment;
    uncertaintyFlags.push(...metaJudgment.contradictions);

    // Apply Fragility Adjustments
    if (fragility.stability_score < 0.5) {
        finalConfidence *= 0.8;
        uncertaintyFlags.push('Verdict stability is low; highly dependent on specific assumptions.');
    }

    // Memory Influence
    if (memory.seen_count === 0) {
        uncertaintyFlags.push('First time seeing this specific artifact pattern');
    } else if (memory.volatility > 20) {
        finalConfidence *= 0.95;
        uncertaintyFlags.push('Artifact demonstrates volatile behavior historically');
    }

    // Final Clamp
    finalConfidence = Math.max(0.1, Math.min(1.0, parseFloat(finalConfidence.toFixed(2))));

    // Verdict Logic
    let verdict: RiskVerdict = 'UNKNOWN';
    if (totalScore > 80) verdict = 'MALICIOUS';
    else if (totalScore > 50) verdict = 'SUSPICIOUS';
    else verdict = 'BENIGN';

    const reasoningGraph = buildReasoningGraph(aggregatedFeatures, verdict);

    // --- PHASE 5: Self-Critique & Output Construction ---

    const selfCritique: SelfCritique = {
        assumptions_made: [
            ...metaJudgment.judgment_notes,
            `Assuming ${validEngineResults.length} engines cover relevant attack surfaces`
        ],
        what_might_be_wrong: [
            ...fragility.fragility_reasons,
            ...metaJudgment.contradictions
        ],
        missing_information: []
    };

    if (validEngineResults.length < 3) {
        selfCritique.missing_information.push('Limited engine coverage available');
    }
    if (memory.seen_count === 0) {
        selfCritique.missing_information.push('No historical context available for this artifact');
    }

    // Construct Analysis Quality
    const confidenceLevel = finalConfidence > 0.8 ? 'high' : (finalConfidence > 0.5 ? 'medium' : 'low');

    const analysisResult: AnalysisResult = {
        artifact: { raw: rawArtifact, type, canonical: artifact },
        verdict,
        riskScore: totalScore,
        confidence: finalConfidence, // Legacy field

        // Phase 3 Meta-Intelligence Fields
        confidence_level: finalConfidence,
        stability_score: fragility.stability_score,
        uncertainty_flags: uncertaintyFlags,
        self_critique: selfCritique,

        // Phase 4: Epistemic Intelligence
        analysis_quality: {
            confidence_level: confidenceLevel,
            stability_score: fragility.stability_score,
            anomaly_flags: metaJudgment.contradictions,
            judgment_notes: metaJudgment.judgment_notes
        },

        // Standard Fields
        confidence_detail: { score: finalConfidence, reasons: uncertaintyFlags },
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
            tierUsed: ['TIER_1_LOCAL', 'TIER_4_PLATFORM'],
            modelVersion: 'v4.0.0-intel'
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
        confidence: finalConfidence,
        reasoning_conclusion: reasoningGraph.conclusion,
        engines: executionDetails,
        meta_judgment: metaJudgment
    }));

    return new Response(JSON.stringify(mixedResponse), {
        headers: { ...securityHeaders, ...rlHeaders, 'Content-Type': 'application/json' }
    });
}
