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
            engine_count: 0,
            engine_family_diversity: 0,
            agreement_ratio: 0,
            consensus_score: 0,
            disagreement_level: 'high',
            contradictions: ['No valid engine results available'],
            judgment_notes: ['Insufficient data for judgment']
        };
    }

    // 1. Engine Families
    const families = {
        heuristic: ['heuristic'],
        reputation: ['reputation'],
        static: ['structure', 'context'],
        semantic: ['semantic', 'baseline']
    };

    const presentFamilies = new Set<string>();
    validResults.forEach(r => {
        if (families.heuristic.includes(r.name)) presentFamilies.add('heuristic');
        else if (families.reputation.includes(r.name)) presentFamilies.add('reputation');
        else if (families.static.includes(r.name)) presentFamilies.add('static');
        else if (families.semantic.includes(r.name)) presentFamilies.add('semantic');
    });

    const engine_family_diversity = parseFloat((presentFamilies.size / 4).toFixed(2));

    // 2. Statistics
    const scores = validResults.map(r => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + Math.pow(b - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const agreementScore = Math.max(0, parseFloat((1 - (stdDev / 50)).toFixed(2)));

    // 3. Agreement Ratio (Consensus Direction)
    // How many agree with the majority direction (Safe < 50 vs Risky >= 50)
    const riskyCount = scores.filter(s => s >= 50).length;
    const safeCount = scores.filter(s => s < 50).length;
    const majorityCount = Math.max(riskyCount, safeCount);
    const agreement_ratio = parseFloat((majorityCount / validResults.length).toFixed(2));

    // 4. Source Diversity (Legacy Calculation)
    // Count engines that contributed features or significant signals
    const contributingEngines = validResults.filter(r =>
        (r.features && r.features.length > 0) || r.score > 0
    );
    const sourceDiversity = parseFloat((contributingEngines.length / Math.max(1, results.length)).toFixed(2));

    // 5. Echo Chamber Risk
    let echo_chamber_risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    // High risk if diversity is low OR if only one family is represented
    if (sourceDiversity < 0.4 || presentFamilies.size <= 1) {
        echo_chamber_risk = 'HIGH';
    } else if (presentFamilies.size === 2) {
        // e.g. only static + reputation (missing behavioral/heuristic)
        if (!presentFamilies.has('semantic')) {
            echo_chamber_risk = 'MEDIUM';
        }
    }

    // 6. Fragility & Adjustments
    const warnings: string[] = [];
    const notes: string[] = [];
    let adjustment = 1.0;
    let fragility_level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    // Rule: Diversity < 0.3 => degrade confidence
    if (sourceDiversity < 0.3) {
        adjustment *= 0.8;
        warnings.push('Low source diversity: verdict relies on too few engines.');
        if (fragility_level !== 'HIGH') fragility_level = 'MEDIUM';
    }

    // Rule: Agreement Illusion (High confidence but high disagreement)
    if (agreementScore < 0.6) {
        warnings.push('Engines disagree significantly on the risk level.');
        adjustment *= 0.8;
        if (fragility_level === 'LOW') fragility_level = 'MEDIUM';
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

    // Rule: Single Source Reliance (if only 1 engine returned result)
    if (validResults.length === 1) {
        warnings.push('Verdict relies on a single engine source.');
        adjustment *= 0.7;
        fragility_level = 'HIGH';
        echo_chamber_risk = 'HIGH';
    }

    // Rule: High Agreement but Low Diversity -> Penalize confidence
    if (agreement_ratio > 0.9 && engine_family_diversity < 0.5) {
        warnings.push('High agreement from low diversity sources (Echo Chamber Effect).');
        adjustment *= 0.85;
        echo_chamber_risk = 'HIGH';
    }

    // Disagreement Level (Legacy)
    let disagreement_level: 'low' | 'medium' | 'high';
    if (stdDev < 15) disagreement_level = 'low';
    else if (stdDev < 30) disagreement_level = 'medium';
    else disagreement_level = 'high';

    return {
        source_diversity: sourceDiversity,
        agreement_score: agreementScore,
        echo_chamber_risk,
        fragility_level,
        confidence_adjustment: parseFloat(adjustment.toFixed(2)),
        warnings,

        // Phase 1 Extensions
        engine_count: validResults.length,
        engine_family_diversity,
        agreement_ratio,

        // Compat
        consensus_score: agreementScore,
        disagreement_level,
        contradictions: warnings,
        judgment_notes: notes
    };
}
