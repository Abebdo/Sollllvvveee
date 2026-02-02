import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleAnalysisRequest } from '../../functions/_lib/orchestrator';
import * as engines from '../../functions/_lib/engines';
import * as semanticEngine from '../../functions/_lib/engines/semantic.engine';
import * as memory from '../../functions/_lib/memory/analytical_memory';
import * as temporal from '../../functions/_lib/temporal';
import { AnalysisRequest } from '../../functions/_lib/types';

// Mock engines
vi.mock('../../functions/_lib/engines', async () => {
    const actual = await vi.importActual('../../functions/_lib/engines');
    return {
        ...actual,
        analyzeReputation: vi.fn(),
        analyzeStructure: vi.fn(),
        analyzeContext: vi.fn(),
        analyzeHeuristic: vi.fn(),
        analyzeBaseline: vi.fn(),
        analyzeMetaJudgment: (await vi.importActual('../../functions/_lib/engines/meta_judgment.engine.ts')).analyzeMetaJudgment,
        analyzeRootTrust: (await vi.importActual('../../functions/_lib/engines/root_trust.engine.ts')).analyzeRootTrust
    };
});

vi.mock('../../functions/_lib/engines/semantic.engine', () => ({
    analyzeSemantic: vi.fn()
}));

vi.mock('../../functions/_lib/memory/analytical_memory', () => ({
    consultMemory: vi.fn(),
    updateMemory: vi.fn(),
    consultCampaignMemory: vi.fn(),
    updateCampaignMemory: vi.fn()
}));

vi.mock('../../functions/_lib/temporal', () => ({
    analyzeTemporal: vi.fn()
}));

// Mock Env
const mockEnv = {
    ANALYSIS_CACHE: {
        get: vi.fn(),
        put: vi.fn().mockResolvedValue(undefined)
    },
    AI: {
        run: vi.fn()
    }
} as any;

function createRequest(artifact: string): Request {
    const body: AnalysisRequest = { artifact, forceRefresh: true };
    return new Request('http://localhost/analyze', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    });
}

// Default engine responses
const defaultSafe = { score: 0, confidence: 0.9, summary: 'Safe' };
const defaultNeutral = { score: 10, confidence: 0.5, summary: 'Neutral' };

