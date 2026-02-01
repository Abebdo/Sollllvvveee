import { EngineResult } from './types';
import { MetaAnalysisResult } from '../types';

/**
 * Meta-Analysis Engine
 *
 * Purpose: Evaluate the outputs of all engines to detect disagreement,
 * conflicting signals, and over-dominant features.
 */
export function analyzeMeta(results: EngineResult[]): MetaAnalysisResult {
  const validResults = results.filter(r => r && typeof r.score === 'number');

  if (validResults.length === 0) {
    return {
      consensus_score: 0,
      disagreement_level: 'high',
      dominant_engines: [],
      weak_assumptions: ['No valid engine results available for meta-analysis']
    };
  }

  // 1. Calculate Score Statistics
  const scores = validResults.map(r => r.score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Variance & Standard Deviation
  const variance = scores.reduce((a, b) => a + Math.pow(b - avgScore, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // 2. Consensus Score
  // Normalized 0-1.
  // Max possible disagreement is roughly 0 vs 100 -> stdDev ~50.
  const consensus_score = Math.max(0, Math.min(1, 1 - (stdDev / 40)));

  // 3. Disagreement Level
  let disagreement_level: 'low' | 'medium' | 'high';
  if (stdDev < 10) disagreement_level = 'low';
  else if (stdDev < 25) disagreement_level = 'medium';
  else disagreement_level = 'high';

  // 4. Dominant Engines
  // Engines pulling the score significantly away from the average (or 0)
  const dominant_engines = validResults
    .filter(r => r.score > avgScore + 20 || (avgScore < 20 && r.score > 50))
    .map(r => r.name);

  // 5. Weak Assumptions
  // Engines contributing to risk but with low self-reported confidence
  // OR engines with high score but completely contradicting the consensus (if consensus is high elsewhere)
  const weak_assumptions: string[] = [];

  validResults.forEach(r => {
    if (r.confidence < 0.6 && r.score > 10) {
      weak_assumptions.push(`Engine '${r.name}' reports risk with low confidence (${r.confidence.toFixed(2)})`);
    }
    // If we have high disagreement and this engine is an outlier on the high side
    if (disagreement_level === 'high' && r.score > avgScore + 30) {
      weak_assumptions.push(`Engine '${r.name}' is a high-risk outlier in a high-disagreement context`);
    }
  });

  return {
    consensus_score: parseFloat(consensus_score.toFixed(2)),
    disagreement_level,
    dominant_engines,
    weak_assumptions
  };
}
