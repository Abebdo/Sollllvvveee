import { AnalysisResult } from '../types';
import { ArtifactClass } from '../context/artifact_classifier';

export function normalizeVerdict(result: AnalysisResult, artifactClass: ArtifactClass): void {
    if (artifactClass === 'INFRASTRUCTURE_ROOT') {
        // Hard Constraints: Verdict MUST be LEGITIMATE (BENIGN)
        result.verdict = 'BENIGN';

        // Risk level MUST be LOW
        result.riskScore = 0;

        // Final Assessment must be SAFE
        result.final_assessment = 'SAFE';
        result.usage_risk = 'BENIGN';

        // Fragility MUST be NONE
        if (result.fragility) {
            result.fragility.level = 'LOW';
            result.fragility.score = 0;
            result.fragility.reasons = [];
        }

        // Confidence MUST be capped at informational (meaning high confidence in safety, no uncertainty penalties)
        // We strip uncertainty flags that suggest doubt
        result.uncertainty_flags = [];
        if (result.confidence_detail) {
            result.confidence_detail.reasons = [];
            // We set high confidence because we are sure it's infrastructure
            result.confidence_detail.score = 1.0;
            result.confidence = 1.0;
        }

        // Suppress credential intent
        if (result.semantic_intent) {
            result.semantic_intent.intent = 'BENIGN';
            result.semantic_intent.confidence = 0;
        }

        // Clear negative signals from summary lists to avoid UI warnings
        if (result.explanation) {
             result.explanation.negative_factors = [];
             // Ensure weights don't show risk
             for (const key in result.explanation.weights) {
                 result.explanation.weights[key] = 0;
             }
        }

        // Clear analyst flags
        if (result.analyst_flags) {
            result.analyst_flags.reputation_abuse = false;
            result.analyst_flags.high_fragility = false;
            result.analyst_flags.conflicting_signals = false;
            result.analyst_flags.requires_human_attention = false;
        }
    }
}
