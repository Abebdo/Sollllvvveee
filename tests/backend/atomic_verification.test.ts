
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleAnalysisRequest } from '../../functions/_lib/orchestrator';
import { Env } from '../../functions/_lib/types';

// Mocks
vi.mock('../../functions/_lib/engines/reputation.engine', () => ({
    analyzeReputation: vi.fn()
}));
vi.mock('../../functions/_lib/engines/structure.engine', () => ({
    analyzeStructure: vi.fn()
}));
vi.mock('../../functions/_lib/engines/semantic.engine', () => ({
    analyzeSemantic: vi.fn()
}));
vi.mock('../../functions/_lib/engines/context.engine', () => ({
    analyzeContext: vi.fn()
}));
vi.mock('../../functions/_lib/engines/heuristic', () => ({
    analyzeHeuristic: vi.fn()
}));
vi.mock('../../functions/_lib/engines/baseline.engine', () => ({
    analyzeBaseline: vi.fn()
}));
vi.mock('../../functions/_lib/engines/root_trust.engine', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../functions/_lib/engines/root_trust.engine')>();
    return {
        ...actual,
        analyzeRootTrust: vi.fn(),
    };
});
vi.mock('../../functions/_lib/memory/analytical_memory', () => ({
    consultMemory: vi.fn().mockResolvedValue({
        seen_count: 0,
        history_scores: [],
        volatility: 0,
        average_score: 0,
        trend_classification: 'novel'
    }),
    updateMemory: vi.fn(),
    consultCampaignMemory: vi.fn().mockResolvedValue({}),
    updateCampaignMemory: vi.fn()
}));
vi.mock('../../functions/_lib/analysis/url_expansion', () => ({
    expandUrl: vi.fn().mockImplementation(url => Promise.resolve(url))
}));
vi.mock('../../functions/_lib/analysis/behavioral_timeline', () => ({
    analyzeBehavioralTimeline: vi.fn().mockReturnValue({ behavioral_drift: 'NONE', timeline_confidence_penalty: 0, history_summary: '' })
}));
vi.mock('../../functions/_lib/analysis/infrastructure_intel', () => ({
    analyzeInfrastructure: vi.fn().mockReturnValue({ infrastructure_risk_score: 0, trusted_infra_abuse: false, provider_name: 'test' })
}));
vi.mock('../../functions/_lib/analysis/campaign_correlation', () => ({
    analyzeCampaignCorrelation: vi.fn().mockReturnValue({ campaign_confidence: 0, related_artifacts_count: 0 }),
    generateCampaignFingerprint: vi.fn().mockReturnValue('test-fingerprint')
}));
vi.mock('../../functions/_lib/temporal', () => ({
    analyzeTemporal: vi.fn().mockResolvedValue({})
}));

import { analyzeReputation } from '../../functions/_lib/engines/reputation.engine';
import { analyzeStructure } from '../../functions/_lib/engines/structure.engine';
import { analyzeSemantic } from '../../functions/_lib/engines/semantic.engine';
import { analyzeContext } from '../../functions/_lib/engines/context.engine';
import { analyzeHeuristic } from '../../functions/_lib/engines/heuristic';
import { analyzeBaseline } from '../../functions/_lib/engines/baseline.engine';
import { analyzeRootTrust } from '../../functions/_lib/engines/root_trust.engine';
import { analyzeInfrastructure } from '../../functions/_lib/analysis/infrastructure_intel';

const mockEnv = {
    ANALYSIS_CACHE: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
    }
} as unknown as Env;

const validEngineResult = {
    score: 0,
    confidence: 0.9,
    verdict: 'BENIGN',
    features: [],
    signals: ['test signal'],
    summary: 'Test summary'
};

