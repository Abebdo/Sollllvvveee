import { ClassificationResult, InputType, RiskAssessment, RiskLevel } from '../types';

/**
 * 2.2 Input Classification Algorithm
 */
export class InputClassifier {
  static classify(input: string): ClassificationResult {
    const scores: Record<InputType, number> = {
      url: 0, ip: 0, email: 0, hash: 0, domain: 0, file: 0, message: 0, ambiguous: 0
    };

    // Regex Patterns
    const patterns = {
      url: /^(?:https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i,
      ip: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      hash_md5: /^[a-f0-9]{32}$/i,
      hash_sha1: /^[a-f0-9]{40}$/i,
      hash_sha256: /^[a-f0-9]{64}$/i,
      domain: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i
    };

    if (patterns.url.test(input)) scores.url = 0.95;
    if (patterns.ip.test(input)) scores.ip = 0.95;
    if (patterns.email.test(input)) scores.email = 0.95;
    if (patterns.hash_md5.test(input) || patterns.hash_sha1.test(input) || patterns.hash_sha256.test(input)) scores.hash = 0.95;
    if (patterns.domain.test(input) && !patterns.email.test(input)) scores.domain = 0.85;

    // File check (Base64 or basic check - simplified for text input)
    if (input.startsWith('data:')) scores.file = 0.9;

    // Message fallback
    if (input.length > 20 && input.includes(' ')) scores.message = 0.6;

    // Find max
    let maxType: InputType = 'ambiguous';
    let maxScore = 0;

    (Object.keys(scores) as InputType[]).forEach(key => {
      if (scores[key] > maxScore) {
        maxScore = scores[key];
        maxType = key;
      }
    });

    if (maxScore < 0.5) {
      return { type: 'ambiguous', confidence: maxScore };
    }

    return { type: maxType, confidence: maxScore };
  }
}

/**
 * 4.1 Risk Engine (Backend Connected)
 */
export class RiskEngine {
  static async assess(input: string, type: InputType): Promise<RiskAssessment> {
    const API_URL = import.meta.env.VITE_API_URL || '/analyze';

    // Explicit Logging for Diagnostics
    console.log('[RiskEngine] Configuration:', {
        API_BASE_URL: import.meta.env.VITE_API_URL,
        RESOLVED_API_URL: API_URL
    });

    const MAX_RETRIES = 1;
    const TIMEOUT_MS = 10000;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            console.log(`[RiskEngine] Requesting analysis from: ${API_URL}`);
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artifact: input, forceRefresh: true }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            console.log(`[RiskEngine] Response status: ${response.status}`);

            if (!response.ok) {
                let errorMsg = `Backend responded with ${response.status}`;
                try {
                    const errorData = await response.json() as any;
                    if (errorData.message) {
                        errorMsg = errorData.message; // Use human readable message
                        if (errorData.error_code) {
                             errorMsg += ` (${errorData.error_code})`;
                        }
                    }
                } catch (e) {
                    // Ignore json parse error
                }
                throw new Error(errorMsg);
            }

            const data = await response.json() as any;
            const result = data.result;

            // Map AnalysisResult (Backend) to RiskAssessment (Frontend)
            let riskLevel: RiskLevel = 'Minimal';
            if (result.riskScore > 80) riskLevel = 'Critical';
            else if (result.riskScore > 60) riskLevel = 'High';
            else if (result.riskScore > 40) riskLevel = 'Medium';
            else if (result.riskScore > 20) riskLevel = 'Low';

            const factors = result.features ? Object.values(result.features).map((f: any) => ({
                description: f.description,
                direction: 'for' as const,
                confidence: 0.9
            })) : [];

            const technicalSignals = result.features ? Object.values(result.features).map((f: any) => ({
                 name: f.id,
                 value: f.detected ? 'DETECTED' : 'CLEAN',
                 detected: f.detected
            })) : [];

            if (result.root_trusted) {
                 technicalSignals.unshift({ name: "Domain Trust", value: "SAFE", detected: false });
            }

            technicalSignals.push({ name: "Global Risk Score", value: `${result.riskScore}/100`, detected: result.riskScore > 0 });
            technicalSignals.push({ name: "AI Verification", value: result.summary.includes("Simulated") ? "SIMULATED" : "ACTIVE", detected: true });

            const confidenceRange = result.confidence_range;
            const fragility = result.fragility;

            let primaryHypothesis = result.verdict === 'BENIGN' ? "Legitimate Activity" : (result.verdict === 'MALICIOUS' ? "Malicious Activity" : "Suspicious Activity");

            if (result.final_assessment === 'TRUSTED_SERVICE_ABUSED') {
                 primaryHypothesis = "Trusted Service – Suspicious Usage";
            } else if (result.final_assessment === 'MALICIOUS_SERVICE') {
                 primaryHypothesis = "Malicious Service";
            }

            return {
                status: 'SUCCESS',
                risk_level: riskLevel,
                primary_hypothesis: primaryHypothesis,
                summary: result.summary,
                uncertainty: {
                    confidence_percentage: confidenceRange ? Number((confidenceRange.mostLikely * 100).toFixed(0)) : Number((result.confidence || 0.8) * 100).toFixed(0) as unknown as number,
                    confidence_range: confidenceRange ? {
                        min: Number((confidenceRange.min * 100).toFixed(0)),
                        max: Number((confidenceRange.max * 100).toFixed(0)),
                        mostLikely: Number((confidenceRange.mostLikely * 100).toFixed(0)),
                        uncertainty: confidenceRange.uncertainty
                    } : undefined,
                    known_unknowns: result.uncertainty_flags || ["External threat intel feeds limited in Dev Mode"],
                    suggested_verification: result.explanation.recommendedActions || []
                },
                key_factors: factors,
                recommended_action: (result.explanation.recommendedActions && result.explanation.recommendedActions[0]) || "No action required.",
                technical_signals: technicalSignals,
                fragility: fragility ? {
                    level: fragility.level,
                    reasons: fragility.reasons
                } : undefined
            };

        } catch (error: any) {
            clearTimeout(timeoutId);

            // Differentiate errors
            let errorReason = "Network failure / Unknown";
            if (error.name === 'AbortError') errorReason = "Timeout";
            else if (error.message && error.message.includes('503')) errorReason = "Service Unavailable (503)";
            else if (error.message && error.message.includes('Failed to fetch')) errorReason = "Network Connection Failed";

            console.error(`Analysis Attempt ${attempt + 1} Failed: ${errorReason}`, error);

            if (attempt < MAX_RETRIES) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            // Log final failure with detail
            console.error('All analysis attempts failed', {
                timestamp: new Date().toISOString(),
                endpoint: API_URL,
                reason: errorReason,
                original_error: error.message
            });

            return {
                status: 'NO_ANALYSIS',
                risk_level: 'Minimal',
                primary_hypothesis: `Analysis Unreachable (${errorReason})`,
                summary: `The analysis engine could not be reached due to: ${errorReason}. No judgment was made.`,
                uncertainty: { confidence_percentage: null, known_unknowns: [], suggested_verification: [] },
                key_factors: [],
                recommended_action: "Please check your connection or try again later.",
                technical_signals: []
            };
        }
    }

    // Fallback if loop exits weirdly
    return {
        status: 'NO_ANALYSIS',
        risk_level: 'Minimal',
        primary_hypothesis: "Analysis Failed",
        summary: "Unexpected system error.",
        uncertainty: { confidence_percentage: null, known_unknowns: [], suggested_verification: [] },
        key_factors: [],
        recommended_action: "Retry",
        technical_signals: []
    };
  }
}
