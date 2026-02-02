import { EngineResult } from './types';
import { MetaJudgmentResult } from '../types';

export function analyzeMetaJudgment(results: EngineResult[]): MetaJudgmentResult {
    const validResults = results.filter(r => r && typeof r.score === 'number');

    if (validResults.length === 0) {
        return {
            source_diversity: 0,
            agreement_score: 0,
            echo_chamber_risk: 'HIGH',
            fragility_level: 'HIGH',
            confidence_adjustment: 0.5,
            warnings: ['No valid engine results available'],
            consensus_score: 0,
            disagreement_level: 'high',
            contradictions: ['No valid engine results available'],
            judgment_notes: ['Insufficient data for judgment']
        };
    }

    // 1. Calculate Statistics
    const scores = validResults.map(r => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + Math.pow(b - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const agreementScore = Math.max(0, parseFloat((1 - (stdDev / 50)).toFixed(2)));

    // 2. Disagreement Level (Legacy)
    let disagreement_level: 'low' | 'medium' | 'high';
    if (stdDev < 15) disagreement_level = 'low';
    else if (stdDev < 30) disagreement_level = 'medium';
    else disagreement_level = 'high';

    // 3. Source Diversity
    // Count engines that contributed features or significant signals
    const contributingEngines = validResults.filter(r =>
        (r.features && r.features.length > 0) || r.score > 0
    );
    // Use total result count as base, but ensure at least 1
    const sourceDiversity = parseFloat((contributingEngines.length / Math.max(1, results.length)).toFixed(2));

    const warnings: string[] = [];
    const notes: string[] = [];
    let adjustment = 1.0;
    let fragility_level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    // 4. Fragility & Contradiction Logic

    // Rule: Diversity < 0.3 => degrade confidence
    if (sourceDiversity < 0.3) {
        adjustment *= 0.8;
        warnings.push('Low source diversity: verdict relies on too few engines.');
        if (fragility_level !== 'HIGH') fragility_level = 'MEDIUM';
    }

    // Echo Chamber Risk Calculation
    // If diversity is low, risk is high.
    // If diversity is medium/high but we suspect correlated errors (e.g. all static)
    let echo_chamber_risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (sourceDiversity < 0.4) {
        echo_chamber_risk = 'HIGH';
    } else if (sourceDiversity < 0.6) {
        echo_chamber_risk = 'MEDIUM';
    }

    // Rule: Reputation vs Reality
    // If reputation is safe (0) but heuristics/behavior is risky (>40)
    const reputation = validResults.find(r => r.name === 'reputation');
    // Note: 'semantic' engine might not be in results yet if not called, but logic holds.
    const riskyEngines = validResults.filter(r => r.score > 40 && r.name !== 'reputation');

    if (reputation && reputation.score === 0 && riskyEngines.length > 0) {
        warnings.push('Reputation safe-list contradicted by active risk signals');
        notes.push(`Reputation is clean, but [${riskyEngines.map(r => r.name).join(', ')}] detected risks.`);
        adjustment *= 0.6; // Heavy penalty
        fragility_level = 'HIGH';
    }

    // Rule: Agreement Illusion (High confidence but high disagreement)
    if (agreementScore < 0.6) {
        warnings.push('Engines disagree significantly on the risk level.');
        adjustment *= 0.8;
        if (fragility_level === 'LOW') fragility_level = 'MEDIUM';
    }

    // Rule: Single Source Reliance (if only 1 engine returned result)
    if (validResults.length === 1) {
        warnings.push('Verdict relies on a single engine source.');
        adjustment *= 0.7;
        fragility_level = 'HIGH';
        echo_chamber_risk = 'HIGH';
    }

    return {
        source_diversity: sourceDiversity,
        agreement_score: agreementScore,
        echo_chamber_risk,
        fragility_level,
        confidence_adjustment: parseFloat(adjustment.toFixed(2)),
        warnings,
        // Compat
        consensus_score: agreementScore,
        disagreement_level,
        contradictions: warnings,
        judgment_notes: notes
    };
}
