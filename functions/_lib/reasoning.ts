import { FeatureResult, ReasoningGraph, ReasoningStep, RiskVerdict } from './types';

export function buildReasoningGraph(
  features: Record<string, FeatureResult>,
  verdict: RiskVerdict
): ReasoningGraph {
  // Sort features by impact magnitude (descending)
  const sortedFeatures = Object.values(features)
    .filter(f => f.detected && f.riskContribution !== 0)
    .sort((a, b) => Math.abs(b.riskContribution) - Math.abs(a.riskContribution));

  const chain: ReasoningStep[] = sortedFeatures.map(f => ({
    signal: f.id,
    evidence: f.evidence.join(', '),
    impact: f.riskContribution,
    why_it_matters: f.description
  }));

  // If no negative signals found but verdict is BENIGN
  if (chain.length === 0 && verdict === 'BENIGN') {
      chain.push({
          signal: 'no_threat_indicators',
          evidence: 'N/A',
          impact: 0,
          why_it_matters: 'No known malicious patterns or anomalies detected.'
      });
  }

  // Construct conclusion
  let conclusion = "Safe Artifact";
  if (verdict === 'MALICIOUS') conclusion = "High Risk Artifact";
  else if (verdict === 'SUSPICIOUS') conclusion = "Suspicious Artifact";
  else if (verdict === 'UNKNOWN') conclusion = "Insufficient Data";

  return {
    conclusion,
    chain
  };
}
