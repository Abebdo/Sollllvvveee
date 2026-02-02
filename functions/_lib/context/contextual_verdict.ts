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

    // Rule: Social Engineering Indicators (SMS, WhatsApp, Urgency)
    // Mobile vectors (SMS/WhatsApp) have higher click-through rates and smaller screens (less scrutiny),
    // so we treat them with higher baseline suspicion.
    if (source.includes('social_engineering') || source.includes('urgency') || source.includes('sms') || source.includes('whatsapp')) {
        if (originalVerdict === 'BENIGN') {
            result.adjusted_verdict = 'SUSPICIOUS';
            result.context_downgrade = true;
            result.context_notes.push('Downgraded due to high-risk delivery vector (SMS/Social Engineering)');
        }
    }

    // Rule: User Click (Active Interaction)
    // If a user explicitly clicked this (vs a passive scan), the risk of compromise is imminent.
    // We increase sensitivity to minor anomalies.
    if (source.includes('user_click')) {
        if (originalVerdict === 'BENIGN') {
            // We don't downgrade purely on click, but we add a note to be careful
            result.context_notes.push('User-initiated click: strict enforcement active');
        }
    }

    // Rule: Aggressive Redirects (Meta-Refresh, JS Redirects)
    if (source.includes('meta_refresh') || source.includes('js_redirect')) {
        if (originalVerdict === 'BENIGN') {
            result.adjusted_verdict = 'SUSPICIOUS';
            result.context_downgrade = true;
            result.context_notes.push('Downgraded due to aggressive client-side redirection');
        }
    }

    return result;
}

/**
 * Generates a map of verdicts for different hypothetical contexts.
 * Used to determine if the artifact's safety is highly context-dependent.
 */
export function generateContextualVerdicts(originalVerdict: RiskVerdict): Record<string, RiskVerdict> {
    const contexts = [
        'direct_visit',
        'email',
        'sms',
        'qr_scan',
        'social_media',
        'embedded_iframe',
        'url_shortener'
    ];

    const results: Record<string, RiskVerdict> = {};

    contexts.forEach(ctx => {
        // Map abstract contexts to strings that trigger logic in applyContextualVerdict
        let triggerString = ctx;
        if (ctx === 'qr_scan') triggerString = 'qr_scan_physical_access';
        if (ctx === 'social_media') triggerString = 'social_engineering'; // Treat as high risk vector
        if (ctx === 'url_shortener') triggerString = 'shortener';

        const res = applyContextualVerdict(originalVerdict, triggerString);
        results[ctx] = res.adjusted_verdict;
    });

    return results;
}

export function checkContextDivergence(verdicts: Record<string, RiskVerdict>): boolean {
    const values = Object.values(verdicts);
    // If we have both BENIGN and SUSPICIOUS/MALICIOUS, it diverges.
    const hasBenign = values.includes('BENIGN');
    const hasBad = values.includes('SUSPICIOUS') || values.includes('MALICIOUS');
    return hasBenign && hasBad;
}
