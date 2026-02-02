import { Env, AnalysisRequest, AnalysisResult, RiskVerdict, FeatureResult, ApiResponse, RiskTimelineStage, AnalystFlags, AnalystInsight, ConflictResolution } from './types';
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

import { consultMemory, updateMemory, consultCampaignMemory, updateCampaignMemory } from './memory/analytical_memory';
import { analyzeBehavioralTimeline } from './analysis/behavioral_timeline';
import { analyzeInfrastructure } from './analysis/infrastructure_intel.ts';
import { analyzeCampaignCorrelation, generateCampaignFingerprint } from './analysis/campaign_correlation';

import { AppError, ErrorCode, createErrorResponse } from './errors';
import { analyzeTemporal } from './temporal';
import { calculateConfidence, calibrateConfidence, calculateConfidenceRange } from './confidence';
import { buildReasoningGraph } from './reasoning';
import { CognitiveTraceStep } from './cognitive_trace';
import { SelfCritique } from './types';
import { analyzeConflict } from './analysis/conflict_resolution';
import { generateAnalystExplanation } from './explanation/human_explanation';
import { expandUrl } from './analysis/url_expansion';

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

    let artifact = sanitizeInput(rawArtifact);
    let type = classifyArtifact(artifact);
    const context = body.context;

    // URL Expansion
    if (type === 'url') {
        const expanded = await expandUrl(artifact);
        if (expanded !== artifact) {
            artifact = expanded;
            // Re-classify just in case, though likely still URL
             type = classifyArtifact(artifact);
        }
    }

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

    // --- PHASE 2: Conflict Resolution, Meta-Judgment & Fragility ---

    const conflict = analyzeConflict(validEngineResults);
    const metaJudgment = analyzeMetaJudgment(validEngineResults);
    const fragility = analyzeFragility(validEngineResults);

    // Apply Conflict Adjustments to Score
    if (conflict.conflict_detected && conflict.winning_signal !== 'REPUTATION') {
        // If conflict detected and Reputation lost, we must ensure the score reflects the risk
        // For 'INTENT' or 'BEHAVIOR' wins, we ensure a minimum score of 65 (Suspicious/Malicious)
        if (totalScore < 60) {
            totalScore = 65;
            whyItMatters.unshift(`Score adjusted due to conflict: ${conflict.primary_conflict}`);
            riskTimeline.push({ stage: 'Conflict Resolution Adjustment', score: totalScore });
        }
    }

    // --- PHASE 3: Analytical Memory, Temporal & Deep Intel ---

    const memory = await consultMemory(env, artifact);
    const temporalAnalysis = await analyzeTemporal(env, cacheKey, totalScore);

    // Phase 1 (New): Behavioral & Infrastructure
    const behavioral = analyzeBehavioralTimeline(totalScore, memory.history_scores);
    const infrastructure = analyzeInfrastructure(artifact, type);

    // Phase 2 (New): Campaign Correlation
    const fingerprint = generateCampaignFingerprint(artifact);
    const campaignMemory = await consultCampaignMemory(env, fingerprint);
    const campaign = analyzeCampaignCorrelation(artifact, campaignMemory);

    // Adjust Score based on Deep Intel
    if (behavioral.behavioral_drift === 'HIGH') {
        totalScore += 20;
        whyItMatters.push(`Behavioral Drift: ${behavioral.history_summary}`);
        riskTimeline.push({ stage: 'Behavioral Drift Adjustment', score: totalScore });
    } else if (behavioral.behavioral_drift === 'LOW') {
        totalScore += 10;
        whyItMatters.push(`Behavioral degradation detected`);
    }

    if (infrastructure.infrastructure_risk_score > 50) {
        totalScore += (infrastructure.infrastructure_risk_score * 0.2); // 20% weight
        whyItMatters.push(`Infrastructure Risk: ${infrastructure.provider_name} (${infrastructure.abuse_type || 'Potential Abuse'})`);
        riskTimeline.push({ stage: 'Infrastructure Risk Adjustment', score: totalScore });
    }

    if (campaign.campaign_confidence > 0.5) {
        totalScore += 15;
        whyItMatters.push(`Campaign Correlation: Linked to ${campaign.campaign_name}`);
        riskTimeline.push({ stage: 'Campaign Correlation Adjustment', score: totalScore });
    }

    // --- PHASE 4: Confidence Calibration & Contextual Verdict ---

    let finalConfidence = calculateConfidence(validEngineResults).score;
    const uncertaintyFlags: string[] = [];

    // Apply Conflict Adjustments to Confidence
    finalConfidence *= conflict.confidence_adjustment;
    if (conflict.conflict_detected) {
        uncertaintyFlags.push(`Confidence reduced due to conflict: ${conflict.primary_conflict}`);
    }

    // Apply Meta Adjustments
    finalConfidence *= metaJudgment.confidence_adjustment;
    uncertaintyFlags.push(...(metaJudgment.warnings || []));
    uncertaintyFlags.push(...metaJudgment.contradictions || []); // Compat

    // Apply Deep Intel Adjustments to Confidence
    finalConfidence -= behavioral.timeline_confidence_penalty;
    if (behavioral.timeline_confidence_penalty > 0) {
        uncertaintyFlags.push(`Confidence reduced due to behavioral instability (${(behavioral.timeline_confidence_penalty * 100).toFixed(0)}%)`);
    }

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

    // Verdict Logic (Initial)
    let verdict: RiskVerdict = 'UNKNOWN';
    if (totalScore > 80) verdict = 'MALICIOUS';
    else if (totalScore > 50) verdict = 'SUSPICIOUS';
    else verdict = 'BENIGN';

    // KILL ABSOLUTE TRUST: Downgrade 'BENIGN' if malicious intent is detected, even if score < 50 (unlikely due to adjustment above, but safety net)
    const semanticResult = validEngineResults.find(r => r.name === 'semantic');
    const semanticIntentData = semanticResult ? (semanticResult as any).semantic_intent : undefined;

    if (verdict === 'BENIGN' && semanticIntentData && semanticIntentData.intent === 'MALICIOUS') {
        verdict = 'SUSPICIOUS';
        totalScore = Math.max(totalScore, 55);
        riskTimeline.push({ stage: 'Absolute Trust Override', score: totalScore });
        whyItMatters.unshift("Verdict downgraded to SUSPICIOUS despite low score due to malicious intent detection.");
    }

    // Also apply logic for conflict result
    if (conflict.conflict_detected && conflict.winning_signal === 'INTENT' && verdict === 'BENIGN') {
        verdict = 'SUSPICIOUS';
        totalScore = Math.max(totalScore, 55);
    }

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

    // Final Confidence Calibration
    finalConfidence = calibrateConfidence(finalConfidence, verdict, totalScore, fragility.level);

    // Calculate Uncertainty Range
    const confidenceRange = calculateConfidenceRange(
        finalConfidence,
        verdict,
        fragility.level,
        conflict,
        metaJudgment.source_diversity
    );

    const reasoningGraph = buildReasoningGraph(aggregatedFeatures, verdict);

    // --- PHASE 5: Self-Critique, Analyst Insight & Output Construction ---

    const analystFlags: AnalystFlags = {
        reputation_abuse: conflict.conflict_detected && conflict.primary_conflict?.includes('Trusted Infrastructure') || false,
        high_fragility: fragility.level === 'HIGH',
        conflicting_signals: conflict.conflict_detected,
        requires_human_attention: conflict.conflict_detected || fragility.level === 'HIGH' || (verdict === 'SUSPICIOUS' && totalScore < 70)
    };

    const analystInsight = generateAnalystExplanation(validEngineResults, conflict, verdict, totalScore, fragility, confidenceRange);

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

    // Explanation Construction (Standard + Analyst Insight)
    const explanation = {
        summary: analystInsight.analyst_summary, // Use Analyst Summary
        positive_factors: validEngineResults.filter(r => r.score < 20).map(r => r.summary || `${r.name}: Low Risk`),
        negative_factors: validEngineResults.filter(r => r.score >= 20).map(r => r.summary || `${r.name}: High Risk`),
        weights: validEngineResults.reduce((acc, r) => ({ ...acc, [r.name]: r.score }), {}),
        reasoning_steps: metaJudgment.warnings || [],
        primaryFactors: analystInsight.analyst_takeaways, // Use Analyst Takeaways
        technicalAnalysis: whyItMatters.join('\n'),
        recommendedActions: [analystInsight.analyst_recommendation] // Use Analyst Recommendation
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

        // Competitive Intel Fields
        behavioral_timeline: behavioral,
        infrastructure_intel: infrastructure,
        campaign_correlation: campaign,

        // Phase 6 Fields
        conflict_resolution: conflict,
        analyst_flags: analystFlags,
        analyst_insight: analystInsight,

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
        summary: analystInsight.analyst_summary, // Use Analyst Summary
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

    // Update Campaign Memory
    if (totalScore > 50) {
        // Only track potential bad patterns to save space/noise?
        // Or track all for frequency analysis? Let's track all.
        await updateCampaignMemory(env, fingerprint, artifact);
    }

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
        meta_judgment: metaJudgment,
        conflict: conflict.conflict_detected
    }));

    return new Response(JSON.stringify(mixedResponse), {
        headers: { ...securityHeaders, ...rlHeaders, 'Content-Type': 'application/json' }
    });
}
