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
    if (source.includes('email')) {
        if (originalVerdict === 'BENIGN') {
            result.adjusted_verdict = 'SUSPICIOUS';
            result.context_downgrade = true;
            result.context_notes.push('Downgraded to Suspicious due to Email context (high phishing vector)');
        }
    }

    // Rule: URL Shortener context
    if (source.includes('shortener') || source.includes('bit.ly') || source.includes('tinyurl')) {
        if (originalVerdict === 'BENIGN') {
             result.adjusted_verdict = 'SUSPICIOUS';
             result.context_downgrade = true;
             result.context_notes.push('Downgraded to Suspicious due to URL Shortener context (obfuscation risk)');
        }
    }

    // Rule: Redirect chain
    if (source.includes('redirect')) {
        if (originalVerdict === 'SUSPICIOUS') {
            result.context_notes.push('Redirect chain reinforces Suspicious verdict');
        } else if (originalVerdict === 'BENIGN' && source.includes('multiple_redirects')) {
            // If it's a long chain, downgrade
            result.adjusted_verdict = 'SUSPICIOUS';
            result.context_downgrade = true;
            result.context_notes.push('Downgraded to Suspicious due to multiple redirects (evasion risk)');
        }
    }

    // Rule: Embedded Credential Context
    if (source.includes('credential') || source.includes('login')) {
         if (originalVerdict === 'BENIGN') {
            result.adjusted_verdict = 'SUSPICIOUS';
            result.context_downgrade = true;
            result.context_notes.push('Downgraded to Suspicious due to credential context');
         }
         // If malicious intent was detected elsewhere, this context reinforces it.
    }

    // Rule: Social Engineering Indicators
    if (source.includes('social_engineering') || source.includes('urgency') || source.includes('sms')) {
        if (originalVerdict === 'BENIGN') {
            result.adjusted_verdict = 'SUSPICIOUS';
            result.context_downgrade = true;
            result.context_notes.push('Downgraded due to social engineering indicators in context');
        }
    }

    return result;
}
