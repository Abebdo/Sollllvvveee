import { Env, AnalysisRequest, AnalysisResult } from './types';
import { validateInput, sanitizeInput, classifyArtifact } from './validation';
import { expandUrl } from './analysis/url_expansion';
import { EngineResult, EngineFunction } from './engine_contract';

// Engines
import { analyzeStructure } from './engines/structure.engine';
import { analyzeReputation } from './engines/reputation.engine';
import { analyzeSemantic } from './engines/semantic.engine';
import { analyzeContext } from './engines/context.engine';
import { analyzeBehavior } from './engines/behavior.engine';
import { analyzeRootTrust } from './engines/root_trust.engine';
import { analyzeMetaJudgment } from './engines/meta_judgment.engine';

// Scoring
import { calculateRiskScore } from './scoring/risk_scoring';
import { calculateConfidence } from './scoring/confidence';
import { calculateFragility } from './scoring/fragility';

// Utilities
import { AppError, ErrorCode, createErrorResponse } from './errors';

// Bootstrap: In a worker, imports are static, so this is just a sanity check if needed
function bootstrapEngines() {
    console.log('[BOOT] Engines ready');
}
bootstrapEngines();

export async function handleAnalysisRequest(request: Request, env: Env): Promise<Response> {
    const start = Date.now();

    try {
        if (request.method !== 'POST') {
             return createErrorResponse(new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Method not allowed', 405));
        }

        const body = await request.json() as AnalysisRequest;
        const rawArtifact = body.artifact;
        const context = body.context;

        // Validation
        const validation = validateInput(body);
        if (!validation.valid) {
             return createErrorResponse(new AppError(ErrorCode.VALIDATION_INVALID_INPUT, validation.error || 'Invalid input', 400));
        }

        let artifact = sanitizeInput(rawArtifact);
        let type = classifyArtifact(artifact);

        // Expansion (Best Effort)
        if (type === 'url') {
            try {
                const expanded = await expandUrl(artifact);
                if (expanded !== artifact) {
                    artifact = expanded;
                    // re-classify?
                }
            } catch (e) {
                console.warn('URL Expansion failed', e);
            }
        }

        // --- ENGINE EXECUTION ---
        const engines: Record<string, EngineFunction> = {
            'structure': analyzeStructure,
            'reputation': analyzeReputation,
            'semantic': analyzeSemantic,
            'context': analyzeContext,
            'behavior': analyzeBehavior,
            'root_trust': analyzeRootTrust
        };

        const enginePromises = Object.entries(engines).map(async ([name, fn]) => {
            try {
                const result = await fn(artifact, type, context);
                return result;
            } catch (e) {
                console.error(`[ENGINE_FAIL] ${name}`, e);
                // Return degraded result
                return {
                    engine: name,
                    executed: false,
                    error: e instanceof Error ? e.message : String(e),
                    signals: [],
                    verification: [], // Failed execution has no verification
                    confidenceImpact: 0,
                    metadata: {}
                } as EngineResult;
            }
        });

        const engineResults = await Promise.all(enginePromises);

        // --- AGGREGATION ---

        // 1. Root Trust (Special handling)
        const rootTrustResult = engineResults.find(r => r.engine === 'root_trust');
        const isRootTrusted = rootTrustResult?.metadata?.is_trusted === true;

        // 2. Meta Judgment (Analyzes the results)
        const metaJudgment = analyzeMetaJudgment(engineResults);

        // 3. Fragility
        const fragility = calculateFragility(engineResults);

        // 4. Semantic Intent (needed for overrides)
        const semanticResult = engineResults.find(r => r.engine === 'semantic');
        let intent: 'MALICIOUS' | 'SUSPICIOUS' | 'BENIGN' | undefined;
        // Check semantic signals
        if (semanticResult) {
             // Logic to determine intent from signals?
             // Simplification: if sensitive_keywords signal exists -> SUSPICIOUS/MALICIOUS
             if (semanticResult.signals.some(s => s.id === 'sensitive_keywords')) {
                 intent = 'SUSPICIOUS';
             }
        }

        // 5. Risk Scoring
        const riskAnalysis = calculateRiskScore(engineResults, isRootTrusted, intent);

        // 6. Confidence
        const confidenceAnalysis = calculateConfidence(engineResults, fragility, riskAnalysis.verdict, isRootTrusted);

        // --- RESPONSE ASSEMBLY ---

        // Map signals to string[] for existing UI compat
        const allSignals = engineResults.flatMap(r => r.signals.map(s => s.name));

        // Verification signals (Proof of work)
        // If benign, we MUST show something.
        const verificationChecks = engineResults.flatMap(r => r.verification.map(v => `${v.check}: ${v.status}`));

        const finalSignals = allSignals.length > 0 ? allSignals : verificationChecks;

        const analysisResult: AnalysisResult = {
            artifact: { raw: rawArtifact, type, canonical: artifact },
            verdict: riskAnalysis.verdict,
            riskScore: riskAnalysis.totalScore,
            confidence: confidenceAnalysis.score,

            // New Fields
            root_trusted: isRootTrusted,
            final_assessment: riskAnalysis.finalAssessment,
            usage_risk: riskAnalysis.usageRisk,

            signals: finalSignals,
            why_it_matters: [riskAnalysis.summary], // Primary explanation
            summary: riskAnalysis.summary,

            features: {}, // Populate if needed

            // Intelligence Data
            fragility: fragility,
            confidence_range: confidenceAnalysis.range,
            meta_judgment: metaJudgment,

            epistemic_profile: {
                confidence_range: confidenceAnalysis.range,
                fragility_level: fragility.level,
                uncertainty_sources: fragility.reasons,
                what_would_change_verdict: ['New forensic evidence', 'Change in domain reputation']
            },

            analyst_insight: {
                analyst_summary: riskAnalysis.summary,
                analyst_takeaways: allSignals,
                analyst_recommendation: riskAnalysis.finalAssessment === 'SAFE' ? 'No action needed.' : 'Exercise caution.'
            },

            explanation: {
                summary: riskAnalysis.summary,
                primaryFactors: allSignals,
                technicalAnalysis: `Analyzed by ${engineResults.filter(r => r.executed).length} engines.`,
                recommendedActions: [riskAnalysis.finalAssessment === 'SAFE' ? 'No action needed.' : 'Exercise caution.']
            },

            meta: {
                executionTimeMs: Date.now() - start,
                cached: false,
                tierUsed: ['TIER_1_LOCAL'],
                modelVersion: 'v5.0.0-rebuild'
            }
        };

        return new Response(JSON.stringify({
            ok: true,
            error_code: null,
            message: 'Analysis completed successfully',
            data: analysisResult
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error('[ORCHESTRATOR_FATAL]', e);
        // Fallback response? No, prompt says "User must never see HTTP 500".
        // Use a conservative fallback.
        const fallbackResult: AnalysisResult = {
            artifact: { raw: 'unknown', type: 'text', canonical: 'unknown' },
            verdict: 'SUSPICIOUS', // Conservative default
            riskScore: 50,
            confidence: 0,
            signals: ['System Degraded'],
            summary: 'Analysis incomplete due to internal error.',
            why_it_matters: ['Internal degradation occurred.'],
            explanation: {
                 summary: 'System encountered an error.',
                 primaryFactors: [],
                 technicalAnalysis: 'Fallback mode.',
                 recommendedActions: ['Retry later']
            },
            features: {},
            meta: {
                executionTimeMs: Date.now() - start,
                cached: false,
                tierUsed: [],
                modelVersion: 'v5.0.0-fallback'
            }
        };

        return new Response(JSON.stringify({
            ok: true,
            error_code: null,
            message: 'Analysis completed with errors',
            data: fallbackResult
        }), {
             headers: { 'Content-Type': 'application/json' }
        });
    }
}
