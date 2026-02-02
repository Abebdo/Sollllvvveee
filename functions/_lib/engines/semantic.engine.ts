import { EngineResult } from './types';
import { SemanticIntentResult, ArtifactType } from '../types';

const TRUSTED_INFRA = /google|github|cloudflare|amazon|microsoft|dropbox|herokuapp|netlify|vercel|pages\.dev/i;
const SENSITIVE_KEYWORDS = /login|signin|password|credential|update|verify|banking|wallet|confirm|account|security|viewform/i;

export async function analyzeSemantic(artifact: string, type: ArtifactType): Promise<EngineResult & { semantic_intent: SemanticIntentResult }> {
    let intent: SemanticIntentResult['intent'] = 'BENIGN';
    let confidence = 0.5;
    const indicators: string[] = [];
    let score = 0;

    // 1. URL Semantics
    if (type === 'url' || type === 'domain') {
        const lower = artifact.toLowerCase();
        const isTrustedInfra = TRUSTED_INFRA.test(artifact);
        const hasSensitiveKeywords = SENSITIVE_KEYWORDS.test(lower);

        // Context Mismatch: Trusted Infra + Sensitive Keywords
        // e.g. "docs.google.com/spreadsheets/d/e/.../login" (in path/query??)
        // Or "cloudflare-ipfs.com/login"
        if (isTrustedInfra && hasSensitiveKeywords) {
             indicators.push('Sensitive keywords found on trusted infrastructure (potential hosting abuse)');
             score += 35;
             intent = 'SUSPICIOUS';
             confidence = 0.7;
        }
    }

    // 2. Content Semantics (Simulated Fetch)
    // In a real environment, we would fetch. Here we attempt it but fail gracefully.
    // NOTE: This runs in Cloudflare Workers, so fetch IS available.
    if (type === 'url' && (artifact.startsWith('http://') || artifact.startsWith('https://'))) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout fast

            const resp = await fetch(artifact, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Solveya/1.0; +https://solveya.com/bot)',
                    'Accept': 'text/html'
                },
                redirect: 'follow',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (resp.ok) {
                const text = await resp.text();

                // HTML Form Detection
                const hasForm = /<form/i.test(text);
                const hasPassword = /type=["']?password["']?/i.test(text);
                const hasEmailInput = /type=["']?email["']?/i.test(text);

                if (hasForm) {
                    if (hasPassword) {
                        indicators.push('Credential entry field (password) detected');
                        score += 65;
                        intent = 'MALICIOUS';
                        // If it was already suspicious (trusted infra), this confirms abuse.
                    } else if (hasEmailInput) {
                        indicators.push('Email collection field detected');
                        score += 20;
                        if (intent === 'BENIGN') intent = 'SUSPICIOUS';
                    } else {
                        indicators.push('HTML Form detected');
                        score += 10;
                    }
                }
            }
        } catch (e) {
            // Fetch failed or timed out - ignore, relies on URL heuristics
        }
    }

    // Rule: Trusted Infrastructure + Malicious Intent = Suspicious (Abuse)
    // If we detected 'MALICIOUS' intent (e.g. password field) but it is TRUSTED INFRA
    // We explicitly downgrade to SUSPICIOUS per directive.
    const isTrusted = TRUSTED_INFRA.test(artifact);
    if (intent === 'MALICIOUS' && isTrusted) {
        intent = 'SUSPICIOUS';
        indicators.push('Verdict clamped to SUSPICIOUS due to Trusted Infrastructure origin (Reputation Abuse logic)');
        // Ensure score reflects this clamp?
        // If it was 85 (Malicious), we might keep the score but change the *Intent* label.
        // But the verdict is derived from score in Orchestrator.
        // We should adjust score to be in Suspicious range (50-80).
        score = Math.min(score, 75);
    }

    // Final Score Normalization
    score = Math.min(100, Math.max(0, score));

    // Construct Semantic Intent Result
    const semanticResult: SemanticIntentResult = {
        intent,
        confidence,
        indicators
    };

    return {
        name: 'semantic',
        confidence,
        score,
        signals: indicators,
        features: [],
        summary: `Semantic intent identified as ${intent}`,
        semantic_intent: semanticResult
    };
}
