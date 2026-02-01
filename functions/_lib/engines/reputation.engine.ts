import { ArtifactType, FeatureResult } from '../types';
import { EngineResult } from './types';
import { CognitiveTraceStep } from '../cognitive_trace';

// Mock Databases
const SAFE_DOMAINS = new Set([
    'google.com', 'www.google.com',
    'microsoft.com', 'www.microsoft.com',
    'github.com', 'www.github.com',
    'cloudflare.com', 'www.cloudflare.com',
    'apple.com', 'www.apple.com',
    'amazon.com', 'www.amazon.com'
]);

const MALICIOUS_PATTERNS = [
    'malware', 'phishing', 'virus', 'exploit', 'betting', 'casino-fake'
];

export function analyzeReputation(artifact: string, type: ArtifactType): EngineResult {
    const features: FeatureResult[] = [];
    const signals: string[] = [];
    const trace: CognitiveTraceStep[] = [];
    let score = 0;

    // Default neutral
    let confidence = 0.5;

    if (type === 'domain' || type === 'url') {
        let domain = artifact;
        if (type === 'url') {
            try {
                domain = new URL(artifact).hostname;
            } catch (e) { }
        }

        // Allowlist
        if (SAFE_DOMAINS.has(domain)) {
            const id = 'reputation_allowlist';
            signals.push(id);
            features.push({
                id,
                tier: 'TIER_1_LOCAL',
                detected: true,
                riskContribution: -100, // Safe
                description: 'Domain found in highly trusted allowlist',
                evidence: [domain]
            });

            trace.push({
                engine: 'reputation',
                observation: domain,
                rationale: 'Domain found in highly trusted allowlist',
                impact: -100,
                confidence: 1.0
            });

            score = 0;
            confidence = 1.0;
            return { name: 'reputation', confidence, score, signals, features, trace };
        }

        // Blocklist / Keywords
        const match = MALICIOUS_PATTERNS.find(p => domain.includes(p));
        if (match) {
             const id = 'reputation_blocklist_pattern';
             signals.push(id);
             features.push({
                 id,
                 tier: 'TIER_1_LOCAL',
                 detected: true,
                 riskContribution: 90,
                 description: 'Domain matches known malicious pattern',
                 evidence: [match]
             });

             trace.push({
                engine: 'reputation',
                observation: match,
                rationale: 'Domain matches known malicious pattern',
                impact: 90,
                confidence: 0.9
             });

             score += 90;
             confidence = 0.9;
        }
    }

    return {
        name: 'reputation',
        confidence,
        score: Math.min(100, Math.max(0, score)),
        signals,
        features,
        trace
    };
}
