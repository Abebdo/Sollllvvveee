import { EngineResult } from '../engines/types';
import { ConflictResolution } from '../types';

export function analyzeConflict(results: EngineResult[]): ConflictResolution {
    const semantic = results.find(r => r.name === 'semantic');
    const heuristic = results.find(r => r.name === 'heuristic');
    const reputation = results.find(r => r.name === 'reputation');
    const structure = results.find(r => r.name === 'structure');

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
    const semanticScore = semantic?.score || 0;

    // Heuristic Phishing Signals
    const heuristicPhishing = heuristic?.signals?.some(s =>
        s.includes('credential') || s.includes('phishing') || s.includes('impersonation') || s.includes('urgency')
    ) || false;
    const heuristicScore = heuristic?.score || 0;

    // Reputation Status
    const reputationSafe = reputation?.score === 0;
    const isAllowListed = reputation?.signals?.includes('safe_list') || (reputationSafe && (reputation?.confidence || 0) > 0.8);

    // 1. Trusted Domain + Credential Harvesting / Phishing (Intent beats Reputation)
    if (isAllowListed && (intentMalicious || heuristicPhishing || semanticScore > 80)) {
        resolution.conflict_detected = true;
        resolution.primary_conflict = 'Trusted Infrastructure Abuse (Phishing/Malicious Content)';
        resolution.winning_signal = 'INTENT';
        resolution.reasoning = 'Malicious intent signals override domain reputation.';
        resolution.confidence_adjustment = 0.7; // Significant degradation
        return resolution;
    }

    // 2. High Reputation + Suspicious Intent
    if (reputationSafe && (intentSuspicious || semanticScore > 60)) {
        resolution.conflict_detected = true;
        resolution.primary_conflict = 'High Reputation contradicted by Suspicious Intent';
        resolution.winning_signal = 'INTENT';
        resolution.reasoning = 'Suspicious intent patterns detected on reputable domain.';
        resolution.confidence_adjustment = 0.8;
        return resolution;
    }

    // 3. Structural Legitimacy vs Behavioral Risk
    const structureSafe = structure?.score === 0;
    if (structureSafe && heuristicScore > 70) {
        resolution.conflict_detected = true;
        resolution.primary_conflict = 'Legitimate Structure hosting Risky Content';
        resolution.winning_signal = 'BEHAVIOR';
        resolution.reasoning = 'Behavioral heuristics indicate risk despite clean structure.';
        resolution.confidence_adjustment = 0.85;
        return resolution;
    }

    // 4. Clean Scan vs Semantic Phishing
    // e.g. Heuristic is clean (0) but Semantic detects Phishing
    if (heuristicScore < 20 && intentMalicious) {
        resolution.conflict_detected = true;
        resolution.primary_conflict = 'Evasive Phishing (Clean Scan, Malicious Semantics)';
        resolution.winning_signal = 'INTENT';
        resolution.reasoning = 'Semantic analysis detected intent missed by static heuristics.';
        resolution.confidence_adjustment = 0.8;
        return resolution;
    }

    return resolution;
}
