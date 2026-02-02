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
        const rateLimiter = new RateLimiter(env, request);
        rlStatus = await rateLimiter.check(1);

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
    const validation = validateInput(rawArtifact);
    if (!validation.valid) {
        return createErrorResponse(new AppError(ErrorCode.VALIDATION_INVALID_INPUT, validation.error || 'Invalid input', 400));
    }

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
            const cachedString = await env.ANALYSIS_CACHE.get(cacheKey);
            if (cachedString) {
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
                    headers: { ...securityHeaders, ...rlHeaders, 'Content-Type': 'application/json' }
                });
            }
        } catch (e) {
            console.warn('Cache lookup failed', e);
        }
    }

    // --- EXECUTION ORDER ENFORCEMENT ---

    // 1. World Model & Root Trust
    const rootTrust = await analyzeRootTrust(artifact, type);
    const isRootTrusted = rootTrust.is_trusted;
    const realityRole = rootTrust.role;

    // 2. Parallel: Engines + Memory
    const enginePromises: Array<{ name: string; fn: () => any }> = [
        { name: 'reputation', fn: () => analyzeReputation(artifact, type) },
        { name: 'structure', fn: () => analyzeStructure(artifact, type) },
    ];

    if (artifactClass !== 'INFRASTRUCTURE_ROOT') {
        enginePromises.push(
            { name: 'context', fn: () => analyzeContext(artifact, type, context) },
            { name: 'heuristic', fn: () => analyzeHeuristic(artifact, type) },
            { name: 'baseline', fn: () => analyzeBaseline(artifact, type) },
            { name: 'semantic', fn: () => analyzeSemantic(artifact, type) }
        );
    }

    const [results, memoryResult] = await Promise.all([
        Promise.allSettled(enginePromises.map(async (e) => {
            const t0 = Date.now();
            try {
                const res = await e.fn();
                return { ...res, _meta: { name: e.name, duration: Date.now() - t0 } };
            } catch (err) {
                console.error(`Engine ${e.name} failed`, err);
                return null;
            }
        })),
        consultMemory(env, artifact)
    ]);

    const memory = memoryResult;

    // 3. Aggregation
    let totalScore = 0;
    const aggregatedFeatures: Record<string, FeatureResult> = {};
    const signals: string[] = [];
    const whyItMatters: string[] = [];
    const cognitiveTrace: CognitiveTraceStep[] = [];
    const validEngineResults: EngineResult[] = [];

    // Inject Root Trust result
    validEngineResults.push({
        ...rootTrust.engine_result,
        _meta: { name: 'root_trust', duration: 0 }
    } as any);

    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            const r = result.value as (EngineResult & { _meta: any });
            validEngineResults.push(r);

            if (r.features) r.features.forEach(f => aggregatedFeatures[f.id] = f);
            if (r.signals) signals.push(...r.signals);
            if (r.trace) cognitiveTrace.push(...r.trace);

            if (r.score > totalScore) totalScore = r.score;
            if (r.summary) whyItMatters.push(`${r.name}: ${r.summary}`);
        }
    }

    const riskTimeline: RiskTimelineStage[] = [];
    riskTimeline.push({ stage: 'Initial Aggregation', score: totalScore });

    // 4. Conflict Resolution & Context
    // Extract semantic intent early
    const semanticResult = validEngineResults.find(r => r.name === 'semantic');
    const semanticIntentData = semanticResult ? (semanticResult as any).semantic_intent : undefined;

    const conflict = analyzeConflict(validEngineResults, isRootTrusted);

    // Adjust Score based on Conflict
    if (conflict.conflict_detected && conflict.winning_signal !== 'REPUTATION') {
        if (totalScore < 60) {
            totalScore = 65;
            whyItMatters.unshift(`Score adjusted due to conflict: ${conflict.primary_conflict}`);
            riskTimeline.push({ stage: 'Conflict Resolution Adjustment', score: totalScore });
        }
    }

    // 5. Meta Judgment
    const metaJudgment = analyzeMetaJudgment(validEngineResults);

    // 6. Fragility (with Memory)
    const isFirstSeen = memory.seen_count === 0;
    const fragility = analyzeFragility(validEngineResults, isFirstSeen);

    // 7. Deep Intel (Behavioral, Infra, Campaign)
    const temporalAnalysis = await analyzeTemporal(env, cacheKey, totalScore);
    const behavioral = analyzeBehavioralTimeline(totalScore, memory.history_scores);
    const fingerprint = generateCampaignFingerprint(artifact);
    const campaignMemory = await consultCampaignMemory(env, fingerprint);
    const campaign = analyzeCampaignCorrelation(artifact, campaignMemory);

    // Analyze Infrastructure (Needs semantic intent)
    const infrastructure = analyzeInfrastructure(artifact, type, semanticIntentData?.intent);

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

    // 8. Verdict Logic
    let verdict: RiskVerdict = 'UNKNOWN';
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
    let usageRisk: UsageRiskVerdict = 'BENIGN';
    if (semanticIntentData) usageRisk = semanticIntentData.intent;
    else if (totalScore > 80) usageRisk = 'MALICIOUS';
    else if (totalScore > 50) usageRisk = 'SUSPICIOUS';

    let finalAssessment: FinalAssessment = 'SAFE';

    // FINAL SAFETY RULE & Root Trust Logic
    if (isRootTrusted) {
        if (infrastructure.trusted_infra_abuse || usageRisk === 'MALICIOUS') {
             finalAssessment = 'TRUSTED_SERVICE_ABUSED';
             if (verdict === 'BENIGN') verdict = 'SUSPICIOUS';
        } else {
             // NO ABUSE = LEGITIMATE
             finalAssessment = 'SAFE';
             verdict = 'BENIGN';
             totalScore = 0; // Force score to 0
        }
    } else {
         if (verdict === 'MALICIOUS') finalAssessment = 'MALICIOUS_SERVICE';
         else if (verdict === 'SUSPICIOUS') finalAssessment = 'SUSPICIOUS';
         else finalAssessment = 'SAFE';
    }

    // 9. Confidence Governor
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

    // 10. Explanation & Output
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

    // Persistence
    await updateMemory(env, artifact, totalScore);
    if (totalScore > 50) await updateCampaignMemory(env, fingerprint, artifact);
    env.ANALYSIS_CACHE.put(cacheKey, JSON.stringify(analysisResult), { expirationTtl: 86400 }).catch(console.error);

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
        headers: { ...securityHeaders, ...rlHeaders, 'Content-Type': 'application/json' }
    });
}
