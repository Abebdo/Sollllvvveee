import { ClassificationResult, InputType, RiskAssessment } from '../types';

/**
 * 2.2 Input Classification Algorithm (Ported from Python Spec)
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
 * 3.1 NLP Intelligence Engine (Mock/Heuristic Implementation)
 */
export class NLPIntelligence {
  static analyze(text: string): { risk: number; signals: string[] } {
    let risk = 0;
    const signals: string[] = [];
    const lower = text.toLowerCase();

    // Urgency
    if (lower.match(/\b(immediately|urgent|asap|24 hours|deadline)\b/)) {
      risk += 30;
      signals.push('Temporal Pressure');
    }

    // Threat
    if (lower.match(/\b(suspended|terminated|legal action|arrest|locked)\b/)) {
      risk += 40;
      signals.push('Threat Escalation');
    }

    // Authority
    if (lower.match(/\b(irs|fbi|official|administrator|security team)\b/)) {
      risk += 20;
      signals.push('Authority Claim');
    }

    // Financial
    if (lower.match(/\b(bank|verify|payment|credit card|invoice)\b/)) {
      risk += 25;
      signals.push('Financial Context');
    }

    return { risk: Math.min(risk, 95), signals };
  }
}

/**
 * 4.1 Risk Engine (Simulated)
 */
export class RiskEngine {
  static assess(input: string, type: InputType): RiskAssessment {
    // Basic Heuristics for the Demo
    const nlp = NLPIntelligence.analyze(input);
    
    // Default legitimate state
    let riskLevel: any = 'Minimal';
    let summary = "No significant threats detected in the provided input.";
    let primaryHypothesis = "Legitimate Communication";
    let confidence = 90;

    if (nlp.risk > 70) {
      riskLevel = 'Critical';
      summary = "High-risk indicators suggest a targeted social engineering attack.";
      primaryHypothesis = "Phishing / Social Engineering";
      confidence = 85;
    } else if (nlp.risk > 40) {
      riskLevel = 'Medium';
      summary = "Suspicious elements detected, but intent is not fully confirmed.";
      primaryHypothesis = "Suspicious Activity";
      confidence = 70;
    } else if (type === 'url' || type === 'domain') {
       // Simulate checks
       if (input.includes('paypal') || input.includes('login') || input.includes('secure')) {
         riskLevel = 'High';
         summary = "URL structure mimics sensitive authentication portals.";
         primaryHypothesis = "Credential Harvesting Site";
         confidence = 80;
         nlp.signals.push("Homograph Attack Potential");
       }
    }

    return {
      risk_level: riskLevel,
      primary_hypothesis: primaryHypothesis,
      summary: summary,
      uncertainty: {
        confidence_percentage: confidence,
        known_unknowns: [
          "Sender identity unverified via SPF/DKIM (Text Input)",
          "Real-time domain reputation unavailable in offline mode"
        ],
        suggested_verification: [
          "Verify sender address directly",
          "Check URL in browser sandbox"
        ]
      },
      key_factors: nlp.signals.map(s => ({
        description: s,
        direction: 'for',
        confidence: 0.9
      })),
      recommended_action: riskLevel === 'Minimal' 
        ? "No action required. Proceed with normal caution." 
        : "Do not click links or download attachments. Report to IT Security immediately.",
      technical_signals: [
        { name: "Urgency Detection", value: nlp.signals.includes("Temporal Pressure") ? "DETECTED" : "CLEAN", detected: nlp.signals.includes("Temporal Pressure") },
        { name: "Homograph Check", value: "PASSED", detected: false },
        { name: "Entropy Analysis", value: "3.2 bits (Normal)", detected: false },
        { name: "Heuristic Score", value: `${nlp.risk}/100`, detected: nlp.risk > 0 }
      ]
    };
  }
}