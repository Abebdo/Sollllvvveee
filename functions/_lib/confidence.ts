import { EngineResult } from './engines/types';
import { ConfidenceProfile, RiskVerdict, ConfidenceRange, ConflictResolution } from './types';

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

    // Rule: LEGITIMATE: mostLikely ∈ [70–95]
    // Rule: SUSPICIOUS: mostLikely ∈ [40–65]
    // Rule: MALICIOUS: mostLikely ∈ [65–90]

    switch (verdict) {
        case 'MALICIOUS':
            min = 0.65;
            max = 0.90;
            break;
        case 'SUSPICIOUS':
            min = 0.40;
            max = 0.65;
            break;
        case 'BENIGN':
            // LEGITIMATE
            // Must NOT fall below 60 unless fragility = HIGH
            if (fragilityLevel === 'HIGH') {
                 // Fragile benign -> lower confidence
                 min = 0.50;
                 max = 0.75;
            } else {
                 min = 0.70;
                 max = 0.95;
            }
            break;
        case 'UNKNOWN':
            min = 0.0;
            max = 0.50;
            break;
    }

    // Scale raw (0-1) to target (min-max)
    const calibrated = min + (rawConfidence * (max - min));
    return Number(calibrated.toFixed(2));
}

export function calculateConfidenceRange(
    confidenceScore: number, // 0-1, already calibrated
    verdict: RiskVerdict,
    fragilityLevel: 'LOW' | 'MEDIUM' | 'HIGH',
    conflict: ConflictResolution,
    sourceDiversityRatio: number
): ConfidenceRange {
    // 1. Base uncertainty
    let uncertainty = 0.10;

    // 2. Expand based on Fragility
    if (fragilityLevel === 'HIGH') uncertainty += 0.25;
    else if (fragilityLevel === 'MEDIUM') uncertainty += 0.10;

    // 3. Expand based on Conflict
    if (conflict.conflict_detected) uncertainty += 0.15;

    // 4. Expand based on Diversity
    if (sourceDiversityRatio < 0.3) uncertainty += 0.15;

    // Calculate Min/Max centered around confidenceScore
    let min = confidenceScore - (uncertainty / 2);
    let max = confidenceScore + (uncertainty / 2);

    // Clamp absolute bounds
    min = Math.max(0, min);
    max = Math.min(0.99, max); // Never 100%

    // Ensure range isn't inverted or weird
    if (min > max) min = max;

    return {
        min: Number(min.toFixed(2)),
        mostLikely: Number(confidenceScore.toFixed(2)),
        max: Number(max.toFixed(2)),
        uncertainty: Number((max - min).toFixed(2))
    };
}
