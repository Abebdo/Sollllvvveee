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
    const API_URL = '/analyze'; // Hardcoded relative path

    console.log('[RiskEngine] Configuration:', {
        RESOLVED_API_URL: API_URL
    });

    try {
        console.log(`[RiskEngine] Requesting analysis from: ${API_URL}`);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artifact: input, forceRefresh: true })
        });

        console.log(`[RiskEngine] Response status: ${response.status}`);

        if (!response.ok) {
            console.error(`Backend failed with status ${response.status}`);
            // Return ERROR status so UI can handle it (e.g. show error message)
            // DO NOT fabricate a success result.
            return {
                status: 'ERROR',
                risk_level: 'Medium', // Fallback risk level for type safety, but status is ERROR
                primary_hypothesis: 'Analysis Failed',
                summary: `System returned error: ${response.status}`,
                uncertainty: {
                    confidence_percentage: null,
                    known_unknowns: [],
                    suggested_verification: []
                },
                key_factors: [],
                recommended_action: 'Retry later',
                technical_signals: []
            };
        }

        const json = await response.json() as any;
        const data = json.data || json; // Handle wrapped or unwrapped response

        // Map Backend AnalysisResult to Frontend RiskAssessment
        let risk_level: RiskLevel = 'Medium';
        if (data.verdict === 'MALICIOUS') risk_level = 'High';
        else if (data.verdict === 'SUSPICIOUS') risk_level = 'Medium';
        else if (data.verdict === 'BENIGN') risk_level = 'Low';

        if (data.final_assessment === 'TRUSTED_SERVICE_ABUSED') risk_level = 'High';
        if (data.final_assessment === 'MALICIOUS_SERVICE') risk_level = 'Critical';

        const key_factors = (data.why_it_matters || []).map((f: string) => ({
            description: f,
            direction: (risk_level === 'High' || risk_level === 'Critical' || risk_level === 'Medium') ? 'against' : 'for',
            confidence: data.confidence || 0.8
        }));

        const technical_signals = (data.signals || []).map((s: string) => ({
            name: 'Signal',
            value: s,
            detected: true
        }));

        return {
            status: 'SUCCESS',
            risk_level,
            primary_hypothesis: data.summary || 'Analysis Completed',
            summary: data.analyst_insight?.analyst_summary || data.summary || 'No summary provided',
            uncertainty: {
                confidence_percentage: (data.confidence || 0) * 100,
                confidence_range: data.confidence_range,
                known_unknowns: data.epistemic_profile?.uncertainty_sources || [],
                suggested_verification: []
            },
            key_factors,
            recommended_action: data.analyst_insight?.analyst_recommendation || 'Review details',
            technical_signals,
            fragility: data.fragility
        };

    } catch (error: any) {
        console.error(`Analysis Failed:`, error);

        // Return ERROR status on network failure
        return {
            status: 'ERROR',
            risk_level: 'Medium',
            primary_hypothesis: 'Network Error',
            summary: error.message || 'Failed to connect to analysis engine',
            uncertainty: {
                confidence_percentage: null,
                known_unknowns: [],
                suggested_verification: []
            },
            key_factors: [],
            recommended_action: 'Check connection and retry',
            technical_signals: []
        };
    }
  }
}
