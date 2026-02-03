import { EngineFunction, EngineResult, Signal, Verification } from '../engine_contract';
import { isRealityAnchor, getProviderRole } from './world_model';

export const analyzeRootTrust: EngineFunction = async (artifact, type, context) => {
    const signals: Signal[] = [];
    const verification: Verification[] = [];

    let hostname = artifact;
    if (type === 'url') {
        try {
            hostname = new URL(artifact).hostname;
        } catch (e) {
            // Invalid URL
        }
    }

    const isTrusted = isRealityAnchor(hostname);
    const role = getProviderRole(hostname);

    verification.push({
        check: 'root_trust_check',
        status: 'PASS',
        evidence: { is_trusted: isTrusted, role: role || 'none' },
        timestamp: new Date().toISOString()
    });

    // Root Trust generally produces NO Risk Signals if trusted.
    // It provides a strong "Safety" signal which effectively lowers the score in the final aggregation
    // or provides an "Immunity" flag.

    // We can emit an INFO signal for visibility
    if (isTrusted) {
        // No risk signals.
    }

    return {
        engine: 'root_trust',
        executed: true,
        signals,
        verification,
        confidenceImpact: isTrusted ? 1.0 : 0.0, // High impact if trusted, none if unknown
        metadata: { is_trusted: isTrusted, role }
    };
};
