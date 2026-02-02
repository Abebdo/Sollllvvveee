import { EngineResult } from '../engines/types';
import { ConflictResolution, RiskVerdict, AnalystInsight, FragilityResult, ConfidenceRange, FinalAssessment, UserImpact, UserGuidance } from '../types';
import { ArtifactClass } from '../context/artifact_classifier';

export function generateAnalystExplanation(
    results: EngineResult[],
    conflict: ConflictResolution,
    verdict: RiskVerdict,
    riskScore: number,
    fragility: FragilityResult,
    confidenceRange: ConfidenceRange,
    rootTrusted: boolean = false,
    finalAssessment?: FinalAssessment,
    artifactClass?: ArtifactClass
): AnalystInsight {

    // 1. Gather Signals
    const positiveSignals = results.filter(r => r.score < 20 && r.confidence > 0.5).map(r => r.summary || `${r.name} indicates safety`).filter(Boolean);
    const negativeSignals = results.filter(r => r.score >= 40).map(r => r.summary || `${r.name} detected risks`).filter(Boolean);

    // Infrastructure Root Handling
    if (artifactClass === 'INFRASTRUCTURE_ROOT') {
        return {
            analyst_summary: "This domain is a globally trusted infrastructure root. Content-level threat analysis is not applicable at this level.",
            analyst_takeaways: ["Infrastructure Trust Confirmed", "No content-level analysis performed"],
            analyst_recommendation: "Proceed with standard caution. Infrastructure is verified.",
            user_impact: {
                worst_case: "None expected from direct access.",
                likelihood: "LOW",
                what_to_do: "Safe to proceed."
            },
            user_guidance: {
                immediate_action: "None required.",
                verification_steps: []
            }
        };
    }

    const semantic = results.find(r => r.name === 'semantic');
    const reputation = results.find(r => r.name === 'reputation');

    const isTrusted = reputation && reputation.score < 10;
    const hasRisk = negativeSignals.length > 0;

    // 2. Construct Summary (Contrastive Reasoning & Legitimacy Language)
    let summary = '';
    let userImpact: UserImpact;
    let userGuidance: UserGuidance;

    // Special Case: Trusted Service Abuse (Root Trust Immunity)
    if (rootTrusted && finalAssessment === 'TRUSTED_SERVICE_ABUSED') {
         summary = `This domain is a globally trusted service (Google/Microsoft/etc.). However, attackers frequently abuse trusted platforms to host malicious content. This specific link exhibits patterns of abuse (e.g., phishing or fake login). Therefore, we classify this as Trusted Service Abuse.`;
         userImpact = {
             worst_case: "Credential theft or malware download via trusted form.",
             likelihood: "HIGH",
             what_to_do: "Do not enter credentials even if the site looks real."
         };
         userGuidance = {
             immediate_action: "Close the page. Do not log in.",
             verification_steps: ["Check the sender of the link.", "Navigate to the service manually."]
         };
    }
    // "Although..., however..., therefore..."
    else if (conflict.conflict_detected) {
        // Conflict Scenario
        if (conflict.winning_signal === 'INTENT') {
             summary = `Although the domain carries a reputable history, malicious intent was detected in the content. Because explicit risk indicators outweigh historical reputation, we assess this as ${verdict}.`;
        } else {
             summary = `Although conflicting signals were detected, the dominant risk factors suggest potential danger. We assess this as ${verdict} with moderate confidence.`;
        }

        userImpact = {
            worst_case: "Potential phishing or scam exposure.",
            likelihood: "MEDIUM",
            what_to_do: "Verify the source before proceeding."
        };
        userGuidance = {
            immediate_action: "Pause and verify.",
            verification_steps: ["Contact the sender via a different channel."]
        };

    } else if (isTrusted && hasRisk) {
        // Mixed Signals
        summary = `Although the domain has a trusted history, recent behavioral anomalies were detected. Because behavioral shifts often indicate compromise, the verdict is ${verdict}.`;
        userImpact = {
            worst_case: "Interacting with a compromised legitimate site.",
            likelihood: "MEDIUM",
            what_to_do: "Exercise caution."
        };
        userGuidance = {
             immediate_action: "Proceed with caution.",
             verification_steps: ["Ensure you are on the correct path/subdomain."]
        };
    } else if (verdict === 'MALICIOUS') {
        // Clear Malicious
        const reason = negativeSignals[0] ? negativeSignals[0].toLowerCase() : 'multiple risk indicators were found';
        summary = `Primary analysis detected high-risk signals. Specifically, ${reason}. Therefore, we assess this artifact as MALICIOUS.`;
        userImpact = {
            worst_case: "Identity theft, financial loss, or malware infection.",
            likelihood: "HIGH",
            what_to_do: "Block immediately."
        };
        userGuidance = {
            immediate_action: "Do not click. Block this domain.",
            verification_steps: []
        };
    } else if (verdict === 'SUSPICIOUS') {
        // Suspicious
        const reason = negativeSignals[0] ? negativeSignals[0].toLowerCase() : 'anomalous patterns were observed';
        summary = `Although no definitive malicious payload was confirmed, ${reason}. Therefore, we classify this as SUSPICIOUS.`;
        userImpact = {
            worst_case: "Potential exposure to scam or low-grade malware.",
            likelihood: "MEDIUM",
            what_to_do: "Avoid if possible."
        };
        userGuidance = {
            immediate_action: "Verify source independently.",
            verification_steps: ["Do not enter sensitive information."]
        };
    } else {
        // Benign
        // Ensure uncertainty is communicated if needed
        if (fragility.level !== 'LOW' || confidenceRange.uncertainty !== 'LOW') {
             summary = `Analysis detected no active threats. Although legitimate patterns are dominant, ${fragility.reasons[0] ? fragility.reasons[0].toLowerCase() : 'visibility is limited'}. Therefore, we assess this as LIKELY LEGITIMATE but advise standard caution.`;
        } else {
             summary = `Analysis detected no active threats. Multiple engines confirm legitimate patterns. Therefore, we assess this as LEGITIMATE.`;
        }

        userImpact = {
            worst_case: "Low risk of adverse outcome.",
            likelihood: "LOW",
            what_to_do: "Proceed normally."
        };
        userGuidance = {
            immediate_action: "Proceed.",
            verification_steps: []
        };
    }

    // 3. Add Fragility Context & Epistemic Honesty (Why we might be wrong)
    if (fragility.level === 'HIGH') {
        summary += ` This conclusion is FRAGILE due to ${fragility.reasons[0] ? fragility.reasons[0].toLowerCase() : 'limited visibility'}.`;
    } else if (fragility.level === 'MEDIUM') {
        summary += ` This conclusion has MODERATE stability due to ${fragility.reasons[0] ? fragility.reasons[0].toLowerCase() : 'partial data coverage'}.`;
    }

    // Explicitly state what could change the verdict (Counterfactual)
    if (confidenceRange.uncertainty !== 'LOW') {
        if (verdict === 'BENIGN') {
             summary += ` A shift in behavioral patterns or detection of credential-harvesting intent would immediately escalate this to MALICIOUS.`;
        } else if (verdict === 'MALICIOUS') {
             summary += ` Verification of ownership or removal of the flagged content would require a re-assessment.`;
        }
    }

    // 4. Takeaways
    const takeaways: string[] = [];
    if (conflict.conflict_detected) takeaways.push(`Conflict: ${conflict.primary_conflict}`);
    takeaways.push(...negativeSignals.slice(0, 3));
    if (takeaways.length === 0) {
         takeaways.push(...positiveSignals.slice(0, 3));
    }
    if (fragility.level === 'HIGH') takeaways.push(`Fragility: High (${fragility.reasons.join(', ')})`);

    // 5. Recommendation
    let recommendation = '';
    if (verdict === 'MALICIOUS') recommendation = 'Block immediately. Do not interact.';
    else if (verdict === 'SUSPICIOUS') recommendation = 'Treat with extreme caution. Verify source independently via a different channel.';
    else recommendation = 'Proceed with standard caution. No immediate threats detected.';

    return {
        analyst_summary: summary,
        analyst_takeaways: takeaways,
        analyst_recommendation: recommendation,
        user_impact: userImpact,
        user_guidance: userGuidance
    };
}
