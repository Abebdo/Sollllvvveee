import { EngineFunction, EngineResult, Signal, Verification } from '../engine_contract';

export const analyzeContext: EngineFunction = async (artifact, type, context) => {
    const signals: Signal[] = [];
    const verification: Verification[] = [];

    // Verification
    verification.push({
        check: 'context_evaluation',
        status: 'PASS',
        evidence: { context_provided: !!context },
        timestamp: new Date().toISOString()
    });

    if (!context || !context.source) {
        return {
            engine: 'context',
            executed: true,
            signals: [],
            verification,
            confidenceImpact: 0.1, // No context = low confidence contribution
            metadata: { message: 'No context provided' }
        };
    }

    // Risk: Email + Executable/Archive
    if (context.source === 'email') {
        if (artifact.endsWith('.exe') || artifact.endsWith('.zip')) {
            signals.push({
                id: 'high_risk_email_attachment',
                name: 'High Risk Email Attachment',
                severity: 'HIGH',
                score_contribution: 75,
                description: 'Executable or archive file linked from an email.'
            });
        }
    }

    // Risk: SMS + Shortener
    if (context.source === 'sms') {
        const shorteners = ['bit.ly', 'goo.gl', 't.co', 'tinyurl.com'];
        if (shorteners.some(s => artifact.toLowerCase().includes(s))) {
             signals.push({
                id: 'sms_shortener',
                name: 'SMS URL Shortener',
                severity: 'MEDIUM',
                score_contribution: 60,
                description: 'SMS contains a shortened URL, a common smishing pattern.'
            });
        }
    }

    return {
        engine: 'context',
        executed: true,
        signals,
        verification,
        confidenceImpact: 0.5,
        metadata: { source: context.source }
    };
};
