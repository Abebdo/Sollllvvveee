import { RiskVerdict, ContextualVerdict } from '../types';

export function applyContextualVerdict(
    originalVerdict: RiskVerdict,
    contextSource?: string
): ContextualVerdict {
    const result: ContextualVerdict = {
        original_verdict: originalVerdict,
        adjusted_verdict: originalVerdict,
        context_downgrade: false,
        context_notes: []
    };

    if (!contextSource) return result;

    const source = contextSource.toLowerCase();

    // Rule: Email context is high risk for unexpected links
    if (source === 'email') {
        if (originalVerdict === 'BENIGN') {
            result.adjusted_verdict = 'SUSPICIOUS';
            result.context_downgrade = true;
            result.context_notes.push('Downgraded to Suspicious due to Email context (high phishing vector)');
        }
    }

    // Rule: URL Shortener context
    // Often used to obfuscate
    if (source === 'url_shortener' || source === 'shortener') {
        if (originalVerdict === 'BENIGN') {
             // Maybe not full suspicious, but if we have ANY doubt?
             // Directive example only mentioned Email, but listed url_shortener as mandatory context.
             // Let's be cautious.
             result.adjusted_verdict = 'SUSPICIOUS';
             result.context_downgrade = true;
             result.context_notes.push('Downgraded to Suspicious due to URL Shortener context (obfuscation risk)');
        }
    }

    // Rule: Redirect chain
    if (source === 'redirect') {
        // If it was a redirect, and it's benign, it might be okay.
        // But if it's unknown/suspicious, maybe upgrade?
        // Let's stick to downgrading Benign if applicable.
        // Redirects are common. Unless deep chain.
        // Let's leave it unless directive specified.
        // "Mandatory contexts: ... redirect".
        // I will just add a note if it's suspicious.
        if (originalVerdict === 'SUSPICIOUS') {
            result.context_notes.push('Redirect context reinforces Suspicious verdict');
        }
    }

    return result;
}
