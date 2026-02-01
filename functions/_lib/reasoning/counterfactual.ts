import { EngineResult } from '../engines/types';
import { CounterfactualResult } from '../types';

/**
 * Counterfactual Reasoning Engine
 *
 * Purpose: "What if this factor did not exist?"
 * Recomputes risk score multiple times by removing critical features to measure
 * sensitivity and dependency strength.
 */
export function performCounterfactualAnalysis(
  results: EngineResult[],
  initialScore: number
): CounterfactualResult {
  const critical_dependencies: string[] = [];
  const fragile_assumptions: string[] = [];

  // Map feature ID to the engines that detected it and its contribution
  const featureMap = new Map<string, { engineIndex: number, risk: number, desc: string }[]>();

  results.forEach((result, idx) => {
    if (!result.features) return;
    result.features.forEach(f => {
      // Only care about positive risk contributors for now (features that add risk)
      if (f.riskContribution > 0) {
        if (!featureMap.has(f.id)) featureMap.set(f.id, []);
        featureMap.get(f.id)!.push({ engineIndex: idx, risk: f.riskContribution, desc: f.description });
      }
    });
  });

  let maxDrop = 0;

  // Simulate removal of each feature one by one
  featureMap.forEach((occurrences, featureId) => {
    // Recalculate global score (max of engines) without this feature
    let newGlobalScore = 0;

    results.forEach((result, idx) => {
      // Check if this engine relied on the feature
      const occ = occurrences.find(o => o.engineIndex === idx);
      let simulatedEngineScore = result.score;

      if (occ) {
        // Subtract contribution.
        // Note: This assumes additive risk models (which Heuristic and Reputation use).
        // Since we don't have the raw unclamped sums, we subtract from the final clamped score.
        // This is a "conservative" estimate of sensitivity (might under-report sensitivity if score was capped).
        simulatedEngineScore = Math.max(0, simulatedEngineScore - occ.risk);
      }

      if (simulatedEngineScore > newGlobalScore) {
          newGlobalScore = simulatedEngineScore;
      }
    });

    const drop = initialScore - newGlobalScore;
    if (drop > maxDrop) maxDrop = drop;

    // Define "Critical Dependency":
    // If removing this feature causes a significant drop in the overall risk score.
    // Threshold: Drop of > 15 points OR > 20% of the initial score.
    if (drop > 15 || (initialScore > 20 && drop / initialScore > 0.2)) {
      critical_dependencies.push(featureId);

      // Check for fragility:
      // A feature is fragile if it is critical (high impact) but comes from a low-confidence source.
      const isFragile = occurrences.some(o => {
          const eng = results[o.engineIndex];
          // If the engine providing this critical signal has low confidence
          return eng.confidence < 0.7;
      });

      if (isFragile) {
          fragile_assumptions.push(featureId);
      }
    }
  });

  // Sensitivity: 0-1
  // How much the score relies on its single strongest feature.
  // 1.0 means the score drops to 0 if one feature is removed (highly sensitive/fragile).
  // 0.0 means the score is robust (redundant evidence).
  const sensitivity = initialScore > 0 ? parseFloat((maxDrop / initialScore).toFixed(2)) : 0;

  return {
    sensitivity,
    critical_dependencies,
    fragile_assumptions
  };
}
