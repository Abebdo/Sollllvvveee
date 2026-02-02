import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAnalysisRequest } from '../../functions/_lib/orchestrator';
import { analyzeReputation, analyzeStructure, analyzeHeuristic, analyzeBaseline, analyzeContext } from '../../functions/_lib/engines';
import { analyzeSemantic } from '../../functions/_lib/engines/semantic.engine';

// Mock Env
class MockKV {
    store: Record<string, string> = {};
    async get(key: string) { return this.store[key] || null; }
    async put(key: string, value: string) { this.store[key] = value; }
}

const mockEnv = {
    ANALYSIS_CACHE: new MockKV(),
    AI: {}
} as any;

const mockRequest = (body: any) => {
    return {
        method: 'POST',
        headers: {
            get: (key: string) => {
                if(key==='CF-Connecting-IP') return '1.2.3.4';
                if(key==='User-Agent') return 'test-ua';
                return null;
            }
        },
        json: async () => body
    } as unknown as Request;
};

// Mock Engines barrel
vi.mock('../../functions/_lib/engines', async () => {
    const actual = await vi.importActual('../../functions/_lib/engines');
    return {
        ...actual as any,
        analyzeReputation: vi.fn(),
        analyzeStructure: vi.fn(),
        analyzeHeuristic: vi.fn(),
        analyzeBaseline: vi.fn(),
        analyzeContext: vi.fn(),
    };
});

// Mock Semantic Engine specific file
vi.mock('../../functions/_lib/engines/semantic.engine', async () => {
    return {
        analyzeSemantic: vi.fn()
    };
});

describe('Final Intelligence Upgrade', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock Global Fetch
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            url: '',
            text: async () => ''
        });

        // Setup default benign responses
        (analyzeReputation as any).mockResolvedValue({ name: 'reputation', score: 0, confidence: 1.0 });
        (analyzeSemantic as any).mockResolvedValue({ name: 'semantic', score: 0, confidence: 0.5 });
        (analyzeStructure as any).mockResolvedValue({ name: 'structure', score: 0, confidence: 0.8 });
        (analyzeHeuristic as any).mockResolvedValue({ name: 'heuristic', score: 0, confidence: 0.6 });
        (analyzeBaseline as any).mockResolvedValue({ name: 'baseline', score: 0, confidence: 0.5 });
        (analyzeContext as any).mockResolvedValue({ name: 'context', score: 0, confidence: 0.5, context_downgrade: false, adjusted_verdict: 'BENIGN' });
    });

    it('should detect Conflict: High Reputation vs Malicious Intent', async () => {
        (analyzeReputation as any).mockResolvedValue({
            name: 'reputation', score: 0, confidence: 1.0, summary: 'Highly Trusted'
        });
        (analyzeSemantic as any).mockResolvedValue({
            name: 'semantic', score: 80, confidence: 0.9, summary: 'Credential harvesting detected',
            semantic_intent: { intent: 'MALICIOUS' }
        });

        const req = mockRequest({ artifact: 'https://docs.google.com/evil' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.conflict_resolution).toBeDefined();
        expect(result.conflict_resolution.conflict_detected).toBe(true);
        expect(result.conflict_resolution.winning_signal).toBe('INTENT');
        expect(['SUSPICIOUS', 'MALICIOUS']).toContain(result.verdict);
        expect(result.analyst_flags.reputation_abuse).toBe(true);
    });

    it('should generate Analyst Insight', async () => {
        (analyzeReputation as any).mockResolvedValue({
            name: 'reputation', score: 0, confidence: 1.0, summary: 'Highly Trusted'
        });
        (analyzeSemantic as any).mockResolvedValue({
            name: 'semantic', score: 80, confidence: 0.9, summary: 'Credential harvesting detected',
            semantic_intent: { intent: 'MALICIOUS' }
        });

        const req = mockRequest({ artifact: 'https://docs.google.com/evil' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.analyst_insight).toBeDefined();
        expect(result.analyst_insight.analyst_summary).toContain('Although the domain carries a reputable history');
        expect(result.explanation.summary).toBe(result.analyst_insight.analyst_summary);
    });

    it('should kill absolute trust (downgrade benign to suspicious if intent is bad)', async () => {
        (analyzeReputation as any).mockResolvedValue({ name: 'reputation', score: 0, confidence: 1.0 });
        (analyzeSemantic as any).mockResolvedValue({
            name: 'semantic', score: 40, confidence: 0.8,
            semantic_intent: { intent: 'MALICIOUS' }
        });

        const req = mockRequest({ artifact: 'https://trustme.com/login' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.verdict).toBe('SUSPICIOUS');
        expect(result.riskScore).toBeGreaterThanOrEqual(55);
    });

    it('should expand URL shortener and analyze target', async () => {
        // Mock fetch to simulate redirect
        (global.fetch as any).mockResolvedValue({
            ok: true,
            url: 'https://expanded-evil.com', // The Fetch API returns the final URL property
            text: async () => ''
        });

        const req = mockRequest({ artifact: 'https://bit.ly/evil' });
        await handleAnalysisRequest(req, mockEnv);

        // Check if analyzeReputation was called with the expanded URL
        // sanitizeInput will lower case it
        expect(analyzeReputation).toHaveBeenCalledWith(expect.stringContaining('expanded-evil.com'), expect.anything());
    });

    it('should detect Subdomain Abuse (google.com.evil.com)', async () => {
        // We assume heuristic engine has logic for this. We mock it here to verify orchestrator flow.
        (analyzeHeuristic as any).mockResolvedValue({
            name: 'heuristic',
            score: 60,
            confidence: 0.9,
            features: [{ id: 'subdomain_abuse', description: 'Detected google...', tier: 'TIER_1_LOCAL', detected: true, riskContribution: 60, evidence: [] }],
            summary: 'Subdomain abuse detected'
        });
        (analyzeReputation as any).mockResolvedValue({ name: 'reputation', score: 0, confidence: 1.0 });

        const req = mockRequest({ artifact: 'https://google.com.evil.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data;

        expect(result.verdict).not.toBe('BENIGN');
        expect(result.riskScore).toBeGreaterThanOrEqual(50);
        // Ensure features from engine are aggregated
        expect(result.features['subdomain_abuse']).toBeDefined();
    });
});
