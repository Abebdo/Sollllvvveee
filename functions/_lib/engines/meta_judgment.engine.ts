import { EngineResult } from './types';

export interface MetaJudgmentResult {
    consensus_score: number;
    disagreement_level: 'low' | 'medium' | 'high';
    contradictions: string[];
    confidence_adjustment: number; // Multiplier (0.0 - 1.0)
    judgment_notes: string[];
}

export function analyzeMetaJudgment(results: EngineResult[]): MetaJudgmentResult {
    const validResults = results.filter(r => r && typeof r.score === 'number');

    if (validResults.length === 0) {
        return {
            consensus_score: 0,
            disagreement_level: 'high',
            contradictions: ['No valid engine results available'],
            confidence_adjustment: 0.5,
            judgment_notes: ['Insufficient data for judgment']
        };
    }

    // 1. Calculate Statistics
    const scores = validResults.map(r => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + Math.pow(b - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // 2. Disagreement Level
    let disagreement_level: 'low' | 'medium' | 'high';
    if (stdDev < 15) disagreement_level = 'low';
    else if (stdDev < 30) disagreement_level = 'medium';
    else disagreement_level = 'high';

    const contradictions: string[] = [];
    const notes: string[] = [];
    let adjustment = 1.0;

    // 3. Detect Contradictions

    // Contradiction: Low Risk vs High Anomaly
    // If average score is low (< 30) but any engine reports high score (> 70)
    const highRiskOutliers = validResults.filter(r => r.score > 70);
    if (avgScore < 30 && highRiskOutliers.length > 0) {
        contradictions.push('Low overall risk contradicted by specific high-risk signals');
        notes.push(`Engines [${highRiskOutliers.map(r => r.name).join(', ')}] detected high risk despite low average.`);
        adjustment *= 0.7; // Significant downgrade
    }

    // Contradiction: High Confidence vs Weak Evidence
    // If average confidence is high (> 0.9) but we have few features or low diversity
    const totalFeatures = validResults.reduce((acc, r) => acc + (r.features ? r.features.length : 0), 0);
    const avgConfidence = validResults.reduce((a, b) => a + b.confidence, 0) / validResults.length;

    if (avgConfidence > 0.9 && totalFeatures < 3) {
        contradictions.push('High confidence unsupported by deep evidence diversity');
        notes.push('Verdict is confident but relies on sparse signals.');
        adjustment *= 0.8;
    }

    // Disagreement Penalty
    if (disagreement_level === 'high') {
        notes.push('High disagreement between engines indicates ambiguous artifact.');
        adjustment *= 0.7;
    } else if (disagreement_level === 'medium') {
        adjustment *= 0.9;
    }

    // Specific check: Reputation says Safe (0), but Baseline/Heuristic says Risky (>50)
    const reputation = validResults.find(r => r.name === 'reputation');
    const riskyEngines = validResults.filter(r => r.score > 50 && r.name !== 'reputation');

    if (reputation && reputation.score === 0 && riskyEngines.length > 0) {
        contradictions.push('Reputation safe-list contradicted by behavioral/heuristic anomalies');
        notes.push(`Reputation is clean, but [${riskyEngines.map(r => r.name).join(', ')}] detected risks.`);
        // We do NOT let reputation override blindly anymore.
        // We downgrade confidence in the "Safe" verdict if the final score ends up being low,
        // OR we ensure the final score reflects the risk (orchestrator job).
        // Here we just downgrade confidence in the *judgment*.
        adjustment *= 0.6;
    }

    return {
        consensus_score: parseFloat((1 - (stdDev / 50)).toFixed(2)), // Approx
        disagreement_level,
        contradictions,
        confidence_adjustment: parseFloat(adjustment.toFixed(2)),
        judgment_notes: notes
    };
}
