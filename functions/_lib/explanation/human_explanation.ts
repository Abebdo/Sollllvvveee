import { EngineResult } from '../engines/types';
import { ConflictResolution, RiskVerdict, AnalystInsight, FragilityResult, ConfidenceRange } from '../types';

export function generateAnalystExplanation(
    results: EngineResult[],
    conflict: ConflictResolution,
    verdict: RiskVerdict,
    riskScore: number,
    fragility: FragilityResult,
    confidenceRange: ConfidenceRange
): AnalystInsight {

    // 1. Gather Signals
    const positiveSignals = results.filter(r => r.score < 20 && r.confidence > 0.5).map(r => r.summary || `${r.name} indicates safety`).filter(Boolean);
    const negativeSignals = results.filter(r => r.score >= 40).map(r => r.summary || `${r.name} detected risks`).filter(Boolean);

    const semantic = results.find(r => r.name === 'semantic');
    const reputation = results.find(r => r.name === 'reputation');

    const isTrusted = reputation && reputation.score < 10;
    const hasRisk = negativeSignals.length > 0;

    // 2. Construct Summary (Contrastive Reasoning)
    let summary = '';

    // "Although..., however..., therefore..."
    if (conflict.conflict_detected) {
        // Conflict Scenario
        if (conflict.winning_signal === 'INTENT') {
             summary = `Although the domain carries a reputable history, however ${conflict.reasoning.toLowerCase()} Because risk indicators outweigh reputation in this context, therefore we assess this as ${verdict}.`;
        } else {
             summary = `Although ${conflict.primary_conflict ? 'conflicting signals were detected' : 'some indicators appear benign'}, however ${conflict.reasoning.toLowerCase()} Because risk indicators outweigh reputation in this context, therefore we assess this as ${verdict}.`;
        }
    } else if (isTrusted && hasRisk) {
        // Mixed Signals (but not flagged as conflict, or minor)
        summary = `Although the domain has a trusted history, however recent behavioral anomalies were detected (${negativeSignals[0]}). Because behavioral shifts often indicate compromise, therefore the verdict is ${verdict}.`;
    } else if (verdict === 'MALICIOUS') {
        // Clear Malicious
        const reason = negativeSignals[0] ? negativeSignals[0].toLowerCase() : 'multiple risk indicators were found';
        summary = `Primary analysis detected high-risk signals. Specifically, ${reason}. Therefore, we assess this artifact as MALICIOUS with ${(confidenceRange.mostLikely * 100).toFixed(0)}% confidence.`;
    } else if (verdict === 'SUSPICIOUS') {
        // Suspicious
        const reason = negativeSignals[0] ? negativeSignals[0].toLowerCase() : 'anomalous patterns were observed';
        summary = `Although no definitive malicious payload was confirmed, however ${reason}. Therefore, we classify this as SUSPICIOUS.`;
    } else {
        // Benign
        // Ensure uncertainty is communicated if needed
        if (fragility.level !== 'LOW' || confidenceRange.uncertainty !== 'LOW') {
             summary = `Analysis detected no active threats. Although legitimate patterns are dominant, however ${fragility.reasons[0] ? fragility.reasons[0].toLowerCase() : 'visibility is limited'}. Therefore, we assess this as BENIGN but advise standard caution.`;
        } else {
             summary = `Analysis detected no active threats. Although zero risk is impossible, however multiple engines confirm legitimate patterns. Therefore, we assess this as BENIGN.`;
        }
    }

    // 3. Add Fragility Context & Epistemic Honesty (Why we might be wrong)
    if (fragility.level === 'HIGH') {
        summary += ` This conclusion is FRAGILE due to ${fragility.reasons[0] ? fragility.reasons[0].toLowerCase() : 'limited visibility'}.`;
    } else if (fragility.level === 'MEDIUM') {
        summary += ` This conclusion has MODERATE stability due to ${fragility.reasons[0] ? fragility.reasons[0].toLowerCase() : 'partial data coverage'}.`;
    }

    // Explicitly state what could change the verdict (Counterfactual)
    if (confidenceRange.uncertainty !== 'LOW') {
        if (verdict === 'BENIGN') {
             summary += ` A shift in behavioral patterns or detection of credential-harvesting intent would immediately escalate this to MALICIOUS.`;
        } else if (verdict === 'MALICIOUS') {
             summary += ` Verification of ownership or removal of the flagged content would require a re-assessment.`;
        }
    }

    // 4. Takeaways
    const takeaways: string[] = [];
    if (conflict.conflict_detected) takeaways.push(`Conflict: ${conflict.primary_conflict}`);
    takeaways.push(...negativeSignals.slice(0, 3));
    if (takeaways.length === 0) {
         takeaways.push(...positiveSignals.slice(0, 3));
    }
    if (fragility.level === 'HIGH') takeaways.push(`Fragility: High (${fragility.reasons.join(', ')})`);

    // 5. Recommendation
    let recommendation = '';
    if (verdict === 'MALICIOUS') recommendation = 'Block immediately. Do not interact.';
    else if (verdict === 'SUSPICIOUS') recommendation = 'Treat with extreme caution. Verify source independently via a different channel.';
    else recommendation = 'Proceed with standard caution. No immediate threats detected.';

    return {
        analyst_summary: summary,
        analyst_takeaways: takeaways,
        analyst_recommendation: recommendation
    };
}
