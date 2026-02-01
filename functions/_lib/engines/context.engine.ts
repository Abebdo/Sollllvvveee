import { ArtifactType, FeatureResult, AnalysisContext } from '../types';
import { EngineResult } from './types';
import { calculateContextAdjustment } from '../context';

const PRIVATE_IP_RANGES = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^127\./
];

export function analyzeContext(artifact: string, type: ArtifactType, context?: AnalysisContext): EngineResult {
    const features: FeatureResult[] = [];
    const signals: string[] = [];
    let score = 0;

    // 1. Internal Context Analysis (IP ranges, email format)
    if (type === 'ipv4') {
        if (PRIVATE_IP_RANGES.some(r => r.test(artifact))) {
            const id = 'context_private_ip';
            signals.push(id);
            features.push({
                id,
                tier: 'TIER_1_LOCAL',
                detected: true,
                riskContribution: 0, // Not malicious, just internal. Maybe suspicious if public submission.
                description: 'Private IP address range (Bogon)',
                evidence: [artifact]
            });
        }
    }

    if (type === 'email') {
         const [user, domain] = artifact.split('@');
         if (user && (user.includes('+') || user.length > 30)) {
             const id = 'context_email_complexity';
             signals.push(id);
             features.push({
                 id,
                 tier: 'TIER_1_LOCAL',
                 detected: true,
                 riskContribution: 10,
                 description: 'Unusual email user-part format',
                 evidence: [user]
             });
             score += 10;
         }
    }

    // 2. External Context Analysis
    const adjustment = calculateContextAdjustment(context, type);
    if (adjustment.scoreModifier !== 0) {
        const id = 'context_environment_adjustment';
        signals.push(id);
        features.push({
            id,
            tier: 'TIER_1_LOCAL',
            detected: true,
            riskContribution: adjustment.scoreModifier,
            description: adjustment.reason || 'Contextual Risk Adjustment',
            evidence: [context?.source || 'Unknown Source']
        });
        score += adjustment.scoreModifier;
    }

    return {
        name: 'context',
        confidence: 0.6,
        score: Math.min(100, Math.max(0, score)),
        signals,
        features,
        summary: adjustment.scoreModifier > 0 ? `Risk increased due to ${context?.source} context.` : 'Standard context analysis.'
    };
}
