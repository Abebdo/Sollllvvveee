import { EngineResult } from './types';
import { performCounterfactualAnalysis } from '../reasoning/counterfactual';

export interface ConfidenceFragilityResult {
    stability_score: number; // 0.0 - 1.0 (1.0 = highly stable, 0.0 = highly fragile)
    fragility_reasons: string[];
}

export function analyzeConfidenceFragility(results: EngineResult[], finalScore: number): ConfidenceFragilityResult {
    const reasons: string[] = [];
    let stability = 1.0;

    // 1. Safety Fragility (Allowlist Dependency)
    // Check if score is low (Safe) but underlying signals are high (Risky)
    const isSafe = finalScore < 50;

    if (isSafe) {
        const reputationEngine = results.find(r => r.name === 'reputation');
        const riskyEngines = results.filter(r => r.score > 50 && r.name !== 'reputation');

        // Case: Safe because of Reputation Allowlist
        // Note: The orchestrator handles the override, but we need to know if it *would have been* risky.
        if (reputationEngine && reputationEngine.score === 0 && reputationEngine.confidence === 1.0 && riskyEngines.length > 0) {
            // "Safe ONLY because of allowlist"
            stability = 0.3; // Very low stability
            reasons.push(`Verdict is heavily dependent on 'reputation' allowlist despite ${riskyEngines.length} other engines flagging risk.`);
            reasons.push(...riskyEngines.map(r => `Engine '${r.name}' detected risk score ${r.score} which was suppressed.`));
        } else if (riskyEngines.length > 0) {
             // Safe because final score is low (maybe averaged down? or manual override?)
             // But some engines think it's risky.
             stability = 0.5;
             reasons.push(`Consensus is weak: ${riskyEngines.length} engines detected high risk.`);
        }
    }

    // 2. Risk Fragility (Single Point of Failure)
    // If score is High, is it because of just one feature?
    if (!isSafe) {
        // Use existing counterfactual logic for risk sensitivity
        const cf = performCounterfactualAnalysis(results, finalScore);

        // Invert sensitivity to get stability (0 sensitivity = 1 stability)
        // Sensitivity 1.0 means removing one feature drops score to 0 -> Stability 0.0
        const riskStability = 1.0 - cf.sensitivity;

        if (riskStability < stability) {
            stability = riskStability;
        }

        if (cf.sensitivity > 0.6) {
             reasons.push('Risk score is highly sensitive to a single signal feature.');
             reasons.push(...cf.critical_dependencies.map(id => `Removing '${id}' would significantly drop the risk score.`));
        }

        if (cf.fragile_assumptions.length > 0) {
            reasons.push('Key risk factors rely on low-confidence evidence.');
        }
    }

    return {
        stability_score: parseFloat(stability.toFixed(2)),
        fragility_reasons: reasons
    };
}
