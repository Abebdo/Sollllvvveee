import { EngineResult } from './types';
import { ArtifactType, DomainTrustVerdict } from '../types';

export const ROOT_TRUSTED_DOMAINS = new Set([
  'google.com',
  'microsoft.com',
  'github.com',
  'apple.com',
  'cloudflare.com',
  'amazon.com',
  'aws.amazon.com',
  'dropbox.com',
  'salesforce.com',
  'atlassian.com',
  'gitlab.com',
  'vercel.com',
  'netlify.com',
  'herokuapp.com',
  'pages.dev',
  'workers.dev',
  'githubusercontent.com',
  'raw.githubusercontent.com',
  'linkedin.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'slack.com',
  'zoom.us',
  'adobe.com'
]);

export function isRootTrusted(domain: string): boolean {
    if (!domain) return false;
    const lower = domain.toLowerCase();

    // Direct match
    if (ROOT_TRUSTED_DOMAINS.has(lower)) return true;

    // Subdomain check
    for (const root of ROOT_TRUSTED_DOMAINS) {
        if (lower.endsWith('.' + root)) {
            return true;
        }
    }

    return false;
}

export async function analyzeRootTrust(artifact: string, type: ArtifactType): Promise<{
    is_trusted: boolean;
    verdict: DomainTrustVerdict;
    engine_result: EngineResult;
}> {
    let isTrusted = false;

    if (type === 'domain' || type === 'url') {
        try {
            let hostname = artifact;
            if (type === 'url') {
                try {
                    const url = new URL(artifact);
                    hostname = url.hostname;
                } catch (e) {
                    // Fallback if URL parsing fails but type is URL (rare)
                    hostname = artifact.split('/')[0];
                }
            } else {
                 // For domain type, handle potential protocol prefix if passed incorrectly
                 hostname = artifact.replace(/^https?:\/\//, '').split('/')[0];
            }

            isTrusted = isRootTrusted(hostname);
        } catch (e) {
            console.warn('Root trust analysis failed to parse artifact', e);
        }
    }

    return {
        is_trusted: isTrusted,
        verdict: isTrusted ? 'SAFE' : 'UNKNOWN', // Default to UNKNOWN (neutral), not UNTRUSTED
        engine_result: {
            name: 'root_trust',
            confidence: 1.0,
            score: isTrusted ? 0 : 50, // 0 = Safe, 50 = Neutral
            signals: isTrusted ? ['ROOT_TRUST_IMMUNITY'] : [],
            features: [],
            summary: isTrusted ? 'Domain belongs to globally trusted root infrastructure.' : 'Domain is not in the root trust allowlist.'
        }
    };
}
