import { describe, it, expect } from 'vitest';
import { analyzeHeuristic } from '../../functions/_lib/engines/heuristic';
import { analyzeReputation } from '../../functions/_lib/engines/reputation.engine';
import { analyzeStructure } from '../../functions/_lib/engines/structure.engine';
import { analyzeContext } from '../../functions/_lib/engines/context.engine';

describe('Cognitive Trace Engine', () => {
    it('should generate traces for reputation allowlist', async () => {
        const result = analyzeReputation('google.com', 'domain');
        expect(result.trace).toBeDefined();
        expect(result.trace!.length).toBeGreaterThan(0);
        expect(result.trace![0].engine).toBe('reputation');
        expect(result.trace![0].observation).toBe('google.com');
        expect(result.trace![0].impact).toBe(-100);
    });

    it('should generate traces for heuristic matches', async () => {
        const result = analyzeHeuristic('urgent-login-verify.com', 'domain');
        expect(result.trace).toBeDefined();
        // Should match keywords 'urgent', 'login', 'verify'
        expect(result.trace!.length).toBeGreaterThan(0);
        const trace = result.trace![0];
        expect(trace.engine).toBe('heuristic');
        expect(trace.confidence).toBe(0.9);
    });

    it('should generate traces for structure analysis', async () => {
        const result = analyzeStructure('super-long-domain-name-that-is-way-too-long-to-be-normal-and-might-be-suspicious.com', 'domain');
        expect(result.trace).toBeDefined();
        expect(result.trace!.some(t => t.observation.includes('Length:'))).toBe(true);
    });

    it('should generate traces for context analysis (private IP)', async () => {
        const result = analyzeContext('192.168.1.1', 'ipv4');
        expect(result.trace).toBeDefined();
        expect(result.trace!.length).toBeGreaterThan(0);
        expect(result.trace![0].engine).toBe('context');
        expect(result.trace![0].rationale).toContain('Private IP');
    });
});
