import { EngineResult } from '../engines/types';
import { ConflictResolution } from '../types';

export function analyzeConflict(results: EngineResult[]): ConflictResolution {
    const semantic = results.find(r => r.name === 'semantic');
    const heuristic = results.find(r => r.name === 'heuristic');
    const reputation = results.find(r => r.name === 'reputation');

    // Default state
    const resolution: ConflictResolution = {
        conflict_detected: false,
        primary_conflict: null,
        winning_signal: 'NONE',
        reasoning: 'No significant conflicts detected between engines.',
        confidence_adjustment: 1.0
    };

    if (!semantic && !heuristic && !reputation) return resolution;

    const intentMalicious = (semantic as any)?.semantic_intent?.intent === 'MALICIOUS';
    const intentSuspicious = (semantic as any)?.semantic_intent?.intent === 'SUSPICIOUS';

    // Heuristic Phishing Signals
    const heuristicPhishing = heuristic?.signals?.some(s =>
        s.includes('credential') || s.includes('phishing') || s.includes('impersonation') || s.includes('urgency')
    ) || false;

    // Reputation Status
    const reputationSafe = reputation?.score === 0; // Assuming 0 is clean/safe
    // If reputation returns features like 'safe_list'
    const isAllowListed = reputation?.signals?.includes('safe_list') || reputationSafe;

    // 1. Trusted Domain + Credential Harvesting / Phishing
    // If reputation says SAFE (Trusted) but Semantic/Heuristic says MALICIOUS
    if (isAllowListed && (intentMalicious || heuristicPhishing)) {
        resolution.conflict_detected = true;
        resolution.primary_conflict = 'Trusted Infrastructure hosting Phishing/Malicious content';
        resolution.winning_signal = 'INTENT';
        resolution.reasoning = 'Malicious semantic intent overrides trusted domain reputation.';
        resolution.confidence_adjustment = 0.8; // Degrade confidence
        return resolution;
    }

    // 2. High Reputation + Malicious Intent (Generic)
    if (reputationSafe && (intentMalicious || (semantic?.score || 0) > 80)) {
        resolution.conflict_detected = true;
        resolution.primary_conflict = 'High Reputation contradicted by Malicious Intent';
        resolution.winning_signal = 'INTENT';
        resolution.reasoning = 'Detected clear malicious intent despite clean reputation history.';
        resolution.confidence_adjustment = 0.75;
        return resolution;
    }

    // 3. Trusted Infrastructure + Phishing Behavior (Heuristic)
    if (isAllowListed && heuristicPhishing) {
        resolution.conflict_detected = true;
        resolution.primary_conflict = 'Trusted Infrastructure displaying Phishing Behavior';
        resolution.winning_signal = 'BEHAVIOR'; // Heuristic is behavior/structure
        resolution.reasoning = 'Phishing indicators detected on otherwise trusted infrastructure.';
        resolution.confidence_adjustment = 0.8;
        return resolution;
    }

    return resolution;
}