describe('Atomic Analysis Verification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default success setup
        (analyzeRootTrust as any).mockResolvedValue({ is_trusted: false, role: 'unknown', engine_result: { ...validEngineResult, name: 'root_trust' } });
        (analyzeReputation as any).mockResolvedValue({ ...validEngineResult, name: 'reputation' });
        (analyzeStructure as any).mockResolvedValue({ ...validEngineResult, name: 'structure' });
        (analyzeSemantic as any).mockResolvedValue({ ...validEngineResult, name: 'semantic', semantic_intent: { intent: 'BENIGN' } });
        (analyzeContext as any).mockResolvedValue({ ...validEngineResult, name: 'context' });
        (analyzeHeuristic as any).mockResolvedValue({ ...validEngineResult, name: 'heuristic' });
        (analyzeBaseline as any).mockResolvedValue({ ...validEngineResult, name: 'baseline' });
    });

    it('should return 200 OK when all engines succeed', async () => {
        const req = new Request('http://localhost/analyze', {
            method: 'POST',
            body: JSON.stringify({ artifact: 'https://example.com' })
        });
        const res = await handleAnalysisRequest(req, mockEnv);
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.ok).toBe(true);
        expect(body.data.signals.length).toBeGreaterThan(0);
    });

    it('should return 200 OK (RESILIENCE) when a single CRITICAL engine fails (Reputation)', async () => {
        (analyzeReputation as any).mockRejectedValue(new Error('Critical failure'));

        const req = new Request('http://localhost/analyze', {
            method: 'POST',
            body: JSON.stringify({ artifact: 'https://example.com' })
        });
        const res = await handleAnalysisRequest(req, mockEnv);
        // Expect 200 because Minimum Viable Set is met (other criticals succeed)
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.ok).toBe(true);
    });

    it('should return 500 when ALL critical engines fail', async () => {
        (analyzeReputation as any).mockRejectedValue(new Error('Fail'));
        (analyzeStructure as any).mockRejectedValue(new Error('Fail'));
        (analyzeContext as any).mockRejectedValue(new Error('Fail'));
        (analyzeHeuristic as any).mockRejectedValue(new Error('Fail'));
        (analyzeSemantic as any).mockRejectedValue(new Error('Fail'));

        const req = new Request('http://localhost/analyze', {
            method: 'POST',
            body: JSON.stringify({ artifact: 'https://example.com' })
        });
        const res = await handleAnalysisRequest(req, mockEnv);
        expect(res.status).toBe(500);
        const body = await res.json() as any;
        expect(body.error_code).toBe('E_INTERNAL_ERROR');
    });

    it('should return 200 (Success) when a NON-CRITICAL engine fails (Baseline)', async () => {
        (analyzeBaseline as any).mockRejectedValue(new Error('Baseline failure'));

        const req = new Request('http://localhost/analyze', {
            method: 'POST',
            body: JSON.stringify({ artifact: 'https://example.com' })
        });
        const res = await handleAnalysisRequest(req, mockEnv);
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.ok).toBe(true);
    });

    it('should return 200 (Success) when Deep Intel fails (Infrastructure)', async () => {
        // Deep Intel mocking
        (analyzeInfrastructure as any).mockImplementation(() => { throw new Error("Deep Intel Error"); });

        const req = new Request('http://localhost/analyze', {
            method: 'POST',
            body: JSON.stringify({ artifact: 'https://example.com' })
        });
        const res = await handleAnalysisRequest(req, mockEnv);
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.ok).toBe(true);
        // Ensure defaults are populated
        expect(body.data.infrastructure_intel).toBeDefined();
        expect(body.data.infrastructure_intel.provider_name).toBe('Unknown');
    });

    it('should return 500 when ZERO SIGNALS are produced', async () => {
        const emptyResult = { ...validEngineResult, signals: [] };

        (analyzeReputation as any).mockResolvedValue({ ...emptyResult, name: 'reputation' });
        (analyzeStructure as any).mockResolvedValue({ ...emptyResult, name: 'structure' });
        (analyzeSemantic as any).mockResolvedValue({ ...emptyResult, name: 'semantic', semantic_intent: { intent: 'BENIGN' } });
        (analyzeContext as any).mockResolvedValue({ ...emptyResult, name: 'context' });
        (analyzeHeuristic as any).mockResolvedValue({ ...emptyResult, name: 'heuristic' });
        (analyzeBaseline as any).mockResolvedValue({ ...emptyResult, name: 'baseline' });
        (analyzeRootTrust as any).mockResolvedValue({ is_trusted: false, role: 'unknown', engine_result: { ...emptyResult, name: 'root_trust' } });

        const req = new Request('http://localhost/analyze', {
            method: 'POST',
            body: JSON.stringify({ artifact: 'https://example.com' })
        });
        const res = await handleAnalysisRequest(req, mockEnv);

        expect(res.status).toBe(500);
        const body = await res.json() as any;
        expect(body.message).toContain('Zero valid signals produced');
    });
});
