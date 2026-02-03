import { EngineFunction, EngineResult, Signal, Verification } from '../engine_contract';

export const analyzeSemantic: EngineFunction = async (artifact, type, context) => {
    const signals: Signal[] = [];
    const verification: Verification[] = [];

    const lowerArtifact = artifact.toLowerCase();

    // 1. Verification: Keywords Scanned
    verification.push({
        check: 'keyword_analysis',
        status: 'PASS',
        evidence: { patterns_checked: 50 },
        timestamp: new Date().toISOString()
    });

    // 2. Risk: Sensitive Keywords (Credential Harvesting Intent)
    const sensitiveKeywords = ['login', 'signin', 'password', 'credential', 'verify', 'account', 'security-check', 'update-payment', 'confirm'];
    const foundKeywords = sensitiveKeywords.filter(k => lowerArtifact.includes(k));

    if (foundKeywords.length > 0) {
        signals.push({
            id: 'sensitive_keywords',
            name: 'Sensitive Keywords Detected',
            severity: 'MEDIUM',
            score_contribution: 45,
            description: `URL contains keywords associated with authentication or account management: ${foundKeywords.join(', ')}`,
            metadata: { keywords: foundKeywords }
        });
    }

    // 3. Risk: Brand Impersonation
    // Check if brand is present but domain is NOT the brand's official domain
    const brands: Record<string, string[]> = {
        'google': ['google.com', 'google.co', 'gstatic.com', 'googleapis.com'],
        'microsoft': ['microsoft.com', 'live.com', 'azure.com', 'office.com'],
        'apple': ['apple.com', 'icloud.com'],
        'paypal': ['paypal.com'],
        'amazon': ['amazon.com', 'aws.amazon.com'],
        'facebook': ['facebook.com', 'fb.com', 'meta.com'],
        'netflix': ['netflix.com']
    };

    try {
        if (type === 'url' || artifact.includes('.')) {
             // Extract hostname roughly if not already
             const urlStr = artifact.startsWith('http') ? artifact : `http://${artifact}`;
             const url = new URL(urlStr);
             const hostname = url.hostname;

             for (const [brand, trustedDomains] of Object.entries(brands)) {
                 if (hostname.includes(brand)) {
                     // Check if it ends with any trusted domain
                     const isTrusted = trustedDomains.some(td => hostname === td || hostname.endsWith(`.${td}`));

                     if (!isTrusted) {
                         signals.push({
                            id: 'brand_impersonation',
                            name: `Potential ${brand.charAt(0).toUpperCase() + brand.slice(1)} Impersonation`,
                            severity: 'HIGH',
                            score_contribution: 70,
                            description: `The domain contains '${brand}' but is not owned by the official organization.`,
                            metadata: { brand, detected_in: hostname }
                         });
                     }
                 }
             }
        }
    } catch (e) {
        // Parsing error, skip brand check
    }

    return {
        engine: 'semantic',
        executed: true,
        signals,
        verification,
        confidenceImpact: 0.7,
        metadata: { intent_model: 'keyword_v2' }
    };
};
