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
    try {
        // Call the worker
        const API_URL = import.meta.env.VITE_API_URL || '/analyze';
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artifact: input, forceRefresh: true })
        });

        if (!response.ok) {
            throw new Error(`Backend responded with ${response.status}`);
        }

        const data = await response.json();
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

        technicalSignals.push({ name: "Global Risk Score", value: `${result.riskScore}/100`, detected: result.riskScore > 0 });
        technicalSignals.push({ name: "AI Verification", value: result.summary.includes("Simulated") ? "SIMULATED" : "ACTIVE", detected: true });

        return {
            risk_level: riskLevel,
            primary_hypothesis: result.verdict === 'BENIGN' ? "Legitimate Activity" : (result.verdict === 'MALICIOUS' ? "Malicious Activity" : "Suspicious Activity"),
            summary: result.summary,
            uncertainty: {
                confidence_percentage: (result.confidence || 0.8) * 100,
                known_unknowns: ["External threat intel feeds limited in Dev Mode"],
                suggested_verification: result.explanation.recommendedActions || []
            },
            key_factors: factors,
            recommended_action: (result.explanation.recommendedActions && result.explanation.recommendedActions[0]) || "No action required.",
            technical_signals: technicalSignals
        };

    } catch (error) {
        console.error("Analysis Failed:", error);
        return {
            risk_level: 'Minimal',
            primary_hypothesis: "Analysis Service Unavailable",
            summary: "Could not connect to analysis backend. Please try again later.",
            uncertainty: { confidence_percentage: 0, known_unknowns: [], suggested_verification: [] },
            key_factors: [],
            recommended_action: "Retry later.",
            technical_signals: []
        };
    }
  }
}
