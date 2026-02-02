import {
  RiskVerdict,
  FragilityResult,
  MetaJudgmentResult,
  ConflictResolution,
  EpistemicProfile,
  ConfidenceRange
} from '../types';

/**
 * Epistemic Confidence Model (ECM)
 * Phase 1: Post-Calibration Intelligence
 *
 * Constructs a profile of 'why we might be wrong' to ensure epistemic honesty.
 */
export function buildEpistemicProfile(
    confidenceScore: number, // Already calibrated score (0-1)
    verdict: RiskVerdict,
    fragility: FragilityResult,
    conflict: ConflictResolution,
    meta: MetaJudgmentResult
): EpistemicProfile {

    // 1. Calculate Confidence Range Width
    // Base width (inherent uncertainty in any analysis)
    let width = 0.10;

    const uncertaintySources: string[] = [];
    const whatWouldChangeVerdict: string[] = [];

    // --- Factor 1: Fragility ---
    if (fragility.level === 'HIGH') {
        width += 0.25;
        uncertaintySources.push('High Fragility: Analysis relies on sparse or weak signals');
        whatWouldChangeVerdict.push('Corroboration from independent infrastructure providers');
    } else if (fragility.level === 'MEDIUM') {
        width += 0.10;
        uncertaintySources.push('Medium Fragility: Some signals are tenuous or indirect');
    }

    // --- Factor 2: Conflict ---
    if (conflict.conflict_detected) {
        width += 0.15;
        uncertaintySources.push(`Signal Conflict: ${conflict.primary_conflict}`);
        whatWouldChangeVerdict.push('Resolution of conflicting signals (e.g., clear malicious payload on trusted domain)');
    }

    // --- Factor 3: Diversity & Echo Chambers ---
    if (meta.source_diversity < 0.4) {
        width += 0.15;
        uncertaintySources.push('Low Source Diversity: Engines may be echoing similar data sources');
        whatWouldChangeVerdict.push('Confirmation from a distinct engine family (e.g., Semantic analysis)');
    }

    // --- Factor 4: Consensus ---
    if (meta.agreement_score < 0.6) {
         width += 0.10;
         uncertaintySources.push('Consensus Risk: Engines disagree significantly');
    }

    // --- Verdict-Specific Factors ---
    if (verdict === 'BENIGN') {
        const isIdeal = fragility.level === 'LOW' && !conflict.conflict_detected && meta.source_diversity > 0.6;
        if (!isIdeal) {
             width = Math.max(width, 0.15); // Ensure at least moderate uncertainty for Benign if not perfect
        }
        whatWouldChangeVerdict.push('Detection of obfuscated malicious code');
        whatWouldChangeVerdict.push('Phishing intent detected by semantic engine');
    } else if (verdict === 'SUSPICIOUS') {
         whatWouldChangeVerdict.push('Clear evidence of benign intent or authorized ownership');
         whatWouldChangeVerdict.push('Active malware payload discovery (escalation to MALICIOUS)');
    } else if (verdict === 'MALICIOUS') {
        whatWouldChangeVerdict.push('Proof of authorized security testing context');
        whatWouldChangeVerdict.push('Benign usage context verification');
    }

    // 2. Calculate Min/Max centered around confidenceScore
    let min = confidenceScore - (width / 2);
    let max = confidenceScore + (width / 2);

    // 3. Enforce Epistemic Limits
    // Rule: 100% confidence is forbidden.
    min = Math.max(0.05, min); // Never 0% either, theoretically
    max = Math.min(0.99, max);

    // Ensure range isn't inverted (if confidenceScore was very high or low)
    if (min > max) {
        // Center it again or clamp
        const mid = (min + max) / 2;
        min = Math.max(0.01, mid - 0.05);
        max = Math.min(0.99, mid + 0.05);
    }

    // 4. Determine Uncertainty Level
    let uncertaintyLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    if (width >= 0.30) uncertaintyLevel = 'HIGH';
    else if (width >= 0.15) uncertaintyLevel = 'MEDIUM';
    else uncertaintyLevel = 'LOW';

    const confidenceRange: ConfidenceRange = {
        min: Number(min.toFixed(2)),
        mostLikely: Number(confidenceScore.toFixed(2)),
        max: Number(max.toFixed(2)),
        uncertainty: uncertaintyLevel
    };

    return {
        confidence_range: confidenceRange,
        fragility_level: fragility.level,
        uncertainty_sources: Array.from(new Set(uncertaintySources)), // Dedupe
        what_would_change_verdict: Array.from(new Set(whatWouldChangeVerdict))
    };
}
