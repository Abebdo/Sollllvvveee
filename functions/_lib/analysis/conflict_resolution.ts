import { EngineResult } from '../engines/types';
import { ConflictResolution } from '../types';

export function analyzeConflict(results: EngineResult[]): ConflictResolution {
    const reputation = results.find(r => r.name === 'reputation');
    const semantic = results.find(r => r.name === 'semantic');
    const structure = results.find(r => r.name === 'structure');
    const heuristic = results.find(r => r.name === 'heuristic');

    const repScore = reputation?.score || 0;
    const intentScore = semantic?.score || 0;
    const structureScore = structure?.score || 0;
    const heuristicScore = heuristic?.score || 0;

    // Default: No conflict
    let conflict: ConflictResolution = {
        conflict_detected: false,
        primary_conflict: null,
        winning_signal: 'NONE',
        reasoning: '',
        confidence_adjustment: 1.0
    };

    // 1. High Reputation vs Malicious Intent (The "Abused Infrastructure" Case)
    // Reputation says Safe (Low Score) but Intent says Risky (High Score)
    if (repScore < 25 && intentScore >= 50) {
        conflict = {
            conflict_detected: true,
            primary_conflict: 'Trusted Infrastructure vs. Malicious Intent',
            winning_signal: 'INTENT',
            reasoning: `Although the domain is highly trusted (Reputation Score: ${repScore}), semantic analysis detected malicious intent (Score: ${intentScore}). This strongly suggests the infrastructure is being abused.`,
            confidence_adjustment: 0.85
        };
    }

    // 2. High Reputation vs Suspicious Intent (Subtle Abuse)
    else if (repScore < 25 && intentScore >= 30) {
         conflict = {
            conflict_detected: true,
            primary_conflict: 'Trusted Infrastructure vs. Suspicious Indicators',
            winning_signal: 'INTENT',
            reasoning: `The domain is trusted, but contains suspicious keywords or patterns (Score: ${intentScore}).`,
            confidence_adjustment: 0.90
        };
    }

    // 3. High Reputation vs Behavioral Anomalies
    else if (repScore < 25 && heuristicScore >= 60) {
        conflict = {
            conflict_detected: true,
            primary_conflict: 'Trusted Reputation vs. Anomalous Behavior',
            winning_signal: 'BEHAVIOR',
            reasoning: `The artifact has high reputation but exhibits significant behavioral anomalies (Heuristic Score: ${heuristicScore}).`,
            confidence_adjustment: 0.9
        };
    }

    // 4. Structural Risk vs Reputation
    else if (repScore < 15 && structureScore >= 70) {
        conflict = {
            conflict_detected: true,
            primary_conflict: 'Trusted Reputation vs. High Structural Risk',
            winning_signal: 'STRUCTURE',
            reasoning: `Despite trusted reputation, the domain structure is highly irregular (Structure Score: ${structureScore}).`,
            confidence_adjustment: 0.8
        };
    }

    return conflict;
}
