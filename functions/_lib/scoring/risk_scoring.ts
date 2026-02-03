import { EngineResult, Signal } from '../engine_contract';
import { RiskVerdict, UsageRiskVerdict, FinalAssessment } from '../types';

export interface ScoreResult {
    totalScore: number;
    verdict: RiskVerdict;
    usageRisk: UsageRiskVerdict;
    finalAssessment: FinalAssessment;
    summary: string;
}

export function calculateRiskScore(
    results: EngineResult[],
    isRootTrusted: boolean,
    contextIntent?: 'MALICIOUS' | 'SUSPICIOUS' | 'BENIGN'
): ScoreResult {
    let totalScore = 0;
    const signals: Signal[] = results.flatMap(r => r.signals);

    // Sum signals
    for (const signal of signals) {
        totalScore += signal.score_contribution;
    }

    // Cap at 100
    totalScore = Math.min(100, totalScore);

    // Baseline Verdict
    let verdict: RiskVerdict = 'BENIGN';
    if (totalScore >= 80) verdict = 'MALICIOUS';
    else if (totalScore >= 50) verdict = 'SUSPICIOUS';

    // Context / Intent Overrides
    if (contextIntent === 'MALICIOUS') {
        if (verdict === 'BENIGN') {
            verdict = 'SUSPICIOUS';
            totalScore = Math.max(60, totalScore);
        } else if (verdict === 'SUSPICIOUS') {
            verdict = 'MALICIOUS';
            totalScore = Math.max(85, totalScore);
        }
    }

    // Usage Risk (How is it being used?)
    let usageRisk: UsageRiskVerdict = 'BENIGN';
    if (contextIntent === 'MALICIOUS' || totalScore >= 80) usageRisk = 'MALICIOUS';
    else if (contextIntent === 'SUSPICIOUS' || totalScore >= 50) usageRisk = 'SUSPICIOUS';

    // Final Assessment (The User-Facing Verdict)
    let finalAssessment: FinalAssessment = 'SAFE';

    if (isRootTrusted) {
        // GOOGLE.COM RULE: Can never be MALICIOUS/SUSPICIOUS directly.
        // Can only be TRUSTED_SERVICE_ABUSED.
        if (usageRisk === 'MALICIOUS' || usageRisk === 'SUSPICIOUS' || totalScore > 50) {
            finalAssessment = 'TRUSTED_SERVICE_ABUSED';
            verdict = 'SUSPICIOUS'; // UI shows "Trusted Service - Suspicious Usage"
        } else {
            finalAssessment = 'SAFE';
            verdict = 'BENIGN';
            totalScore = 0; // Force 0 for clean trusted domains
        }
    } else {
        if (verdict === 'MALICIOUS') finalAssessment = 'MALICIOUS_SERVICE';
        else if (verdict === 'SUSPICIOUS') finalAssessment = 'SUSPICIOUS';
        else finalAssessment = 'SAFE';
    }

    return {
        totalScore,
        verdict,
        usageRisk,
        finalAssessment,
        summary: generateSummary(finalAssessment, verdict, totalScore, signals.length)
    };
}

function generateSummary(assessment: FinalAssessment, verdict: RiskVerdict, score: number, signalCount: number): string {
    if (assessment === 'SAFE') return "No risk signals detected. Resource appears legitimate.";
    if (assessment === 'TRUSTED_SERVICE_ABUSED') return "Legitimate service potentially being abused for malicious purposes.";
    if (assessment === 'MALICIOUS_SERVICE') return "High-confidence indicators of malicious activity detected.";
    if (assessment === 'SUSPICIOUS') return "Suspicious patterns detected, but evidence is inconclusive.";
    return "Analysis completed.";
}
