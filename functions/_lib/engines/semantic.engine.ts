import { EngineResult } from './types';
import { SemanticIntentResult, ArtifactType } from '../types';
import { EngineFailureError } from '../errors';

const TRUSTED_INFRA = /google|github|cloudflare|amazon|microsoft|dropbox|herokuapp|netlify|vercel|pages\.dev/i;
const SENSITIVE_KEYWORDS = /login|signin|password|credential|update|verify|banking|wallet|confirm|account|security|viewform/i;

export async function analyzeSemantic(artifact: string, type: ArtifactType): Promise<EngineResult & { semantic_intent: SemanticIntentResult }> {
    let intent: SemanticIntentResult['intent'] | null = null;
    let confidence = 0.0;
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
    // FAIL FAST POLICY: If fetch fails, we let it throw. The orchestrator will catch it and fail the analysis.
    if (type === 'url' && (artifact.startsWith('http://') || artifact.startsWith('https://'))) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        try {
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
                        confidence = 0.9;
                        // If it was already suspicious (trusted infra), this confirms abuse.
                    } else if (hasEmailInput) {
                        indicators.push('Email collection field detected');
                        score += 20;
                        if (!intent || intent === 'BENIGN') {
                            intent = 'SUSPICIOUS';
                            confidence = 0.75;
                        }
                    } else {
                        indicators.push('HTML Form detected');
                        score += 10;
                        if (!intent) {
                            intent = 'BENIGN';
                            confidence = 0.6;
                        }
                    }
                } else {
                     // No forms found - likely static content
                     if (!intent) {
                         intent = 'BENIGN';
                         confidence = 0.8; // High confidence it's benign semantics (no forms)
                     }
                }
            } else {
                // Resp not OK (4xx/5xx)
                // Explicitly throw failure
                throw new Error(`Upstream HTTP ${resp.status}`);
            }
        } catch (e: any) {
             clearTimeout(timeoutId);
             // Wrap fetch errors in EngineFailureError for the orchestrator to log and abort
             throw new EngineFailureError('semantic', `Fetch failed: ${e.message}`);
        }
    } else {
        // Not a URL or not http/https
        if (!intent) {
            intent = 'BENIGN';
            confidence = 0.0; // No Signal
        }
    }

    // Final Logic Check
    if (!intent) {
         // Should have been set by URL analysis or fetch results
         intent = 'BENIGN';
         confidence = 0.0;
    }

    if (indicators.length === 0) {
        indicators.push('semantic_neutral');
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
