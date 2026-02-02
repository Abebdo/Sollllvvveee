import { EngineResult } from '../engines/types';
import { ConflictResolution, AnalystInsight, RiskVerdict } from '../types';

export function generateAnalystExplanation(
    results: EngineResult[],
    conflict: ConflictResolution,
    verdict: RiskVerdict,
    finalScore: number
): AnalystInsight {
    // 1. Build Summary
    let summary = '';

    // Filter out invalid or empty results
    const validResults = results.filter(r => r && r.score !== undefined);
    const sortedResults = [...validResults].sort((a, b) => b.score - a.score);
    const topRisk = sortedResults.find(r => r.score > 0);

    if (conflict.conflict_detected) {
        summary = conflict.reasoning;
    } else {
        if (verdict === 'MALICIOUS') {
            summary = `This artifact is classified as Malicious (Risk Score: ${finalScore}/100). Analysis detected strong indicators of threat, primarily driven by ${topRisk?.name || 'behavioral'} analysis.`;
        } else if (verdict === 'SUSPICIOUS') {
             summary = `This artifact is classified as Suspicious (Risk Score: ${finalScore}/100). While definitive proof of malware is missing, it exhibits behavior patterns consistent with phishing or social engineering.`;
        } else {
             summary = `This artifact appears Legitimate (Risk Score: ${finalScore}/100). Security scans across multiple engines did not find significant threats.`;
        }
    }

    // 2. Build Takeaways (Key observations)
    const takeaways: string[] = [];

    // Add conflict note if exists
    if (conflict.conflict_detected) {
        takeaways.push(`Conflict Resolved: ${conflict.primary_conflict} -> Verdict based on ${conflict.winning_signal}`);
    }

    // Add top signals
    // We prioritize specific signals over engine summaries if available
    const allSignals: string[] = [];
    validResults.forEach(r => {
        if (r.signals && r.signals.length > 0) {
            // Map signals to human readable if possible, otherwise use summary or signal ID
            // For now, we assume engines might provide readable summaries or we use engine name + high risk
            if (r.score >= 50) {
                if (r.name === 'semantic') allSignals.push('Content suggests malicious intent (e.g. credential harvesting).');
                else if (r.name === 'structure') allSignals.push('Domain structure appears irregular or deceptive.');
                else if (r.name === 'heuristic') allSignals.push('Behavioral patterns match known threat profiles.');
                else if (r.name === 'reputation') allSignals.push('Source has a poor history or is known for abuse.');
                else if (r.summary) allSignals.push(r.summary);
            }
        }
    });

    // Deduplicate
    const uniqueSignals = Array.from(new Set(allSignals));
    takeaways.push(...uniqueSignals);

    if (takeaways.length === 0) {
        takeaways.push("No specific threat indicators found.");
        takeaways.push("Infrastructure appears standard.");
    }

    // Limit to top 4
    const finalTakeaways = takeaways.slice(0, 4);

    // 3. Recommendation
    let recommendation = '';
    if (verdict === 'MALICIOUS') {
        recommendation = 'BLOCK and REPORT. Do not open or interact with this artifact.';
    } else if (verdict === 'SUSPICIOUS') {
        recommendation = 'TREAT AS POTENTIALLY DANGEROUS. Verify the source via a different channel (e.g., call the sender) before clicking.';
    } else {
        recommendation = 'Standard caution recommended. No immediate threat detected.';
    }

    return {
        analyst_summary: summary,
        analyst_takeaways: finalTakeaways,
        analyst_recommendation: recommendation
    };
}
