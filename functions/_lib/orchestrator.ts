import { Env, AnalysisRequest, AnalysisResult, RiskVerdict, FeatureResult, ApiResponse, RiskTimelineStage, AnalystFlags, ConflictResolution, EpistemicProfile, SelfCritique, UsageRiskVerdict, FinalAssessment } from './types';
import { validateInput, sanitizeInput, classifyArtifact } from './validation';
import { classifyArtifact as classifyArtifactContext } from './context/artifact_classifier';
import { normalizeVerdict } from './analysis/verdict_normalizer';
import { RateLimiter } from './ratelimit';
import {
    analyzeHeuristic,
    analyzeReputation,
    analyzeStructure,
    analyzeContext,
    analyzeBaseline,
    analyzeMetaJudgment,
    analyzeRootTrust,
    EngineResult
} from './engines';
import { analyzeSemantic } from './engines/semantic.engine';
import { analyzeFragility } from './analysis/fragility';
import { applyContextualVerdict, generateContextualVerdicts, checkContextDivergence } from './context/contextual_verdict';

import { consultMemory, updateMemory, consultCampaignMemory, updateCampaignMemory } from './memory/analytical_memory';
import { analyzeBehavioralTimeline } from './analysis/behavioral_timeline';
import { analyzeInfrastructure } from './analysis/infrastructure_intel';
import { analyzeCampaignCorrelation, generateCampaignFingerprint } from './analysis/campaign_correlation';

import { AppError, ErrorCode, createErrorResponse } from './errors';
import { analyzeTemporal } from './temporal';
import { calculateConfidence, calibrateConfidence, calculateConfidenceRange } from './confidence';
import { buildReasoningGraph } from './reasoning';
import { CognitiveTraceStep } from './cognitive_trace';
import { analyzeConflict } from './analysis/conflict_resolution';
import { generateAnalystExplanation } from './explanation/human_explanation';
import { expandUrl } from './analysis/url_expansion';
import { buildEpistemicProfile } from './analysis/epistemic_profile';

// --- ENGINE BOOTSTRAP & INITIALIZATION ---
function bootstrapEngines() {
    const engines = {
        'Heuristic Engine': analyzeHeuristic,
        'Reputation Engine': analyzeReputation,
        'Structure Engine': analyzeStructure,
        'Context Engine': analyzeContext,
        'Baseline Engine': analyzeBaseline,
        'Meta-Judgment Engine': analyzeMetaJudgment,
        'Root Trust Engine': analyzeRootTrust,
        'Semantic Engine': analyzeSemantic,
        'Fragility Engine': analyzeFragility,
        'Conflict Resolution Engine': analyzeConflict,
        'Explanation Engine': generateAnalystExplanation,
        'Confidence Engine': calculateConfidence,
        'Contextual Verdict Engine': applyContextualVerdict
    };

    for (const [name, engine] of Object.entries(engines)) {
        if (!engine) {
             const msg = `[BOOT][FATAL] Engine ${name} failed to initialize`;
             console.error(msg);
             throw new Error(msg);
        }
        console.log(`[BOOT] ${name}: READY`);
    }
    console.log("[BOOT] All Engines: READY");
}

// Force initialization at module load time (Fail Fast)
bootstrapEngines();

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

interface EngineDefinition {
    name: string;
    fn: () => Promise<any> | any;
}

function checkEngineHealth(engines: EngineDefinition[]) {
    for (const engine of engines) {
        if (typeof engine.fn !== 'function') {
             throw new AppError(ErrorCode.INTERNAL_ERROR, `Engine ${engine.name} is not callable`);
        }
    }
}

