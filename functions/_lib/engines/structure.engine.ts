import { ArtifactType, FeatureResult } from '../types';
import { EngineResult } from './types';
import { CognitiveTraceStep } from '../cognitive_trace';
import { EngineFailureError } from '../errors';

function calculateEntropy(str: string): number {
    if (!str) return 0;
    const len = str.length;
    const frequencies = new Map<string, number>();
    for (const char of str) {
        frequencies.set(char, (frequencies.get(char) || 0) + 1);
    }
    let entropy = 0;
    for (const count of frequencies.values()) {
        const p = count / len;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

export function analyzeStructure(artifact: string, type: ArtifactType): EngineResult {
    const features: FeatureResult[] = [];
    const signals: string[] = [];
    const trace: CognitiveTraceStep[] = [];
    let score = 0;

    if (type === 'domain' || type === 'url') {
        let domain = artifact;
        if (type === 'url') {
            try {
                domain = new URL(artifact).hostname;
            } catch (e) {
                throw new EngineFailureError('structure', `Invalid URL: ${artifact}`);
            }
        }

        // Calculate entropy on the SLD (without TLD) if possible for better DGA detection
        // Simple heuristic: take everything before the last dot
        const lastDot = domain.lastIndexOf('.');
        const sld = lastDot > 0 ? domain.substring(0, lastDot) : domain;

        const entropy = calculateEntropy(sld);

        // High Entropy Threshold (approximate for DGA)
        // lowered to 3.8 based on typical DGA length/charset
        if (entropy > 3.8) {
            const id = 'structure_high_entropy';
            signals.push(id);
            features.push({
                id,
                tier: 'TIER_1_LOCAL',
                detected: true,
                riskContribution: 20,
                description: 'High entropy domain structure (random characters)',
                evidence: [`Entropy: ${entropy.toFixed(2)}`]
            });

            trace.push({
                engine: 'structure',
                observation: `Entropy: ${entropy.toFixed(2)}`,
                rationale: 'High entropy domain structure (random characters)',
                impact: 20,
                confidence: 0.85
            });

            score += 20;
        } else {
            // Low Entropy -> Safe Structure (Explicit Signal)
            const id = 'structure_entropy_verified';
            signals.push(id);
            features.push({
                id,
                tier: 'TIER_1_LOCAL',
                detected: true,
                riskContribution: 0,
                description: 'Domain structure appears natural (low entropy)',
                evidence: [`Entropy: ${entropy.toFixed(2)}`]
            });
             trace.push({
                engine: 'structure',
                observation: `Entropy: ${entropy.toFixed(2)}`,
                rationale: 'Domain structure appears natural (low entropy)',
                impact: 0,
                confidence: 0.85
            });
        }

        // Length Check
        if (domain.length > 50) {
            const id = 'structure_excessive_length';
            signals.push(id);
            features.push({
                id,
                tier: 'TIER_1_LOCAL',
                detected: true,
                riskContribution: 10,
                description: 'Excessive domain length',
                evidence: [`Length: ${domain.length}`]
            });

            trace.push({
                engine: 'structure',
                observation: `Length: ${domain.length}`,
                rationale: 'Excessive domain length',
                impact: 10,
                confidence: 0.85
            });

            score += 10;
        }
    }

    // Hash check
    if (type.startsWith('hash_')) {
        // Valid hash format is structural correctness, effectively benign until proven otherwise by reputation
        // But invalid length for declared type is suspicious
    }

    return {
        name: 'structure',
        confidence: 0.85, // Structural analysis is highly reliable
        score: Math.min(100, score),
        signals,
        features,
        trace
    };
}
