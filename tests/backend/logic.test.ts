import { describe, it, expect } from 'vitest';
import { validateInput, classifyArtifact } from '../../functions/_lib/validation';
import { analyzeHeuristic } from '../../functions/_lib/engines/heuristic';

describe('Validation Logic', () => {
    it('should validate correct input', () => {
        const result = validateInput('https://google.com');
        expect(result.valid).toBe(true);
    });

    it('should reject empty input', () => {
        const result = validateInput('');
        expect(result.valid).toBe(false);
    });

    it('should reject overly long input', () => {
        const long = 'a'.repeat(2050);
        const result = validateInput(long);
        expect(result.valid).toBe(false);
    });
});

describe('Artifact Classification', () => {
    it('should classify URL', () => {
        expect(classifyArtifact('https://example.com')).toBe('url');
    });
    it('should classify IP', () => {
        expect(classifyArtifact('1.1.1.1')).toBe('ipv4');
    });
    it('should classify Email', () => {
        expect(classifyArtifact('test@example.com')).toBe('email');
    });
});

describe('Heuristic Engine', () => {
    it('should detect phishing keywords', () => {
        const result = analyzeHeuristic('http://secure-login-update.com', 'url');
        expect(result.score).toBeGreaterThan(0);
        expect(result.features['credential_targeting']).toBeDefined();
    });

    it('should be deterministic', () => {
        const input = 'http://test-site.xyz';
        const result1 = analyzeHeuristic(input, 'url');
        const result2 = analyzeHeuristic(input, 'url');
        expect(result1.score).toBe(result2.score);
        expect(result1.summary).toBe(result2.summary);
    });

    it('should return benign for harmless input', () => {
        const result = analyzeHeuristic('https://example.com', 'url');
        expect(result.score).toBe(0);
    });
});
