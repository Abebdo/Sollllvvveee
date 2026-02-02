import { RiskVerdict, ContextualVerdict } from '../types';

export function applyContextualVerdict(
    verdict: RiskVerdict,
    contextSource?: string
): ContextualVerdict {
    let adjusted = verdict;
    let downgrade = false;
    const notes: string[] = [];

    if (!contextSource) {
        return {
            original_verdict: verdict,
            adjusted_verdict: verdict,
            context_downgrade: false,
            context_notes: []
        };
    }

    const src = contextSource.toLowerCase();

    // Context Rules

    // 1. Email Links
    // Email links are high risk vectors. If the site is Benign (Safe), we treat it as Suspicious
    // because email vectors often bypass reputation filters (zero-day phishing).
    if (src === 'email' && verdict === 'BENIGN') {
        adjusted = 'SUSPICIOUS';
        downgrade = true;
        notes.push('Artifact accessed via Email Context; security posture elevated to Suspicious.');
    }

    // 2. Redirect Chains / Shorteners
    if ((src === 'redirect' || src === 'shortener') && verdict === 'BENIGN') {
        adjusted = 'SUSPICIOUS';
        downgrade = true;
        notes.push('Artifact accessed via redirection or shortener; implicit trust revoked.');
    }

    // 3. Embedded Iframe
    if (src === 'iframe' && verdict === 'BENIGN') {
        adjusted = 'SUSPICIOUS';
        downgrade = true;
        notes.push('Artifact loaded in iframe context; trust downgraded.');
    }

    // 4. Automation / API (Bot)
    // Often used for probing. Not necessarily risky for the user, but risky for the system?
    // No specific rule in prompt, skipping.

    return {
        original_verdict: verdict,
        adjusted_verdict: adjusted,
        context_downgrade: downgrade,
        context_notes: notes
    };
}
