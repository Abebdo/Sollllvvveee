import { EngineResult } from '../engines/types';
import { FragilityResult } from '../types';

export function analyzeFragility(results: EngineResult[]): FragilityResult {
    let score = 0;
    const reasons: string[] = [];

    // Filter valid results
    const validResults = results.filter(r => r && r.confidence > 0);
    const engineNames = new Set(validResults.map(r => r.name));

    // 1. Source Diversity
    // Logic: Count engines that contributed meaningful signals (score > 0 or features detected)
    const activeEngines = validResults.filter(r => (r.features && r.features.length > 0) || r.score > 10);
    const diversity = activeEngines.length / Math.max(1, results.length); // Use total attempted engines for denominator?
    // Actually, usually we pass all settled results. If we passed 6 engines and only 1 was active...
    // Let's assume 'results' contains all engines that successfully ran.

    // Directive: "Low source diversity (<30%) -> +3"
    // If we have 6 engines, 30% is 1.8. So 0 or 1 active engine is low diversity.
    // If we have 5 engines, 30% is 1.5.

    const diversityRatio = activeEngines.length / Math.max(1, validResults.length);

    if (diversityRatio < 0.3) {
        score += 3;
        reasons.push('Low source diversity (<30% of engines contributed signals)');
    }

    // 2. Single Source Reliance (+2)
    // If only one engine provides active signals
    if (activeEngines.length === 1) {
        score += 2;
        reasons.push('Verdict relies on a single engine source');
    }

    // 2b. Zero Signal Reliance (+3)
    // If NO engines provided active signals (Benign by default/absence)
    if (activeEngines.length === 0) {
        score += 3;
        reasons.push('Verdict relies on absence of evidence (Zero Signal)');
    }

    // 3. Reputation-heavy reliance (+2)
    // If Reputation is active/high score, but others are not supporting it strongly?
    // Or simply if Reputation is the dominant factor.
    const reputation = validResults.find(r => r.name === 'reputation');
    const heuristic = validResults.find(r => r.name === 'heuristic');
    const semantic = validResults.find(r => r.name === 'semantic');

    // If reputation is the ONLY active engine, that's heavy reliance.
    if (activeEngines.length === 1 && activeEngines[0].name === 'reputation') {
        score += 2;
        reasons.push('Relies exclusively on reputation data');
    } else if (reputation && reputation.score > 50) {
        // Check if others support it
        const support = activeEngines.filter(r => r.name !== 'reputation' && r.score > 30);
        if (support.length === 0) {
            score += 2;
            reasons.push('Verdict relies heavily on reputation without strong corroboration');
        }
    }

    // 3. SSL / Domain age reliance (+2)
    // This typically comes from 'structure' or 'reputation' features.
    // We check if specific signals are present and if they are the primary drivers.
    const sslSignals = validResults.flatMap(r => r.signals || []).filter(s => s.includes('ssl') || s.includes('age') || s.includes('creation_date'));
    // Ideally we check if these are the ONLY signals or high impact ones.
    // For now, if we have these signals and total score is otherwise low/medium, it might be reliance.
    // Simplified: If 'structure' is the only active engine and has these signals.
    const structure = validResults.find(r => r.name === 'structure');
    if (activeEngines.length === 1 && structure && sslSignals.length > 0) {
        score += 2;
        reasons.push('Relies primarily on SSL/Domain Age metadata');
    }

    // 4. No behavioral analysis (+2)
    // Behavioral usually implies 'semantic' (fetching) or 'baseline' (behavioral profiling).
    // If 'semantic' is missing or failed or skipped.
    if (!engineNames.has('semantic') && !engineNames.has('baseline')) {
        score += 2;
        reasons.push('No behavioral analysis performed');
    }

    // 5. Static-only analysis (+1)
    // If only 'heuristic', 'structure', 'reputation' ran.
    // 'context' is also static-ish. 'semantic' is dynamic. 'baseline' is historical/behavioral.
    const dynamicEngines = ['semantic', 'baseline'];
    const hasDynamic = validResults.some(r => dynamicEngines.includes(r.name));

    if (!hasDynamic) {
        score += 1;
        reasons.push('Analysis limited to static engines only');
    }

    // Clamp Score 0-10
    score = Math.min(10, Math.max(0, score));

    // Determine Level
    let level: 'LOW' | 'MEDIUM' | 'HIGH';
    if (score >= 7) level = 'HIGH';
    else if (score >= 4) level = 'MEDIUM';
    else level = 'LOW';

    return {
        score,
        level,
        reasons
    };
}
