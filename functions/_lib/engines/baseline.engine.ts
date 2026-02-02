import { ArtifactType, FeatureResult } from '../types';
import { EngineResult } from './types';
import { CognitiveTraceStep } from '../cognitive_trace';

// Defines expected behaviors for high-value targets
interface BaselineProfile {
    entity: string;
    allowed_domains: string[];
    suspicious_patterns: RegExp[];
    required_patterns?: RegExp[];
    description: string;
}

const BASELINE_PROFILES: BaselineProfile[] = [
    {
        entity: 'Google',
        allowed_domains: ['google.com', 'www.google.com', 'accounts.google.com', 'drive.google.com', 'docs.google.com', 'youtube.com'],
        suspicious_patterns: [
            /login\.php/i,
            /admin/i,
            /secure/i,
            /update/i,
            /verify/i,
            /\.xyz$/i,
            /\.top$/i
        ],
        description: 'Google services typically use specific subdomains and clean paths.'
    },
    {
        entity: 'Microsoft',
        allowed_domains: ['microsoft.com', 'live.com', 'office.com', 'azure.com', 'windows.net'],
        suspicious_patterns: [
            /security-check/i,
            /verify-account/i,
            /\.php$/i
        ],
        description: 'Microsoft enterprise services rarely use PHP or generic verification paths.'
    },
    {
        entity: 'Financial',
        allowed_domains: ['paypal.com', 'chase.com', 'wellsfargo.com', 'bankofamerica.com'],
        suspicious_patterns: [
            /update-info/i,
            /security-alert/i,
            /\.html$/i, // Banks usually use dynamic backends, static html is rare for login
            /\.free/i
        ],
        description: 'Financial institutions enforce strict URL structures.'
    },
    {
        entity: 'Government',
        allowed_domains: [], // Check .gov TLD
        suspicious_patterns: [
            /\.com/i, // .gov sites shouldn't redirect to .com easily in paths
            /login-secure/i
        ],
        description: 'Government domains (.gov) have strict registrar controls.'
    }
];

export function analyzeBaseline(artifact: string, type: ArtifactType): EngineResult {
    const start = Date.now();
    const features: FeatureResult[] = [];
    const signals: string[] = [];
    const trace: CognitiveTraceStep[] = [];
    let deviationScore = 0;
    let deviationReasoning = "Artifact aligns with expected baseline behavior.";

    // Normalize artifact
    let domain = artifact;
    let path = '/';

    if (type === 'url') {
        try {
            const url = new URL(artifact);
            domain = url.hostname;
            path = url.pathname + url.search;
        } catch (e) {
            // Invalid URL, fallback to raw string analysis
        }
    } else if (type === 'domain') {
        domain = artifact;
    }

    // Identify profile
    let matchedProfile: BaselineProfile | null = null;

    // Check .gov
    if (domain.endsWith('.gov')) {
        matchedProfile = BASELINE_PROFILES.find(p => p.entity === 'Government') || null;
    } else {
        // Check domains
        for (const profile of BASELINE_PROFILES) {
            if (profile.entity === 'Government') continue;
            // Strict check: Is it the domain or a subdomain?
            const isRelated = profile.allowed_domains.some(d => domain === d || domain.endsWith('.' + d));
            if (isRelated) {
                matchedProfile = profile;
                break;
            }
        }
    }

    if (matchedProfile) {
        // Deviation Analysis
        const isAllowed = matchedProfile.allowed_domains.some(d => domain === d || domain.endsWith('.' + d));

        // 1. Domain Anomaly (e.g. google-secure.com which is NOT google.com)
        // Note: The loop above finds "related" domains. If it matched "google" but isn't an allowed domain (e.g. via keyword search not implemented here), it would be caught.
        // Since we match by allowed_domains, we know it IS an allowed domain (or subdomain).
        // So we check for suspicious subdomains or paths.

        // Check for suspicious patterns in the full artifact
        const suspiciousMatch = matchedProfile.suspicious_patterns.find(p => p.test(artifact));

        if (suspiciousMatch) {
            deviationScore = 75; // High deviation
            deviationReasoning = `Artifact matches ${matchedProfile.entity} profile but contains suspicious pattern: ${suspiciousMatch}`;

            const id = `baseline_deviation_${matchedProfile.entity.toLowerCase()}`;
            signals.push(id);
            features.push({
                id,
                tier: 'TIER_1_LOCAL',
                detected: true,
                riskContribution: 75,
                description: deviationReasoning,
                evidence: [artifact, suspiciousMatch.source]
            });

            trace.push({
                engine: 'baseline',
                observation: `Pattern match '${suspiciousMatch.source}' in ${matchedProfile.entity} context`,
                rationale: matchedProfile.description,
                impact: 75,
                confidence: 0.85
            });
        } else {
             trace.push({
                engine: 'baseline',
                observation: `Artifact matches ${matchedProfile.entity} profile with standard structure`,
                rationale: 'No deviation from baseline detected',
                impact: 0,
                confidence: 0.9
            });
        }
    } else {
        // Generic Baseline for Unknown Entities
        // e.g. unusually long subdomains, excessive special chars
        if (domain.split('.').length > 5) {
             deviationScore = 40;
             deviationReasoning = "Unusual subdomain depth for generic entity";

             features.push({
                id: 'baseline_generic_depth',
                tier: 'TIER_1_LOCAL',
                detected: true,
                riskContribution: 40,
                description: deviationReasoning,
                evidence: [domain]
             });

             trace.push({
                engine: 'baseline',
                observation: 'High subdomain depth',
                rationale: 'Most legitimate entities use 2-3 levels max',
                impact: 40,
                confidence: 0.6
             });
        }
    }

    return {
        name: 'baseline',
        confidence: 0.8, // Baseline is heuristic, so not 1.0
        score: deviationScore,
        signals,
        features,
        deviation_score: deviationScore,
        deviation_reasoning: deviationReasoning,
        trace
    };
}
