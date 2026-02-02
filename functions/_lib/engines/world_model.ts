
// Engine 65 — Global Internet Reality Model
// Defines the "Ground Truth" of the internet to prevent hallucinations.

export const GLOBAL_HUMAN_TRUST_SET = new Set([
  'google.com',
  'youtube.com',
  'amazon.com',
  'microsoft.com',
  'apple.com',
  'github.com',
  'cloudflare.com',
  'paypal.com', // Base domain only
  'linkedin.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'netflix.com',
  'wikipedia.org',
  'adobe.com',
  'salesforce.com',
  'dropbox.com',
  'zoom.us',
  'slack.com',
  'spotify.com',
  'whatsapp.com',
  'openai.com'
]);

export const REALITY_ANCHORS: Record<string, { role: string; type: 'INFRASTRUCTURE' | 'PLATFORM' | 'COMMERCE' | 'FINANCE' }> = {
  'google.com': { role: 'Infrastructure Provider', type: 'INFRASTRUCTURE' },
  'googleapis.com': { role: 'API Infrastructure', type: 'INFRASTRUCTURE' },
  'gstatic.com': { role: 'Static Content', type: 'INFRASTRUCTURE' },
  'amazon.com': { role: 'Infrastructure + Commerce', type: 'COMMERCE' },
  'aws.amazon.com': { role: 'Cloud Infrastructure', type: 'INFRASTRUCTURE' },
  'cloudflare.com': { role: 'Security Layer', type: 'INFRASTRUCTURE' },
  'github.com': { role: 'Developer Platform', type: 'PLATFORM' },
  'githubusercontent.com': { role: 'Content Delivery', type: 'INFRASTRUCTURE' },
  'microsoft.com': { role: 'Identity + Cloud', type: 'INFRASTRUCTURE' },
  'live.com': { role: 'Identity Provider', type: 'INFRASTRUCTURE' },
  'office.com': { role: 'Productivity Platform', type: 'PLATFORM' },
  'apple.com': { role: 'Ecosystem Root', type: 'PLATFORM' },
  'paypal.com': { role: 'Payment Processor', type: 'FINANCE' },
  'stripe.com': { role: 'Payment Infrastructure', type: 'FINANCE' }
};

export const GLOBAL_INFRA_PROVIDERS = new Set([
    'google.com', 'googleapis.com', 'gstatic.com',
    'amazon.com', 'aws.amazon.com',
    'microsoft.com', 'azure.com', 'windows.net',
    'cloudflare.com',
    'fastly.com',
    'akamai.com',
    'github.com', 'githubusercontent.com',
    'netlify.com', 'netlify.app',
    'vercel.com', 'vercel.app',
    'herokuapp.com',
    'gitlab.com',
    'bitbucket.org'
]);

export function isRealityAnchor(domain: string): boolean {
    if (!domain) return false;
    const lower = domain.toLowerCase();

    // Direct match
    if (GLOBAL_HUMAN_TRUST_SET.has(lower)) return true;
    if (REALITY_ANCHORS[lower]) return true;

    // Subdomain check for trusted sets (e.g. mail.google.com)
    // Note: We must be careful not to allow evil-google.com
    for (const root of GLOBAL_HUMAN_TRUST_SET) {
        if (lower.endsWith('.' + root) && lower.slice(-(root.length + 1)) === '.' + root) {
            return true;
        }
    }

    return false;
}

export function getProviderRole(domain: string): string | null {
    if (!domain) return null;
    const lower = domain.toLowerCase();

    if (REALITY_ANCHORS[lower]) return REALITY_ANCHORS[lower].role;

    // Check parent domains
    for (const [root, info] of Object.entries(REALITY_ANCHORS)) {
         if (lower.endsWith('.' + root) && lower.slice(-(root.length + 1)) === '.' + root) {
            return info.role;
        }
    }

    return null;
}

export function isGlobalInfraProvider(domain: string): boolean {
    if (!domain) return false;
    const lower = domain.toLowerCase();

    if (GLOBAL_INFRA_PROVIDERS.has(lower)) return true;

    for (const root of GLOBAL_INFRA_PROVIDERS) {
         if (lower.endsWith('.' + root) && lower.slice(-(root.length + 1)) === '.' + root) {
            return true;
        }
    }
    return false;
}
