import { ArtifactType, FeatureResult } from '../types';
import { EngineResult } from './types';
import { CognitiveTraceStep } from '../cognitive_trace';

// Retain constants
const SUSPICIOUS_TLDS = new Set([
    'xyz', 'top', 'gq', 'tk', 'ml', 'cf', 'ga', 'icu', 'cn', 'ru', 'work', 'date', 'click'
]);

const PHISHING_KEYWORDS = [
    'login', 'signin', 'secure', 'account', 'verify', 'update', 'banking', 'wallet', 'crypto',
    'confirm', 'support', 'service', 'security', 'billing', 'invoice', 'paypal', 'apple', 'microsoft',
    'google', 'facebook', 'amazon', 'netflix'
];

const URGENCY_KEYWORDS = [
    'urgent', 'immediate', 'action required', 'suspended', 'locked', 'unauthorized', 'deadline', 'expires'
];

export function analyzeHeuristic(artifact: string, type: ArtifactType): EngineResult {
    let score = 0;
    const features: FeatureResult[] = [];
    const signals: string[] = [];
    const trace: CognitiveTraceStep[] = [];
    const lower = artifact.toLowerCase();

    const addFeature = (id: string, description: string, risk: number, evidence: string) => {
        signals.push(id);
        features.push({
            id,
            tier: 'TIER_1_LOCAL',
            detected: true,
            riskContribution: risk,
            description,
            evidence: [evidence]
        });
        score += risk;

        trace.push({
            engine: 'heuristic',
            observation: evidence,
            rationale: description,
            impact: risk,
            confidence: 0.9
        });
    };

    // --- Universal Checks ---

    // Urgency Check (Phishing/Social Engineering)
    const urgencyMatch = URGENCY_KEYWORDS.find(k => lower.includes(k));
    if (urgencyMatch) {
        addFeature('urgency_cues', 'Urgency or pressure keywords detected', 25, urgencyMatch);
    }

    // Financial/Credential Check
    const phishMatch = PHISHING_KEYWORDS.find(k => lower.includes(k));
    if (phishMatch) {
        addFeature('credential_targeting', 'Credential harvesting or financial keywords detected', 30, phishMatch);
    }

    // --- Type Specific Checks ---

    if (type === 'domain' || type === 'url') {
        // Extract domain
        let domain = artifact;
        if (type === 'url') {
            try {
                const url = new URL(artifact);
                domain = url.hostname;

                // IP Host Check
                if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
                     addFeature('ip_host', 'URL uses raw IP address instead of domain', 40, domain);
                }

                // Suspicious Path/Query
                if (url.pathname.length > 50 || url.search.length > 50) {
                     addFeature('long_path', 'Suspiciously long URL path or query', 10, 'Length > 50');
                }
                if (url.username || url.password) {
                     addFeature('embedded_auth', 'URL contains embedded authentication credentials', 50, 'user:pass@host');
                }

            } catch (e) {
                // Invalid URL
            }
        }

        const parts = domain.split('.');
        const tld = parts[parts.length - 1];

        // Suspicious TLD
        if (SUSPICIOUS_TLDS.has(tld)) {
            addFeature('suspicious_tld', `Domain uses high-risk TLD (.${tld})`, 20, tld);
        }

        // High Entropy / DGA-like (simple heuristic: many numbers or long random looking string)
        const name = parts[0];
        if (name.length > 15 && /\d/.test(name)) {
             addFeature('high_entropy_domain', 'Domain label appears randomly generated (DGA-like)', 15, name);
        }

        // Double Extensions or Masquerading
        if (domain.includes('.com-') || domain.includes('.net-') || domain.includes('.org-') || domain.includes('paypal') && !domain.endsWith('.paypal.com')) {
             addFeature('typosquatting', 'Potential typosquatting or brand masquerading', 45, domain);
        }

        // Subdomain Abuse / Brand Masquerading
        const TARGETED_BRANDS = ['google', 'microsoft', 'apple', 'amazon', 'netflix', 'facebook', 'dropbox'];
        for (const brand of TARGETED_BRANDS) {
            // Check if brand appears in domain but is not the SLD
            // e.g. google.com.evil.com
            if (domain.includes(brand)) {
                 const isOfficial = domain.endsWith(`.${brand}.com`) || domain.endsWith(`.${brand}.org`) || domain.endsWith(`.${brand}.net`) || domain === `${brand}.com` || domain === `${brand}.org` || domain === `${brand}.net`;
                 if (!isOfficial) {
                      addFeature('subdomain_abuse', `Detected '${brand}' in subdomain (potential impersonation)`, 60, domain);
                 }
            }
        }

        // Homoglyph / Lookalike Detection (Visual Spoofing)
        // Detects common visual hacks (e.g., paypaI, googIe, arnazon)
        const homoglyphs = /paypai|googIe|rnicrosoft|arnazon|faceb00k|lnstagram|linkedin|netflix/i;
        if (homoglyphs.test(domain)) {
             addFeature('typosquatting', 'Detected homoglyph or visual spoofing of major brand', 55, domain);
        }
    }

    if (type === 'email') {
        const [user, domain] = artifact.split('@');
        if (domain && SUSPICIOUS_TLDS.has(domain.split('.').pop() || '')) {
             addFeature('suspicious_email_tld', 'Email domain uses high-risk TLD', 25, domain);
        }
        if (user.toLowerCase().includes('admin') || user.toLowerCase().includes('support') || user.toLowerCase().includes('security')) {
            addFeature('impersonation_risk', 'Email user part mimics authority figure', 15, user);
        }
    }

    // Normalize Score 0-100
    score = Math.min(100, Math.max(0, score));

    // Summary Generation
    let summary = '';
    let explanation = '';

    if (score > 70) {
        summary = 'High-risk indicators identified via heuristic analysis.';
        explanation = 'The artifact exhibits multiple strong indicators associated with malicious activity, such as phishing patterns or high-risk infrastructure.';
    } else if (score > 40) {
        summary = 'Suspicious characteristics detected.';
        explanation = 'Several risk factors were found, suggesting potential misuse or low reputation, though definitive malicious intent is not confirmed.';
    } else {
        summary = 'No significant risk factors detected.';
        explanation = 'The artifact conforms to standard patterns and lacks specific risk indicators known to our heuristic engine.';
    }

    explanation += ' (Analysis based on static pattern matching and heuristic rules).';

    return {
        name: 'heuristic',
        confidence: 0.9,
        score,
        signals,
        features,
        summary,
        explanation,
        trace
    };
}
