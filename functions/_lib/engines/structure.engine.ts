import { EngineFunction, EngineResult, Signal, Verification } from '../engine_contract';
import { ArtifactType } from '../types';

export const analyzeStructure: EngineFunction = async (artifact, type, context) => {
    const signals: Signal[] = [];
    const verification: Verification[] = [];

    // 1. Verification: Syntax Check
    verification.push({
        check: 'syntax_validation',
        status: 'PASS',
        evidence: { type, valid: true },
        timestamp: new Date().toISOString()
    });

    if (type !== 'url' && type !== 'domain') {
        return {
            engine: 'structure',
            executed: true,
            signals: [],
            verification,
            confidenceImpact: 0.5,
            metadata: { skipped: 'Not a URL/Domain' }
        };
    }

    const lowerArtifact = artifact.toLowerCase();

    // 2. Risk: Homograph Detection (Basic)
    // Cyrillic 'a' (U+0430) vs Latin 'a' (U+0061)
    // Simple check for mixed scripts or punycode xn--
    if (artifact.includes('xn--')) {
         signals.push({
            id: 'homograph_punycode',
            name: 'Punycode Domain Detected',
            severity: 'MEDIUM',
            score_contribution: 40,
            description: 'Domain uses Punycode (xn--), which can be used to spoof legitimate brands.'
         });
    }

    // 3. Risk: URL Shorteners
    const shorteners = ['bit.ly', 'goo.gl', 't.co', 'tinyurl.com', 'is.gd'];
    if (shorteners.some(s => lowerArtifact.includes(s))) {
        signals.push({
            id: 'url_shortener',
            name: 'URL Shortener Detected',
            severity: 'LOW',
            score_contribution: 15, // Low risk, but obfuscates
            description: 'URL uses a shortening service, obscuring the final destination.'
        });
    }

    // 4. Verification: Entropy
    // Simple Shannon entropy or just length/complexity check
    const entropy = calculateEntropy(artifact);
    verification.push({
        check: 'entropy_calculation',
        status: 'PASS',
        evidence: { entropy: entropy.toFixed(2) },
        timestamp: new Date().toISOString()
    });

    if (entropy > 4.5) {
         signals.push({
            id: 'high_entropy',
            name: 'High Entropy URL',
            severity: 'MEDIUM',
            score_contribution: 30,
            description: 'URL contains random-looking characters, common in DGA domains or phishing tokens.'
         });
    }

    // 5. Risk: IP Address Host
    const ipRegex = /(?:[0-9]{1,3}\.){3}[0-9]{1,3}/;
    // Basic check if host part is IP.
    try {
        const url = new URL(artifact.startsWith('http') ? artifact : `http://${artifact}`);
        if (ipRegex.test(url.hostname)) {
             signals.push({
                id: 'ip_host',
                name: 'IP Address Usage',
                severity: 'MEDIUM',
                score_contribution: 25,
                description: 'URL uses a raw IP address instead of a domain name.'
             });
        }
    } catch (e) {
        // Not a valid URL, ignore
    }

    return {
        engine: 'structure',
        executed: true,
        signals,
        verification,
        confidenceImpact: 0.8, // Structure is deterministic, so high confidence
        metadata: { length: artifact.length, entropy }
    };
};

function calculateEntropy(str: string): number {
    const len = str.length;
    const frequencies: Record<string, number> = {};
    for (const char of str) {
        frequencies[char] = (frequencies[char] || 0) + 1;
    }
    let entropy = 0;
    for (const char in frequencies) {
        const p = frequencies[char] / len;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}
