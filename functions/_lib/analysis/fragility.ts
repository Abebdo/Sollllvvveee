import { EngineResult } from '../engines/types';
import { FragilityResult } from '../types';

export function analyzeFragility(results: EngineResult[]): FragilityResult {
    let score = 0;
    const reasons: string[] = [];

    // Valid Results
    const validResults = results.filter(r => r && typeof r.score === 'number');

    // 1. Source Diversity
    const contributingEngines = validResults.filter(r =>
        (r.features && r.features.length > 0) || r.score > 0
    );
    const diversity = contributingEngines.length / Math.max(1, results.length);

    if (diversity < 0.3) {
        score += 3;
        reasons.push('Low source diversity');
    }

    // 2. SSL Reliance
    // If Structure engine is the ONLY significant contributor (>0) and mentions SSL
    const structure = validResults.find(r => r.name === 'structure');
    const others = validResults.filter(r => r.name !== 'structure' && r.score > 10);

    if (structure && structure.score > 0 && others.length === 0) {
        // Assume structure relies on SSL/DNS properties
        score += 2;
        reasons.push('Heavy reliance on SSL/Infrastructure signals');
    }

    // 3. Domain Age / Reputation Reliance
    // If Reputation is Safe (0) and High Confidence, and dominates the verdict (others are silent)
    const reputation = validResults.find(r => r.name === 'reputation');
    const risky = validResults.some(r => r.score > 30 && r.name !== 'reputation');

    if (reputation && reputation.score === 0 && !risky) {
        score += 2;
        reasons.push('Verdict relies heavily on domain reputation');
    }

    // 4. No Behavioral Analysis
    // If Semantic or Heuristic engines provided no signals
    const heuristic = validResults.find(r => r.name === 'heuristic');
    const semantic = validResults.find(r => r.name === 'semantic');

    const hasBehavioral = (heuristic && heuristic.features && heuristic.features.length > 0) ||
                          (semantic && semantic.signals && semantic.signals.length > 0);

    if (!hasBehavioral) {
        score += 2;
        reasons.push('No behavioral analysis signals detected');
    }

    // 5. Static Signals Only
    // If all detected features are local/static
    const allFeatures = validResults.flatMap(r => r.features || []);
    if (allFeatures.length > 0 && allFeatures.every(f => f.tier === 'TIER_1_LOCAL')) {
        score += 1;
        reasons.push('Analysis based primarily on static signals');
    }

    // Clamp Score
    score = Math.min(10, score);

    // Determine Level
    let level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (score >= 6) level = 'HIGH';
    else if (score >= 3) level = 'MEDIUM';

    return {
        score,
        level,
        reasons
    };
}
