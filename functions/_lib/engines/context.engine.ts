import { ArtifactType, FeatureResult } from '../types';
import { EngineResult } from './types';

const PRIVATE_IP_RANGES = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^127\./
];

export function analyzeContext(artifact: string, type: ArtifactType): EngineResult {
    const features: FeatureResult[] = [];
    const signals: string[] = [];
    let score = 0;

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
            // Score depends on context, but here we assume external threat -> 0 risk for malware, but maybe invalid.
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

    return {
        name: 'context',
        confidence: 0.6,
        score: Math.min(100, score),
        signals,
        features
    };
}
