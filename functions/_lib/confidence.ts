import { EngineResult } from './engines/types';
import { ConfidenceProfile, RiskVerdict } from './types';

export function calculateConfidence(results: EngineResult[]): ConfidenceProfile {
    // Filter out failed engines or those with 0 confidence
    const validResults = results.filter(r => r && r.confidence > 0);

    if (validResults.length === 0) {
        return { score: 0, reasons: ['No engines returned results'] };
    }

    // 1. Base Confidence: Average of engine confidences
    const avgEngineConfidence = validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length;

    // 2. Agreement Factor
    // Check if engines agree on the risk posture (Safe vs Risky)
    const riskyCount = validResults.filter(r => r.score >= 50).length;
    const safeCount = validResults.filter(r => r.score < 50).length;

    let agreementFactor = 0;
    let agreementReason = "Mixed signals from engines";

    if (riskyCount === validResults.length || safeCount === validResults.length) {
        // High agreement
        agreementFactor = 0.15;
        agreementReason = "Consensus across all engines";
    } else if (riskyCount > 0 && safeCount > 0) {
        // Disagreement penalty
        agreementFactor = -0.1;
        agreementReason = "Conflicting engine signals (Ambiguous)";
    }

    // 3. Engine Count Factor
    // More engines = more confidence
    const countFactor = Math.min(0.1, validResults.length * 0.02);

    let score = avgEngineConfidence + agreementFactor + countFactor;

    // Clamp 0-0.95 (Global Limit - NO 100% ALLOWED)
    score = Math.max(0, Math.min(0.95, score));

    const reasons = [
        `Base engine confidence: ${(avgEngineConfidence * 100).toFixed(0)}%`,
        agreementReason
    ];

    if (validResults.length > 2) {
        reasons.push(`Multi-engine verification (${validResults.length} sources)`);
    }

    return {
        score: Number(score.toFixed(2)),
        reasons
    };
}

export function calibrateConfidence(
    rawConfidence: number,
    verdict: RiskVerdict,
    riskScore: number,
    fragilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW'
): number {
    let min = 0;
    let max = 0.95;

    switch (verdict) {
        case 'MALICIOUS':
            // 70–95%
            min = 0.70;
            max = 0.95;
            break;
        case 'SUSPICIOUS':
            // 40–65%
            min = 0.40;
            max = 0.65;
            break;
        case 'BENIGN':
            // LIKELY LEGITIMATE -> 70–90% (Standard Benign)
            // MINIMAL RISK -> 55–80% (Maybe weak signal Benign?)
            // If Fragile or higher score, use MINIMAL RISK (55-80%)
            if (fragilityLevel !== 'LOW' || riskScore >= 30) {
                 min = 0.55;
                 max = 0.80;
            } else {
                 min = 0.70;
                 max = 0.90;
            }
            break;
        case 'UNKNOWN':
            min = 0.0;
            max = 0.50;
            break;
    }

    // Map the raw confidence into the target range [min, max]
    // This preserves relative confidence while enforcing boundaries
    // formula: min + (raw * (max - min))
    // But raw is already 0-0.95.
    // Let's just clamp it first?
    // If I have 0.95 raw and need 0.40-0.65.
    // Clamping would give 0.65.
    // Scaling would give 0.40 + 0.95 * 0.25 = 0.6375.
    // Scaling feels more "calibrated" than hard clamping.

    const range = max - min;
    const calibrated = min + (rawConfidence * range);

    return Number(calibrated.toFixed(2));
}