describe('Master Acceptance Tests - Solveya', () => {

    beforeEach(() => {
        vi.clearAllMocks();

        // Default Memory
        (memory.consultMemory as any).mockResolvedValue({ seen_count: 5, history_scores: [0, 0], volatility: 0 });
        (memory.consultCampaignMemory as any).mockResolvedValue({ campaign_id: null, confidence: 0 });
        (temporal.analyzeTemporal as any).mockResolvedValue({});

        // Default Engines
        (engines.analyzeReputation as any).mockResolvedValue({ ...defaultSafe, name: 'reputation', confidence: 0.9 });
        (engines.analyzeStructure as any).mockResolvedValue({ ...defaultSafe, name: 'structure' });
        (engines.analyzeContext as any).mockResolvedValue({ ...defaultSafe, name: 'context' });
        (engines.analyzeHeuristic as any).mockResolvedValue({ ...defaultSafe, name: 'heuristic' });
        (engines.analyzeBaseline as any).mockResolvedValue({ ...defaultSafe, name: 'baseline' });
        (semanticEngine.analyzeSemantic as any).mockResolvedValue({
            ...defaultSafe,
            name: 'semantic',
            semantic_intent: { intent: 'BENIGN', confidence: 0.9 }
        });
    });

    it('Scenario 1: google.com (Reality Anchor) -> LEGITIMATE', async () => {
        const req = createRequest('google.com');

        // Mocks for Google (All engines return safe)
        (engines.analyzeReputation as any).mockResolvedValue({ ...defaultSafe, score: 0, confidence: 0.99, signals: ['safe_list'], name: 'reputation' });

        const res = await handleAnalysisRequest(req, mockEnv);
        const json = await res.json() as any;
        const result = json.result;

        expect(result.verdict).toBe('BENIGN');
        expect(result.root_trusted).toBe(true);
        expect(result.final_assessment).toBe('SAFE');
        expect(result.riskScore).toBe(0); // Forced 0
        expect(result.confidence).toBeGreaterThanOrEqual(0.85); // Legitimate range
        expect(result.summary).toMatch(/Reality Anchor|infrastructure root/);
    });

    it('Scenario 2: apple.com (Reality Anchor) -> LEGITIMATE', async () => {
        const req = createRequest('apple.com');
        const res = await handleAnalysisRequest(req, mockEnv);
        const json = await res.json() as any;
        const result = json.result;

        expect(result.verdict).toBe('BENIGN');
        expect(result.root_trusted).toBe(true);
    });

    it('Scenario 3: paypal-homograph.com (Malicious) -> MALICIOUS', async () => {
        // Mock Heuristics detecting homograph
        (engines.analyzeHeuristic as any).mockResolvedValue({
            score: 90,
            confidence: 0.9,
            name: 'heuristic',
            signals: ['homograph_attack', 'impersonation'],
            summary: 'Homograph detected'
        });
        (semanticEngine.analyzeSemantic as any).mockResolvedValue({
            score: 90,
            confidence: 0.9,
            name: 'semantic',
            semantic_intent: { intent: 'MALICIOUS', confidence: 0.9 },
            summary: 'Malicious intent'
        });

        const req = createRequest('paypal-secure-login.com'); // Example homograph-ish
        const res = await handleAnalysisRequest(req, mockEnv);
        const json = await res.json() as any;
        const result = json.result;

        expect(result.verdict).toBe('MALICIOUS');
        expect(result.riskScore).toBeGreaterThan(80);
    });

    it('Scenario 4: docs.google.com with Phishing -> TRUSTED_SERVICE_ABUSED', async () => {
        // Root Trust: TRUE
        // Semantic: MALICIOUS (Phishing)
        (semanticEngine.analyzeSemantic as any).mockResolvedValue({
            score: 95,
            confidence: 0.9,
            name: 'semantic',
            semantic_intent: { intent: 'MALICIOUS', confidence: 0.95 },
            summary: 'Credential harvesting detected'
        });

        const req = createRequest('https://docs.google.com/forms/d/e/1FAIpQLS/viewform?embedded=true');
        const res = await handleAnalysisRequest(req, mockEnv);
        const json = await res.json() as any;
        const result = json.result;

        expect(result.root_trusted).toBe(true);
        expect(result.final_assessment).toBe('TRUSTED_SERVICE_ABUSED');
        expect(result.analyst_insight.analyst_summary).toContain('Trusted Service Abuse');
        expect(result.verdict).not.toBe('BENIGN'); // Should be SUSPICIOUS or MALICIOUS warning in UI
    });

    it('Scenario 5: Benign Unknown Domain -> Legitimate (Low Confidence)', async () => {
        // Unknown domain, no signals, but low history (First Seen)
        (memory.consultMemory as any).mockResolvedValue({ seen_count: 0, history_scores: [], volatility: 0 });

        // Engines return neutral/safe but low confidence or empty signals
        (engines.analyzeReputation as any).mockResolvedValue({ score: 10, confidence: 0.5, name: 'reputation' }); // Neutral
        (engines.analyzeHeuristic as any).mockResolvedValue({ score: 0, confidence: 0.5, name: 'heuristic' });

        const req = createRequest('random-blog-123.com');
        const res = await handleAnalysisRequest(req, mockEnv);
        const json = await res.json() as any;
        const result = json.result;

        expect(result.verdict).toBe('BENIGN');
        expect(result.final_assessment).toBe('SAFE');

        // Fragility should be higher due to lack of signals/history
        // But Confidence Governor mandates 85-98% for Benign.
        // Let's check if we hit that range.
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);

        // Check explanation mentions fragility
        // Since we mocked inputs, diversity might be low?
        // Engines called: Rep, Struct, Context, Heur, Base, Sem. 6 engines.
        // If they all return valid results, diversity is high.
        // But if they return "Neutral" scores, maybe features are empty.
        // Fragility logic counts engines with features or score > 10.
        // If score is 0 and no features -> Zero Signal Reliance -> High Fragility.
        // This is what we want for "Unknown".

        // In this test setup, I provided "defaultSafe" which has no features array.
        // So activeEngines.length will be 0.
        // Fragility should be HIGH (Zero Signal).

        expect(result.fragility.level).toBe('HIGH'); // or MEDIUM
        expect(result.analyst_insight.analyst_summary).toContain('FRAGILE');
    });

    it('Scenario 6: URL Shortener Abuse -> SUSPICIOUS/MALICIOUS', async () => {
        // Context: Shortener
        // Heuristic: Redirect
        (engines.analyzeContext as any).mockResolvedValue({
            score: 40,
            confidence: 0.8,
            name: 'context',
            summary: 'URL Shortener'
        });

        // Assume context analysis sets the source correctly in request context or engine detects it
        // The orchestrator uses `applyContextualVerdict` based on `context.source`.
        // We simulate this by passing context in body.

        const body: AnalysisRequest = {
            artifact: 'bit.ly/malicious',
            forceRefresh: true,
            context: { source: 'url_shortener' }
        };

        const req = new Request('http://localhost/analyze', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' }
        });

        // Heuristic is safe, so Context must trigger the downgrade
        (engines.analyzeHeuristic as any).mockResolvedValue({ score: 0, confidence: 0.8, name: 'heuristic', summary: 'Safe' });

        const res = await handleAnalysisRequest(req, mockEnv);
        const json = await res.json() as any;
        const result = json.result;

        expect(['SUSPICIOUS', 'MALICIOUS']).toContain(result.verdict);
        expect(result.contextual_verdict.context_downgrade).toBe(true);
    });

});
