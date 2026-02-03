import { EngineResult } from '../engine_contract';
import { ConfidenceRange, RiskVerdict, FragilityResult } from '../types';

export interface ConfidenceCalculation {
    score: number; // 0.0 - 1.0 (Most Likely)
    range: ConfidenceRange;
}

export function calculateConfidence(
    results: EngineResult[],
    fragility: FragilityResult,
    verdict: RiskVerdict,
    isRootTrusted: boolean
): ConfidenceCalculation {

    // Base Confidence: Average of successful engine impacts
    // Engines declare their own confidence impact
    const successfulEngines = results.filter(r => r.executed && !r.error);
    if (successfulEngines.length === 0) {
        return {
            score: 0,
            range: { min: 0, mostLikely: 0, max: 0, uncertainty: 'HIGH' }
        };
    }

    let baseConfidence = successfulEngines.reduce((sum, r) => sum + r.confidenceImpact, 0) / successfulEngines.length;

    // Adjustments
    if (isRootTrusted) {
        baseConfidence = 0.99; // Extremely confident about Google/MSFT logic
    }

    // Fragility Penalty
    if (fragility.level === 'HIGH') baseConfidence *= 0.7;
    if (fragility.level === 'MEDIUM') baseConfidence *= 0.9;

    // Verdict Specifics
    // It's harder to be sure something is BENIGN than MALICIOUS (Proving a negative)
    if (verdict === 'BENIGN' && !isRootTrusted) {
        baseConfidence = Math.min(baseConfidence, 0.95); // Never 100% for unknown benign
    }

    // Range Calculation
    let rangeWidth = 0.1; // Default tight range
    let uncertainty: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    if (fragility.level === 'HIGH') {
        rangeWidth = 0.4;
        uncertainty = 'HIGH';
    } else if (fragility.level === 'MEDIUM') {
        rangeWidth = 0.2;
        uncertainty = 'MEDIUM';
    }

    const mostLikely = parseFloat(baseConfidence.toFixed(2));
    const min = parseFloat(Math.max(0, mostLikely - rangeWidth).toFixed(2));
    const max = parseFloat(Math.min(1, mostLikely + rangeWidth).toFixed(2));

    return {
        score: mostLikely,
        range: {
            min,
            mostLikely,
            max,
            uncertainty
        }
    };
}
