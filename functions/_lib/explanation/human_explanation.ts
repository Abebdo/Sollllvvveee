import { EngineResult } from '../engines/types';
import { ConflictResolution, RiskVerdict, AnalystInsight } from '../types';

export function generateAnalystExplanation(
    results: EngineResult[],
    conflict: ConflictResolution,
    verdict: RiskVerdict,
    riskScore: number
): AnalystInsight {

    // Gather Key Signals
    const positiveSignals = results.filter(r => r.score < 20).map(r => r.summary).filter(Boolean);
    const negativeSignals = results.filter(r => r.score > 40).map(r => r.summary).filter(Boolean);

    const semantic = results.find(r => r.name === 'semantic');
    const reputation = results.find(r => r.name === 'reputation');

    // Construct Summary using Contrastive Reasoning
    let summary = '';

    // Structure: "Although [Positive/Trusted], however [Negative/Risk], therefore [Verdict]."
    // Or: "Because [Strong Evidence], and [Supporting Evidence], therefore [Verdict]."

    const isTrusted = reputation && reputation.score < 10;
    const hasRisk = negativeSignals.length > 0;

    if (conflict.conflict_detected) {
        summary = `Although ${conflict.winning_signal === 'INTENT' ? 'the domain carries a reputable history' : 'some indicators appear benign'}, however ${conflict.reasoning.toLowerCase()} Therefore, we assess this as ${verdict}.`;
    } else if (isTrusted && hasRisk) {
         // Trusted but risky (below conflict threshold but still mixed)
         summary = `Although the source appears historically trusted, however recent behavioral anomalies suggest potential compromise. Therefore, we advise caution (Verdict: ${verdict}).`;
    } else if (isTrusted && !hasRisk) {
         summary = `The artifact aligns with established trusted patterns and lacks behavioral anomalies. Therefore, we assess this as ${verdict}.`;
    } else if (!isTrusted && hasRisk) {
         summary = `Because multiple engines detected risk indicators, including ${negativeSignals[0] ? negativeSignals[0].toLowerCase() : 'suspicious patterns'}, therefore we assess this as ${verdict}.`;
    } else {
         // Ambiguous
         summary = `Analysis yielded inconclusive results with mixed low-confidence signals. Therefore, we classify this as ${verdict} pending further data.`;
    }

    // Takeaways
    const takeaways: string[] = [];
    if (conflict.conflict_detected) takeaways.push(`Conflict: ${conflict.primary_conflict}`);
    if (results.length < 3) takeaways.push('Note: Analysis based on limited engine coverage.');
    takeaways.push(...negativeSignals.slice(0, 3));

    // Recommendation
    let recommendation = '';
    if (verdict === 'MALICIOUS') recommendation = 'Block immediately and investigate potential compromise.';
    else if (verdict === 'SUSPICIOUS') recommendation = 'Treat with extreme caution; verify independently before interaction.';
    else recommendation = 'Standard safety protocols apply; no immediate threat detected.';

    return {
        analyst_summary: summary,
        analyst_takeaways: takeaways,
        analyst_recommendation: recommendation
    };
}
