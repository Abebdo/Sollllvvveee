import { EngineResult } from './engines/types';
import { ConfidenceProfile } from './types';

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

    // Clamp 0-1
    score = Math.max(0, Math.min(1, score));

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