export async function handleAnalysisRequest(request: Request, env: Env): Promise<Response> {
    const start = Date.now();
    const timestamp = new Date().toISOString();
    console.log(`[Analysis] Request received: ${request.method} ${request.url}`);
    console.log(`[Analysis] Timestamp: ${timestamp}`);

    // Internal Self-Test & Env Validation
    if (!env.ANALYSIS_CACHE) {
        console.error("CRITICAL: ANALYSIS_CACHE binding missing");
        throw new Error("Missing ENV: ANALYSIS_CACHE");
    }

    let rlStatus: any;

    try {
        const rateLimiter = new RateLimiter(env, request);
        rlStatus = await rateLimiter.check(1);
        console.log('[Analysis] Rate limit check passed');

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

    let body: AnalysisRequest;
    try {
        body = await request.json() as AnalysisRequest;
    } catch (e) {
        return createErrorResponse(new AppError(ErrorCode.VALIDATION_INVALID_JSON, 'Invalid JSON body', 400));
    }

    const rawArtifact = body.artifact;
    console.log(`[Analysis] Target Artifact: ${rawArtifact}`);

    const validation = validateInput(body);
    if (!validation.valid) {
        return createErrorResponse(new AppError(ErrorCode.VALIDATION_INVALID_INPUT, validation.error || 'Invalid input', 400));
    }

    try {
        let artifact = sanitizeInput(rawArtifact);
        let type = classifyArtifact(artifact);
        let artifactClass = classifyArtifactContext(artifact);
        const context = body.context;

        if (type === 'url') {
            const expanded = await expandUrl(artifact);
            if (expanded !== artifact) {
                artifact = expanded;
                type = classifyArtifact(artifact);
                artifactClass = classifyArtifactContext(artifact);
            }
        }

        const cacheKey = `v4:analysis:${type}:${encodeURIComponent(artifact)}`;

        if (!body.forceRefresh) {
            try {
                console.log(`[Analysis] Checking cache for key: ${cacheKey}`);
                const cachedString = await env.ANALYSIS_CACHE.get(cacheKey);
                if (cachedString) {
                    console.log('[Analysis] Cache HIT');
                    const cached = JSON.parse(cachedString);
                    return new Response(JSON.stringify({
                        ok: true,
                        error_code: null,
                        message: 'Analysis retrieved from cache',
                        data: { ...cached, meta: { ...cached.meta, cached: true } },
                        id: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                        status: 'completed',
                        result: cached
                    }), {
                        headers: { ...securityHeaders, ...rlHeaders, 'Content-Type': 'application/json' } as any
                    });
                }
            } catch (e) {
                console.warn('Cache lookup failed', e);
            }
        }

    // 1. World Model & Root Trust
    console.log('[Analysis] Starting Root Trust analysis');
    let rootTrust: any;
    try {
        rootTrust = await analyzeRootTrust(artifact, type);
    } catch (e) {
        console.error('[Analysis] Root Trust failed:', e);
        // Root Trust is critical for "Immunized" domains, but if it fails, we should probably fail safe?
        // Plan says critical engines failure -> abort.
        // Assuming Root Trust is critical.
        throw new AppError(ErrorCode.INTERNAL_ERROR, `Root Trust Engine failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    const isRootTrusted = rootTrust.is_trusted;
    const realityRole = rootTrust.role;
    console.log(`[Analysis] Root Trust result: ${isRootTrusted} (${realityRole})`);

    // 2. Engine Definition & Health Check
    const criticalEngines: EngineDefinition[] = [
        { name: 'reputation', fn: () => analyzeReputation(artifact, type) },
        { name: 'structure', fn: () => analyzeStructure(artifact, type) },
    ];

    // Non-critical engines can fail without aborting analysis
    const nonCriticalEngines: EngineDefinition[] = [
        { name: 'baseline', fn: () => analyzeBaseline(artifact, type) }
    ];

    if (artifactClass !== 'INFRASTRUCTURE_ROOT') {
        criticalEngines.push(
            { name: 'context', fn: () => analyzeContext(artifact, type, context) },
            { name: 'heuristic', fn: () => analyzeHeuristic(artifact, type) },
            { name: 'semantic', fn: () => analyzeSemantic(artifact, type) }
        );
    }

    checkEngineHealth([...criticalEngines, ...nonCriticalEngines]);

    console.log(`[Analysis] Executing ${criticalEngines.length} critical engines and ${nonCriticalEngines.length} auxiliary engines...`);

    // 3. Execution (MINIMUM VIABLE SET)

    // Critical Engines: At least ONE must succeed
    const criticalPromises = criticalEngines.map(async (e) => {
        const t0 = Date.now();
        try {
            const res = await e.fn();
            if (!res) throw new Error(`Engine ${e.name} returned empty/null result`);
            return { ...res, _meta: { name: e.name, duration: Date.now() - t0 } };
        } catch (err) {
            console.warn(`[Analysis] Critical engine ${e.name} failed (continuing):`, err);
            return null;
        }
    });

    const criticalResultsRaw = await Promise.all(criticalPromises);
    const criticalResults = criticalResultsRaw.filter((r: any) => r !== null);

    if (criticalResults.length === 0) {
        console.error("[Analysis] CRITICAL FAILURE: All critical engines failed.");
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Analysis failed: All critical intelligence components failed");
    }

    // Non-Critical Engines: BEST EFFORT (Promise.allSettled)
    const nonCriticalPromises = nonCriticalEngines.map(async (e) => {
        const t0 = Date.now();
        try {
            const res = await e.fn();
            if (!res) throw new Error(`Engine ${e.name} returned empty/null result`);
            return { ...res, _meta: { name: e.name, duration: Date.now() - t0 } };
        } catch (err) {
            console.warn(`[Analysis] Non-critical engine ${e.name} failed (ignoring):`, err);
            return null;
        }
    });

    // Memory (Best Effort)
    const memoryPromise = consultMemory(env, artifact).catch(err => {
        console.error('[Analysis] Memory lookup failed:', err);
        return {
            seen_count: 0,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            volatility: 0,
            average_score: 0,
            trend_classification: 'novel' as 'novel',
            history_scores: []
        };
    });

    const [nonCriticalResultsRaw, memory] = await Promise.all([
        Promise.all(nonCriticalPromises), // We already caught errors inside map
        memoryPromise
    ]);

    // Combine Results
    const validEngineResults: EngineResult[] = [
        ...criticalResults,
        ...nonCriticalResultsRaw.filter((r: any) => r !== null)
    ];

    // Inject Root Trust result
    validEngineResults.push({
        ...rootTrust.engine_result,
        _meta: { name: 'root_trust', duration: 0 }
    } as any);

    console.log('[Analysis] Engines and Memory lookup completed successfully');

    // 4. Aggregation
    let totalScore = 0;
    const aggregatedFeatures: Record<string, FeatureResult> = {};
    const signals: string[] = [];
    const whyItMatters: string[] = [];
    const cognitiveTrace: CognitiveTraceStep[] = [];

    for (const r of validEngineResults) {
        if (r.features) r.features.forEach((f: FeatureResult) => aggregatedFeatures[f.id] = f);
        if (r.signals) signals.push(...r.signals);
        if (r.trace) cognitiveTrace.push(...r.trace);

        if (r.score > totalScore) totalScore = r.score;
        if (r.summary) whyItMatters.push(`${r.name}: ${r.summary}`);
    }

    // MINIMUM VIABLE RESULT RULE
    // "Analysis must fail if zero valid signals are produced"
    if (signals.length === 0) {
        console.error("[Analysis] Zero signals produced. Aborting.");
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Analysis failed: Zero valid signals produced (Minimum Viable Result violation)");
    }

    const riskTimeline: RiskTimelineStage[] = [];
    riskTimeline.push({ stage: 'Initial Aggregation', score: totalScore });

    // 5. Conflict Resolution & Context
    const semanticResult = validEngineResults.find(r => r.name === 'semantic');
    const semanticIntentData = semanticResult ? (semanticResult as any).semantic_intent : undefined;

    const conflict = analyzeConflict(validEngineResults, isRootTrusted);

    if (conflict.conflict_detected && conflict.winning_signal !== 'REPUTATION') {
        if (totalScore < 60) {
            totalScore = 65;
            whyItMatters.unshift(`Score adjusted due to conflict: ${conflict.primary_conflict}`);
            riskTimeline.push({ stage: 'Conflict Resolution Adjustment', score: totalScore });
        }
    }

    // 6. Meta Judgment
    const metaJudgment = analyzeMetaJudgment(validEngineResults);

    // 7. Fragility
    const isFirstSeen = memory.seen_count === 0;
    const fragility = analyzeFragility(validEngineResults, isFirstSeen);

    // 8. Deep Intel (Behavioral, Infra, Campaign)
    // Non-blocking enhancers

    let temporalAnalysis: any = { last_score: null, delta: null, trend: 'insufficient_data' };
    let behavioral: any = { behavioral_drift: 'NONE', timeline_confidence_penalty: 0, history_summary: 'Analysis unavailable' };
    let campaign: any = { campaign_confidence: 0, related_artifacts_count: 0 };
    let infrastructure: any = { infrastructure_risk_score: 0, trusted_infra_abuse: false, provider_name: 'Unknown' };
    let fingerprint: string = '';

    try {
        fingerprint = generateCampaignFingerprint(artifact);

        // Parallel execution for Deep Intel
        const [tempRes, behavRes, campMem, infraRes] = await Promise.all([
             analyzeTemporal(env, cacheKey, totalScore).catch(e => temporalAnalysis),
             Promise.resolve(analyzeBehavioralTimeline(totalScore, memory.history_scores)).catch(e => behavioral),
             consultCampaignMemory(env, fingerprint).catch(e => ({})),
             Promise.resolve(analyzeInfrastructure(artifact, type, semanticIntentData?.intent)).catch(e => infrastructure)
        ]);

        if (tempRes) temporalAnalysis = tempRes;
        if (behavRes) behavioral = behavRes;
        if (infraRes) infrastructure = infraRes;

        // Campaign depends on memory lookup
        try {
            campaign = analyzeCampaignCorrelation(artifact, campMem);
        } catch(e) { /* ignore campaign failure */ }

    } catch (e) {
        console.error("[Analysis] Deep Intel failed (Non-blocking):", e);
        // Continue with defaults
    }

    // Adjust Score based on Deep Intel
    if (behavioral.behavioral_drift === 'HIGH') {
        totalScore += 20;
        whyItMatters.push(`Behavioral Drift: ${behavioral.history_summary}`);
    }
    if (infrastructure.infrastructure_risk_score > 50) {
        totalScore += (infrastructure.infrastructure_risk_score * 0.2);
    }
    if (infrastructure.trusted_infra_abuse) {
        whyItMatters.unshift("CRITICAL: Trusted infrastructure abused to inherit false legitimacy.");
        if (totalScore < 75) totalScore = 75;
    }
    if (campaign.campaign_confidence > 0.5) {
        totalScore += 15;
    }

    // 9. Verdict Logic
    let verdict: RiskVerdict | null = null;

    if (totalScore > 80) verdict = 'MALICIOUS';
    else if (totalScore > 50) verdict = 'SUSPICIOUS';
    else verdict = 'BENIGN';

    // Override: Malicious Intent
    if (verdict === 'BENIGN' && semanticIntentData && semanticIntentData.intent === 'MALICIOUS') {
        verdict = 'SUSPICIOUS';
        totalScore = Math.max(totalScore, 60);
        whyItMatters.unshift("Verdict downgraded to SUSPICIOUS due to malicious intent detection.");
    }
    if (conflict.conflict_detected && conflict.winning_signal === 'INTENT' && verdict === 'BENIGN') {
        verdict = 'SUSPICIOUS';
        totalScore = Math.max(totalScore, 60);
    }

    // Contextual Verdict
    const contextDecision = applyContextualVerdict(verdict, context?.source);
    if (contextDecision.context_downgrade) {
        verdict = contextDecision.adjusted_verdict;
        if (verdict === 'SUSPICIOUS' && totalScore < 50) totalScore = 60;
    }

    // Usage Risk & Final Assessment
    let usageRisk: UsageRiskVerdict | null = null;
    if (semanticIntentData) usageRisk = semanticIntentData.intent;
    else if (totalScore > 80) usageRisk = 'MALICIOUS';
    else if (totalScore > 50) usageRisk = 'SUSPICIOUS';
    else usageRisk = 'BENIGN';

    let finalAssessment: FinalAssessment | null = null;

    // FINAL SAFETY RULE & Root Trust Logic
    if (isRootTrusted) {
        if (infrastructure.trusted_infra_abuse || usageRisk === 'MALICIOUS') {
             finalAssessment = 'TRUSTED_SERVICE_ABUSED';
             if (verdict === 'BENIGN') verdict = 'SUSPICIOUS';
        } else {
             finalAssessment = 'SAFE';
             verdict = 'BENIGN';
             totalScore = 0;
        }
    } else {
         if (verdict === 'MALICIOUS') finalAssessment = 'MALICIOUS_SERVICE';
         else if (verdict === 'SUSPICIOUS') finalAssessment = 'SUSPICIOUS';
         else finalAssessment = 'SAFE';
    }

    if (!verdict) throw new AppError(ErrorCode.INTERNAL_ERROR, "Verdict generation failed: verdict is null");
    if (!finalAssessment) throw new AppError(ErrorCode.INTERNAL_ERROR, "Verdict generation failed: finalAssessment is null");
    if (!usageRisk) throw new AppError(ErrorCode.INTERNAL_ERROR, "Verdict generation failed: usageRisk is null");

    // 10. Confidence Governor
    let rawConfidence = calculateConfidence(validEngineResults).score;

    // Adjustments
    rawConfidence *= conflict.confidence_adjustment;
    rawConfidence *= metaJudgment.confidence_adjustment;
    rawConfidence -= behavioral.timeline_confidence_penalty;
    if (memory.volatility > 20) rawConfidence *= 0.95;

    // Calibration
    const finalConfidence = calibrateConfidence(rawConfidence, verdict, totalScore, fragility.level, finalAssessment);

    // Range Calculation
    const confidenceRange = calculateConfidenceRange(finalConfidence, verdict, fragility.level, conflict, metaJudgment.source_diversity);

    // 11. Explanation & Output
    const epistemicProfile = buildEpistemicProfile(finalConfidence, verdict, fragility, conflict, metaJudgment);
    const reasoningGraph = buildReasoningGraph(aggregatedFeatures, verdict);

    const analystInsight = generateAnalystExplanation(
        validEngineResults,
        conflict,
        verdict,
        totalScore,
        fragility,
        confidenceRange,
        isRootTrusted,
        finalAssessment,
        artifactClass
    );

    const uncertaintyFlags = [
        ...metaJudgment.warnings || [],
        ...epistemicProfile.uncertainty_sources,
        ...(fragility.level === 'HIGH' ? ['High fragility'] : [])
    ];

    const analysisResult: AnalysisResult = {
        artifact: { raw: rawArtifact, type, canonical: artifact },
        verdict,
        riskScore: totalScore,
        confidence: finalConfidence,

        root_trusted: isRootTrusted,
        domain_trust: rootTrust.verdict,
        usage_risk: usageRisk,
        final_assessment: finalAssessment,

        confidence_level: finalConfidence,
        stability_score: parseFloat((1 - (fragility.score / 10)).toFixed(2)),
        uncertainty_flags: Array.from(new Set(uncertaintyFlags)),
        self_critique: {
             assumptions_made: metaJudgment.judgment_notes || [],
             what_might_be_wrong: fragility.reasons,
             missing_information: validEngineResults.length < 3 ? ['Limited engine coverage'] : []
        },

        meta_judgment: metaJudgment,
        fragility: fragility,
        contextual_verdict: contextDecision,
        semantic_intent: semanticIntentData,
        risk_timeline: riskTimeline,
        confidence_range: confidenceRange,
        epistemic_profile: epistemicProfile,
        contextual_verdicts: generateContextualVerdicts(verdict),

        behavioral_timeline: behavioral,
        infrastructure_intel: infrastructure,
        campaign_correlation: campaign,
        conflict_resolution: conflict,
        analyst_flags: {
            reputation_abuse: infrastructure.trusted_infra_abuse,
            high_fragility: fragility.level === 'HIGH',
            conflicting_signals: conflict.conflict_detected,
            requires_human_attention: conflict.conflict_detected || fragility.level === 'HIGH'
        },
        analyst_insight: analystInsight,

        analysis_quality: {
            confidence_level: finalConfidence > 0.8 ? 'high' : 'medium',
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
        summary: analystInsight.analyst_summary,
        features: aggregatedFeatures,
        explanation: {
            primaryFactors: analystInsight.analyst_takeaways,
            technicalAnalysis: whyItMatters.join('\n'),
            recommendedActions: [analystInsight.analyst_recommendation],
            summary: analystInsight.analyst_summary
        },
        meta: {
            executionTimeMs: Date.now() - start,
            cached: false,
            tierUsed: ['TIER_1_LOCAL', 'TIER_4_PLATFORM'],
            modelVersion: 'v4.0.0-final'
        }
    };

    // VALIDATION: Ensure Atomic Analysis
    validateAnalysisResult(analysisResult);

    // Persistence
    console.log('[Analysis] Persisting results');
    await updateMemory(env, artifact, totalScore);
    if (totalScore > 50) await updateCampaignMemory(env, fingerprint, artifact);
    env.ANALYSIS_CACHE.put(cacheKey, JSON.stringify(analysisResult), { expirationTtl: 86400 }).catch(console.error);

    console.log(`[Analysis] Completed in ${Date.now() - start}ms`);

    return new Response(JSON.stringify({
        ok: true,
        error_code: null,
        message: 'Analysis completed successfully',
        data: analysisResult,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        status: 'completed',
        result: analysisResult
    }), {
        headers: { ...securityHeaders, ...rlHeaders, 'Content-Type': 'application/json' } as any
    });
    } catch (e) {
        console.error('[Analysis] Fatal Execution Error:', e);
        if (e instanceof AppError) return createErrorResponse(e);
        return createErrorResponse(new AppError(ErrorCode.INTERNAL_ERROR, e instanceof Error ? e.message : 'Unknown fatal error', 500));
    }
}

function validateAnalysisResult(result: AnalysisResult) {
    // 1. Verdict Integrity
    const validVerdicts: RiskVerdict[] = ['MALICIOUS', 'SUSPICIOUS', 'BENIGN'];
    if (!result.verdict || !validVerdicts.includes(result.verdict)) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, `Analysis failed: Invalid verdict '${result.verdict}'`);
    }

    // 2. Confidence Integrity (Strict Range)
    // Confidence Governor guarantees min 0.40. Any lower means governance failed.
    if (typeof result.confidence !== 'number' || result.confidence < 0.40 || result.confidence > 1.0) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, `Analysis failed: Invalid confidence score ${result.confidence} (Must be 0.40 - 1.0)`);
    }

    // 3. Signal Integrity
    // Even 'Safe' domains should have signals (e.g. Allowlist match, Root Trust)
    if (!result.signals || result.signals.length === 0) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Analysis failed: No signals generated");
    }

    // 4. Explanation Integrity
    if (!result.explanation || !result.explanation.summary) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Analysis failed: Missing explanation");
    }

    // 5. Final Assessment Integrity
    const validAssessments: FinalAssessment[] = ['SAFE', 'SUSPICIOUS', 'TRUSTED_SERVICE_ABUSED', 'MALICIOUS_SERVICE'];
    if (!result.final_assessment || !validAssessments.includes(result.final_assessment)) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, `Analysis failed: Invalid final assessment '${result.final_assessment}'`);
    }
}
