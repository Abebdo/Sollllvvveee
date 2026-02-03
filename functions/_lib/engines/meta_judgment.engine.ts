import { EngineResult } from '../engine_contract';
import { MetaJudgmentResult } from '../types';

export function analyzeMetaJudgment(results: EngineResult[]): MetaJudgmentResult {
    const executed = results.filter(r => r.executed);

    // 1. Source Diversity
    // Group by engine "family" (heuristic, reputation, semantic)
    const families = new Set<string>();
    results.forEach(r => {
        if (r.engine === 'structure') families.add('heuristic');
        if (r.engine === 'reputation') families.add('reputation');
        if (r.engine === 'semantic') families.add('semantic');
        if (r.engine === 'context') families.add('context');
        if (r.engine === 'behavior') families.add('behavior');
    });

    const diversityScore = Math.min(1.0, families.size / 5); // Normalized roughly (5 families supported)

    // 2. Agreement
    // Do engines agree on Risk vs Safe?
    // Count engines with signals vs without
    const riskEngines = executed.filter(r => r.signals.length > 0).length;
    const cleanEngines = executed.filter(r => r.signals.length === 0).length;

    let agreementScore = 1.0;
    if (riskEngines > 0 && cleanEngines > 0) {
        // Disagreement
        agreementScore = Math.max(0.5, 1 - (Math.min(riskEngines, cleanEngines) / executed.length));
    }

    // 3. Echo Chamber Risk
    // If only reputation engines ran -> High Risk
    let echoChamber: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (families.size === 1 && families.has('reputation')) echoChamber = 'HIGH';

    return {
        source_diversity: diversityScore,
        agreement_score: agreementScore,
        echo_chamber_risk: echoChamber,
        fragility_level: 'LOW', // Calculated separately by Fragility Engine, but required by type
        confidence_adjustment: (diversityScore * 0.5) + (agreementScore * 0.5),
        warnings: echoChamber === 'HIGH' ? ['Analysis relied on a single type of intelligence source'] : [],
        engine_count: executed.length,
        engine_family_diversity: diversityScore,
        agreement_ratio: agreementScore
    };
}
