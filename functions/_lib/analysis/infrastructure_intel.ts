import { InfrastructureIntelResult } from '../types';

/**
 * Infrastructure Abuse Intelligence
 *
 * Detects patterns of infrastructure misuse (e.g. phishing on Azure/Google,
 * high-risk TLDs, or known abuse of trusted CDNs).
 */
export function analyzeInfrastructure(artifact: string, type: string): InfrastructureIntelResult {
    let risk = 0;
    let trustedAbuse = false;
    let provider = 'Unknown';
    let abuseType: string | undefined = undefined;

    const lower = artifact.toLowerCase();

    // 1. Cloud / Free Hosting Provider Abuse Patterns
    // These domains are frequently used for free hosting of phishing pages
    const cloudProviders = [
        { domain: 'googleapis.com', name: 'Google Cloud' },
        { domain: 'firebasestorage.googleapis.com', name: 'Google Firebase' },
        { domain: 'storage.googleapis.com', name: 'Google Cloud Storage' },
        { domain: 'amazonaws.com', name: 'AWS' },
        { domain: 's3.amazonaws.com', name: 'AWS S3' },
        { domain: 'azurewebsites.net', name: 'Azure' },
        { domain: 'blob.core.windows.net', name: 'Azure Blob' },
        { domain: 'herokuapp.com', name: 'Heroku' },
        { domain: 'netlify.app', name: 'Netlify' },
        { domain: 'vercel.app', name: 'Vercel' },
        { domain: 'pages.dev', name: 'Cloudflare Pages' },
        { domain: 'workers.dev', name: 'Cloudflare Workers' },
        { domain: 'r2.dev', name: 'Cloudflare R2' },
        { domain: 'github.io', name: 'GitHub Pages' },
        { domain: 'gitlab.io', name: 'GitLab Pages' }
    ];

    const match = cloudProviders.find(p => lower.includes(p.domain));
    if (match) {
        provider = match.name;
        // Base risk for free hosting (often abused)
        risk += 10;

        // Context-aware abuse detection
        // If a free host URL contains sensitive keywords, it's highly likely to be phishing
        if (type === 'url') {
            const suspiciousKeywords = ['login', 'secure', 'account', 'verify', 'update', 'signin', 'bank', 'wallet', 'crypto'];
            if (suspiciousKeywords.some(kw => lower.includes(kw))) {
                 risk += 50;
                 trustedAbuse = true;
                 abuseType = 'Free Hosting Phishing';
            }
        }
    }

    // 2. Trusted Productivity Suite Abuse (Forms, Docs)
    // Attackers use these to bypass reputation filters
    if (lower.includes('docs.google.com') || lower.includes('forms.office.com') || lower.includes('forms.gle')) {
        provider = 'Trusted Productivity Suite';
        // Mere presence isn't malicious, but combined with other signals it's critical.
        // We assign a baseline risk to ensure it's looked at closely.
        risk += 15;

        if (lower.includes('forms')) {
             abuseType = 'Form Abuse Potential';
        }
    }

    // 3. High-Risk TLDs / Dynamic DNS
    // This overlaps with Structure Engine, but here we focus on Infrastructure Identity
    const cheapTLDs = ['.xyz', '.top', '.gq', '.tk', '.ml', '.cf', '.cn', '.ru', '.rest', '.fit'];
    if (cheapTLDs.some(tld => lower.endsWith(tld) || lower.includes(tld + '/'))) {
        risk += 25;
        abuseType = abuseType || 'High-Risk TLD';
    }

    // 4. IP Check (if input is IP)
    // Simple heuristic for private IPs trying to act as public (SSRF context usually caught earlier, but this is intelligence)
    // We assume input is sanitized public IP or domain/url.

    // 5. CDN Fronting Abuse (Generic Check)
    const cdnDomains = ['cdn.discordapp.com', 'cdn.shopify.com'];
    if (cdnDomains.some(d => lower.includes(d))) {
        provider = 'Content Delivery Network';
        risk += 10;
         if (type === 'url' && (lower.endsWith('.exe') || lower.endsWith('.zip') || lower.endsWith('.pdf'))) {
             risk += 40;
             trustedAbuse = true;
             abuseType = 'CDN Malware Hosting';
         }
    }

    return {
        infrastructure_risk_score: Math.min(100, risk),
        trusted_infra_abuse: trustedAbuse,
        provider_name: provider,
        abuse_type: abuseType
    };
}
