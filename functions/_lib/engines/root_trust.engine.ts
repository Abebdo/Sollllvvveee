import { EngineResult } from './types';
import { ArtifactType, DomainTrustVerdict } from '../types';
import { isRealityAnchor, getProviderRole, isGlobalInfraProvider } from './world_model';

// Re-exporting for backward compatibility if needed, but WorldModel is now the source of truth
export { isRealityAnchor as isRootTrusted } from './world_model';

export async function analyzeRootTrust(artifact: string, type: ArtifactType): Promise<{
    is_trusted: boolean;
    verdict: DomainTrustVerdict;
    role: string | null;
    is_infra: boolean;
    engine_result: EngineResult;
}> {
    let isTrusted = false;
    let role: string | null = null;
    let isInfra = false;
    let hostname = artifact;

    if (type === 'domain' || type === 'url') {
        try {
            if (type === 'url') {
                try {
                    const url = new URL(artifact);
                    hostname = url.hostname;
                } catch (e) {
                    hostname = artifact.split('/')[0];
                }
            } else {
                 hostname = artifact.replace(/^https?:\/\//, '').split('/')[0];
            }

            isTrusted = isRealityAnchor(hostname);
            role = getProviderRole(hostname);
            isInfra = isGlobalInfraProvider(hostname);

        } catch (e) {
            console.warn('Root trust analysis failed to parse artifact', e);
        }
    }

    return {
        is_trusted: isTrusted,
        verdict: isTrusted ? 'SAFE' : 'UNKNOWN',
        role,
        is_infra: isInfra,
        engine_result: {
            name: 'root_trust',
            confidence: 1.0, // Trusted List is deterministic
            score: isTrusted ? 0 : 50,
            signals: isTrusted ? ['ROOT_TRUST_IMMUNITY', 'REALITY_ANCHOR'] : [],
            features: [
                {
                    id: 'reality_anchor_status',
                    tier: 'TIER_1_LOCAL',
                    detected: isTrusted,
                    value: role || 'Unknown',
                    riskContribution: isTrusted ? -50 : 0,
                    description: isTrusted ? `Domain is a verified Reality Anchor: ${role}` : 'Domain is not a verified Reality Anchor',
                    evidence: isTrusted ? [`Matched Global Trust Set`] : []
                }
            ],
            summary: isTrusted
                ? `Domain is a verified Reality Anchor (${role || 'Global Platform'}). Content is assumed legitimate unless abuse is proven.`
                : 'Domain is not in the Global Reality Anchor set.'
        }
    };
}
