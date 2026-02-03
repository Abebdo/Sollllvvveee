import { EngineResult } from './types';
import { ArtifactType, DomainTrustVerdict } from '../types';
import { isRealityAnchor, getProviderRole, isGlobalInfraProvider, GLOBAL_HUMAN_TRUST_SET } from './world_model';
import { EngineFailureError } from '../errors';

// Re-exporting for backward compatibility
export { isRealityAnchor as isRootTrusted } from './world_model';
// Exporting GLOBAL_HUMAN_TRUST_SET as ROOT_TRUSTED_DOMAINS for backward compatibility
export { GLOBAL_HUMAN_TRUST_SET as ROOT_TRUSTED_DOMAINS } from './world_model';

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
        if (type === 'url') {
            try {
                const url = new URL(artifact);
                hostname = url.hostname;
            } catch (e) {
                // If invalid URL, we cannot determine root trust.
                // We throw an explicit error to indicate malformed input processing failure
                throw new EngineFailureError('root_trust', `Invalid URL: ${artifact}`);
            }
        } else {
                hostname = artifact.replace(/^https?:\/\//, '').split('/')[0];
        }

        isTrusted = isRealityAnchor(hostname);
        role = getProviderRole(hostname);
        isInfra = isGlobalInfraProvider(hostname);
    }

    // DIRECTIVE: Confidence ≥ 85%, but NO 100%.
    // We use 0.98 for Reality Anchors as the "Ground Truth" cap.
    // If NOT trusted, we return 0 confidence to indicate no signal (neutral), preventing noise in aggregation.
    const confidence = isTrusted ? 0.98 : 0.0;

    return {
        is_trusted: isTrusted,
        verdict: isTrusted ? 'SAFE' : 'UNKNOWN',
        role,
        is_infra: isInfra,
        engine_result: {
            name: 'root_trust',
            confidence: confidence,
            score: isTrusted ? 0 : 50, // 0 = Safe, 50 = Unknown/Neutral baseline
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
