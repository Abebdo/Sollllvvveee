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
    const API_URL = '/analyze';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifact: input, forceRefresh: true })
      });

      if (!response.ok) {
         throw new Error(`Analysis failed with status ${response.status}`);
      }

      const wrapper = await response.json() as any;
      const data = wrapper.data;

      // Map Verdict to RiskLevel
      let riskLevel: RiskLevel = 'Minimal';
      if (data.verdict === 'MALICIOUS') riskLevel = 'Critical';
      else if (data.verdict === 'SUSPICIOUS') riskLevel = 'High';
      else if (data.riskScore > 30) riskLevel = 'Medium';
      else if (data.riskScore > 10) riskLevel = 'Low';

      return {
        status: 'SUCCESS',
        risk_level: riskLevel,
        primary_hypothesis: data.explanation?.summary || data.summary || "Analysis completed",
        summary: data.analyst_insight?.guidance || data.summary || "No summary available",
        uncertainty: {
          confidence_percentage: data.confidence ? Math.round(data.confidence * 100) : null,
          confidence_range: data.confidence_range,
          known_unknowns: data.epistemic_profile?.uncertainty_sources || [],
          suggested_verification: []
        },
        key_factors: (data.why_it_matters || []).map((desc: string) => ({
            description: desc,
            direction: 'neutral',
            confidence: 1.0
        })),
        recommended_action: data.analyst_insight?.analyst_recommendation || data.explanation?.recommendedActions?.[0] || "Review details",
        technical_signals: (data.signals || []).map((sig: string) => ({
            name: "Signal",
            value: sig,
            detected: true
        })),
        fragility: data.fragility
      };

    } catch (error) {
      console.error("RiskEngine error:", error);
      return {
        status: 'ERROR',
        risk_level: 'Minimal',
        primary_hypothesis: 'Analysis Failed',
        summary: error instanceof Error ? error.message : 'Unknown error',
        uncertainty: { confidence_percentage: null, known_unknowns: [], suggested_verification: [] },
        key_factors: [],
        recommended_action: 'Retry',
        technical_signals: []
      };
    }
  }
}
