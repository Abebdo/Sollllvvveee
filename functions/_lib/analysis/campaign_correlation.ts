import { CampaignCorrelationResult, CampaignMemoryResult } from '../types';

/**
 * Campaign Correlation Engine
 *
 * Correlates artifacts to detect coordinated campaigns.
 * Uses structural fingerprinting to link disparate URLs to common infrastructure or kits.
 */

export function generateCampaignFingerprint(artifact: string): string {
    // Simple structural fingerprinting
    // Goal: Identify the underlying kit or template, ignoring unique tokens
    try {
        let url: URL;
        if (artifact.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:/)) {
            url = new URL(artifact);
        } else if (artifact.includes('.') && !artifact.includes(' ')) {
            url = new URL(`http://${artifact}`);
        } else {
            return `raw:${artifact}`;
        }

        // Logic:
        // 1. Hostname (without subdomains if they look like generated randomness, but keep for now)
        // 2. Path structure: Keep first segment, discard query params and deep paths
        // e.g. login.microsoftonline.com/common/ -> login.microsoftonline.com|common
        // e.g. bad-site.com/auth/login.php?token=... -> bad-site.com|auth

        const pathParts = url.pathname.split('/').filter(Boolean);
        const firstSegment = pathParts.length > 0 ? pathParts[0] : 'root';

        // normalize
        const host = url.hostname.toLowerCase().replace('www.', '');

        return `${host}|${firstSegment}`;
    } catch (e) {
        // Fallback for non-URLs or parse failures
        return `raw:${artifact.substring(0, 32)}`;
    }
}

export function analyzeCampaignCorrelation(
    artifact: string,
    memory: CampaignMemoryResult
): CampaignCorrelationResult {
    if (!memory.campaign_id || memory.related_count <= 1) {
        return {
            campaign_id: undefined,
            campaign_confidence: 0,
            related_artifacts_count: memory.related_count || 0,
            campaign_name: undefined
        };
    }

    // If we have a hit in memory (count > 1 implies we've seen this pattern before)
    const confidence = memory.confidence;
    const count = memory.related_count;

    // Naming logic (simple heuristic)
    let campaignName = `Potential Cluster (${memory.campaign_id})`;
    if (count > 50) {
        campaignName = `High-Volume Campaign (${memory.campaign_id})`;
    } else if (count > 10) {
        campaignName = `Active Campaign (${memory.campaign_id})`;
    }

    return {
        campaign_id: memory.campaign_id,
        campaign_confidence: confidence,
        related_artifacts_count: count,
        campaign_name: campaignName
    };
}
