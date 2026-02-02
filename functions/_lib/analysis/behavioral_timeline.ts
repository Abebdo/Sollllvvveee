import { BehavioralTimelineResult } from '../types';

/**
 * Behavioral Timeline Engine
 *
 * Detects changes in risk posture over time (e.g. safe site compromised,
 * or recurring seasonal campaigns).
 */
export function analyzeBehavioralTimeline(
    currentScore: number,
    history: number[]
): BehavioralTimelineResult {
    // 1. First Seen
    if (!history || history.length === 0) {
        return {
            behavioral_drift: 'NONE',
            timeline_confidence_penalty: 0.1, // Slight penalty for lack of history
            history_summary: 'First time seen (no behavioral history)'
        };
    }

    const avgHistory = history.reduce((a, b) => a + b, 0) / history.length;
    const lastScore = history[history.length - 1];

    // 2. Detect Drift
    let drift: 'NONE' | 'LOW' | 'HIGH' = 'NONE';
    let penalty = 0;
    let summary = 'Stable behavior observed';

    // Scenario: Sudden compromise (Safe history -> High Risk now)
    // Avg < 30 (Safe) AND Current > 70 (Malicious)
    // OR Huge Delta (> 50 points)
    if ((avgHistory < 30 && currentScore > 70) || (currentScore - avgHistory > 50)) {
        drift = 'HIGH';
        penalty = 0.3;
        summary = 'CRITICAL: Sudden behavioral shift from Safe to Malicious (Potential Compromise)';
    }
    // Scenario: Degradation (Safe -> Suspicious)
    else if (avgHistory < 40 && currentScore > 60) {
        drift = 'LOW';
        penalty = 0.15;
        summary = 'Warning: Risk score is degrading compared to historical average';
    }
    // Scenario: Improvement (Malicious -> Safe) - potentially cloaking?
    else if (avgHistory > 70 && currentScore < 30) {
        drift = 'LOW'; // Cautious optimism
        penalty = 0.1;
        summary = 'Note: Significant risk reduction observed (Potential Clean-up or Cloaking)';
    }

    // 3. Volatility / Flip-Flops
    let flips = 0;
    // Check internal history flips
    for (let i = 1; i < history.length; i++) {
        const prev = history[i-1];
        const curr = history[i];
        // Flip defined as crossing the 50 threshold
        if ((prev < 50 && curr > 60) || (prev > 60 && curr < 50)) {
            flips++;
        }
    }

    // Check current vs last
    if ((lastScore < 50 && currentScore > 60) || (lastScore > 60 && currentScore < 50)) {
        flips++;
    }

    if (flips >= 2) {
        drift = 'HIGH';
        penalty = Math.max(penalty, 0.4); // High penalty for instability
        summary = `High volatility: Reputation flip-flops detected (${flips} shifts)`;
    }

    // 4. Persistence
    if (history.length > 5 && drift === 'NONE') {
         summary = 'Established history with consistent behavior';
    }

    return {
        behavioral_drift: drift,
        timeline_confidence_penalty: parseFloat(penalty.toFixed(2)),
        history_summary: summary
    };
}
