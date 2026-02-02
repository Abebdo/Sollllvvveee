import { EngineResult } from './engines/types';
import { ConfidenceProfile, RiskVerdict, ConfidenceRange, ConflictResolution, UsageRiskVerdict, FinalAssessment } from './types';

export function calculateConfidence(results: EngineResult[]): ConfidenceProfile {
    // Filter out failed engines or those with 0 confidence
    const validResults = results.filter(r => r && r.confidence > 0);

    if (validResults.length === 0) {
        return { score: 0, reasons: ['No engines returned results'] };
    }

    // 1. Base Confidence: Average of engine confidences
    const avgEngineConfidence = validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length;

    // 2. Agreement Factor
    const riskyCount = validResults.filter(r => r.score >= 50).length;
    const safeCount = validResults.filter(r => r.score < 50).length;

    let agreementFactor = 0;
    let agreementReason = "Mixed signals from engines";

    if (riskyCount === validResults.length || safeCount === validResults.length) {
        agreementFactor = 0.15;
        agreementReason = "Consensus across all engines";
    } else if (riskyCount > 0 && safeCount > 0) {
        agreementFactor = -0.1;
        agreementReason = "Conflicting engine signals (Ambiguous)";
    }

    // 3. Engine Count Factor
    const countFactor = Math.min(0.1, validResults.length * 0.02);

    let score = avgEngineConfidence + agreementFactor + countFactor;

    // Engine 50 — Final Confidence Governor (NO 100%)
    // Clamp 0-0.98
    score = Math.max(0, Math.min(0.98, score));

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

/**
 * Engine 60 & 69 — Confidence Governor & Calibration Table
 * STRICTLY enforces confidence ranges based on Verdict.
 */
export function calibrateConfidence(
    rawConfidence: number,
    verdict: RiskVerdict,
    riskScore: number,
    fragilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW',
    finalAssessment?: FinalAssessment
): number {
    let min = 0;
    let max = 0.95;

    // SECTION 69 — CONFIDENCE CALIBRATION TABLE (MANDATORY)
    // Verdict	Allowed Confidence Range
    // Safe	85% – 99%
    // Safe with reservations	70% – 90%
    // Suspicious	40% – 70%
    // High Risk	65% – 85%
    // Malicious	75% – 98%

    if (verdict === 'MALICIOUS') {
        if (riskScore >= 90) {
             // Confirmed Malicious
             min = 0.85;
             max = 0.98;
        } else {
             // Likely Malicious / High Risk
             min = 0.75;
             max = 0.85;
        }
    } else if (verdict === 'SUSPICIOUS') {
         // Suspicious
         min = 0.40;
         max = 0.70;
    } else if (verdict === 'BENIGN') {
        if (finalAssessment === 'TRUSTED_SERVICE_ABUSED' || fragilityLevel === 'HIGH' || fragilityLevel === 'MEDIUM') {
             // Safe with reservations / Contextual Risk
             min = 0.70;
             max = 0.90;
        } else {
             // Safe / Legitimate
             min = 0.85;
             max = 0.98; // Cap at 98% (No 100%)
        }
    } else {
        // UNKNOWN
        min = 0.0;
        max = 0.50;
    }

    // Scale raw (0-1) to target (min-max)
    // We use the raw confidence as a position within the allowed range
    const calibrated = min + (rawConfidence * (max - min));

    // Final clamp to ensure we never break the Governor rules
    return Number(Math.max(min, Math.min(max, calibrated)).toFixed(2));
}

export function calculateConfidenceRange(
    confidenceScore: number, // 0-1, already calibrated
    verdict: RiskVerdict,
    fragilityLevel: 'LOW' | 'MEDIUM' | 'HIGH',
    conflict: ConflictResolution,
    sourceDiversityRatio: number
): ConfidenceRange {
    // 1. Calculate Uncertainty Width
    // Base width
    let width = 0.10;

    // Expand based on Fragility
    if (fragilityLevel === 'HIGH') width += 0.25;
    else if (fragilityLevel === 'MEDIUM') width += 0.10;

    // Expand based on Conflict
    if (conflict.conflict_detected) width += 0.15;

    // Expand based on Diversity
    if (sourceDiversityRatio < 0.3) width += 0.15;

    // Rule: Legitimate verdicts must still show uncertainty unless High diversity, No conflicts, Low fragility
    if (verdict === 'BENIGN') {
        const isIdeal = fragilityLevel === 'LOW' && !conflict.conflict_detected && sourceDiversityRatio > 0.6;
        if (!isIdeal) {
             width = Math.max(width, 0.15); // Ensure at least moderate uncertainty
        }
    }

    // Calculate Min/Max centered around confidenceScore
    let min = confidenceScore - (width / 2);
    let max = confidenceScore + (width / 2);

    // Clamp absolute bounds
    // Rule: 100% confidence is forbidden
    min = Math.max(0.1, min); // Never 0
    max = Math.min(0.99, max); // Never 100

    // Ensure range isn't inverted
    if (min > max) min = max;

    // Determine Uncertainty Level
    let uncertaintyLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    if (width >= 0.30) uncertaintyLevel = 'HIGH';
    else if (width >= 0.15) uncertaintyLevel = 'MEDIUM';
    else uncertaintyLevel = 'LOW';

    return {
        min: Number(min.toFixed(2)),
        mostLikely: Number(confidenceScore.toFixed(2)),
        max: Number(max.toFixed(2)),
        uncertainty: uncertaintyLevel
    };
}
