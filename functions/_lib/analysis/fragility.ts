import { EngineResult } from '../engines/types';
import { FragilityResult } from '../types';

export function analyzeFragility(results: EngineResult[], isFirstSeen: boolean = false): FragilityResult {
    let score = 0;
    const reasons: string[] = [];

    // Filter valid results
    const validResults = results.filter(r => r && r.confidence > 0);
    const engineNames = new Set(validResults.map(r => r.name));

    // 1. Source Diversity
    // Logic: Count engines that contributed meaningful signals (score > 0 or features detected)
    const activeEngines = validResults.filter(r => (r.features && r.features.length > 0) || r.score > 10);

    // Use total valid engines for denominator to assess participation rate
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
        score += 2;
        reasons.push('Verdict relies on absence of evidence (Zero Signal)');
    }

    // 3. Reputation-heavy reliance (+2)
    const reputation = validResults.find(r => r.name === 'reputation');
    if (activeEngines.length === 1 && activeEngines[0].name === 'reputation') {
        score += 2;
        reasons.push('Relies exclusively on reputation data');
    }

    // 4. First Seen Artifact (+2)
    if (isFirstSeen) {
        score += 2;
        reasons.push('First time seeing this artifact pattern');
    }

    // 5. Static-only analysis (+1)
    // If only 'heuristic', 'structure', 'reputation' ran.
    const dynamicEngines = ['semantic', 'baseline'];
    const hasDynamic = validResults.some(r => dynamicEngines.includes(r.name));

    if (!hasDynamic) {
        score += 1;
        reasons.push('Analysis limited to static engines only');
    }

    // 6. Context Blindness (+1)
    if (!engineNames.has('context')) {
        score += 1;
        reasons.push('Context blindness: analysis performed without contextual awareness');
    }

    // Clamp Score 0-10
    score = Math.min(10, Math.max(0, score));

    // Determine Level
    let level: 'LOW' | 'MEDIUM' | 'HIGH';
    if (score >= 6) level = 'HIGH'; // Lowered threshold slightly to be more sensitive
    else if (score >= 3) level = 'MEDIUM';
    else level = 'LOW';

    return {
        score,
        level,
        reasons
    };
}
