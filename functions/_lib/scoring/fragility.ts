import { EngineResult } from '../engine_contract';
import { FragilityResult } from '../types';

export function calculateFragility(results: EngineResult[]): FragilityResult {
    const executedCount = results.filter(r => r.executed).length;
    const errorCount = results.filter(r => r.error).length;

    let score = 0; // 0 (Robust) - 10 (Fragile)
    const reasons: string[] = [];

    // 1. Engine Coverage
    if (executedCount < 3) {
        score += 5;
        reasons.push("Limited engine coverage (few engines executed)");
    }

    // 2. Engine Failures
    if (errorCount > 0) {
        score += 3;
        reasons.push(`${errorCount} engines failed to complete`);
    }

    // 3. Verification Depth
    // Check if we have strong verification (e.g., DNS resolved, Content scanned)
    const deepVerification = results.some(r =>
        r.verification.some(v => v.check.includes('content') || v.check.includes('behavior') || v.check.includes('reputation_db'))
    );

    if (!deepVerification) {
        score += 3;
        reasons.push("Lack of deep behavioral or content verification");
    }

    // 4. Source Diversity (Proxy)
    // If only Structure engine executed
    if (executedCount === 1 && results[0].engine === 'structure') {
        score += 4;
        reasons.push("Relies solely on syntactic structure analysis");
    }

    // Cap Score
    score = Math.min(10, score);

    // Determine Level
    let level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (score >= 7) level = 'HIGH';
    else if (score >= 4) level = 'MEDIUM';

    return {
        score,
        level,
        reasons
    };
}
