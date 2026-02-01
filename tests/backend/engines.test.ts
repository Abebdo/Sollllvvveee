import { describe, it, expect } from 'vitest';
import { analyzeStructure } from '../../functions/_lib/engines/structure.engine';
import { analyzeReputation } from '../../functions/_lib/engines/reputation.engine';
import { analyzeContext } from '../../functions/_lib/engines/context.engine';

describe('Structure Engine', () => {
    it('should detect high entropy domain (DGA-like)', () => {
        // High entropy string: random chars
        const result = analyzeStructure('x8z29a1b9c8d7e6f5.com', 'domain');
        expect(result.signals).toContain('structure_high_entropy');
        expect(result.score).toBeGreaterThan(0);
    });

    it('should return low score for normal domain', () => {
        const result = analyzeStructure('google.com', 'domain');
        expect(result.score).toBe(0);
    });

    it('should be deterministic', () => {
        const input = 'random-structure.com';
        const r1 = analyzeStructure(input, 'domain');
        const r2 = analyzeStructure(input, 'domain');
        expect(r1.score).toBe(r2.score);
    });
});

describe('Reputation Engine', () => {
    it('should identify safe domains', () => {
        const result = analyzeReputation('google.com', 'domain');
        expect(result.signals).toContain('reputation_allowlist');
        expect(result.score).toBe(0);
        expect(result.confidence).toBe(1.0);
    });

    it('should identify malicious patterns', () => {
        const result = analyzeReputation('fake-crypto-wallet.com', 'domain');
        // Assuming pattern match for 'crypto' or similar
        // My malicious patterns list: 'malware', 'phishing', 'virus', 'exploit', 'betting', 'casino-fake'
        // Let's use one of those
        const result2 = analyzeReputation('my-virus-download.com', 'domain');
        expect(result2.signals).toContain('reputation_blocklist_pattern');
        expect(result2.score).toBeGreaterThan(80);
    });
});

describe('Context Engine', () => {
    it('should flag private IPs', () => {
        const result = analyzeContext('192.168.1.50', 'ipv4');
        expect(result.signals).toContain('context_private_ip');
    });

    it('should flag suspicious email user parts', () => {
        const result = analyzeContext('user+hack@example.com', 'email');
        expect(result.signals).toContain('context_email_complexity');
    });
});
