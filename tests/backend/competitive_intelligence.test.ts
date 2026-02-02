import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAnalysisRequest } from '../../functions/_lib/orchestrator';
import { AnalysisResult } from '../../functions/_lib/types';
import { generateCampaignFingerprint } from '../../functions/_lib/analysis/campaign_correlation';

// Mock Env
class MockKV {
    store: Record<string, string> = {};
    async get(key: string) {
        // console.log('MockKV GET', key, this.store[key] ? 'HIT' : 'MISS');
        return this.store[key] || null;
    }
    async put(key: string, value: string) {
        // console.log('MockKV PUT', key);
        this.store[key] = value;
    }
    clear() { this.store = {}; }
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

// Mock Fetch Global
global.fetch = vi.fn();

// Helper to pre-populate memory
async function setMemory(artifact: string, history: number[]) {
    const msgBuffer = new TextEncoder().encode(artifact);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const key = `memory:v1:${hashHex}`;

    const record = {
        first_seen: Date.now() - 1000000,
        last_seen: Date.now(),
        count: history.length,
        scores: history
    };

    await mockEnv.ANALYSIS_CACHE.put(key, JSON.stringify(record));
}

// Helper to pre-populate campaign memory
async function setCampaignMemory(fingerprint: string, count: number) {
    const key = `campaign:v1:${fingerprint}`;
    const record = {
        count: count,
        first_seen: Date.now() - 1000000,
        last_seen: Date.now(),
        artifacts: []
    };
    await mockEnv.ANALYSIS_CACHE.put(key, JSON.stringify(record));
}

describe('Competitive Intelligence Supremacy Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv.ANALYSIS_CACHE.clear();

        // Default safe response
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://example.com',
            text: async () => '<html><body>Safe content</body></html>',
            headers: new Map()
        });
    });

    // 1. Behavioral Drift: Safe History -> Risky Content
    it('should detect Behavioral Drift (Safe -> Malicious)', async () => {
        const artifact = 'https://compromised-site.com/login';

        // Setup history: consistently safe (score 10)
        await setMemory(artifact, [10, 10, 10, 10, 10]);

        // Mock current analysis as risky (e.g. phishing form found)
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: artifact,
            text: async () => '<html><form><input type="password"></form></html>',
            headers: new Map()
        });

        const req = mockRequest({ artifact, forceRefresh: true });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.behavioral_timeline).toBeDefined();
        expect(result.behavioral_timeline?.behavioral_drift).toBe('HIGH');
        expect(result.why_it_matters.some(s => s.includes('Behavioral Drift'))).toBe(true);
        // Score should be boosted
        expect(result.riskScore).toBeGreaterThan(70);
    });

    // 2. Infrastructure Abuse: Cloudflare Pages Phishing
    it('should detect Infrastructure Abuse (Trusted Provider + Bad Keywords)', async () => {
        const artifact = 'https://login-secure-update.pages.dev';

        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: artifact,
            text: async () => '<html>Fake Login</html>',
            headers: new Map()
        });

        const req = mockRequest({ artifact });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.infrastructure_intel).toBeDefined();
        expect(result.infrastructure_intel?.provider_name).toBe('Cloudflare Pages');
        expect(result.infrastructure_intel?.abuse_type).toBe('Free Hosting Phishing');
        expect(result.infrastructure_intel?.trusted_infra_abuse).toBe(true);

        // Score adjustment
        expect(result.riskScore).toBeGreaterThan(60);
    });

    // 3. Campaign Correlation
    it('should correlate artifacts based on structural fingerprint', async () => {
        const artifact = 'https://campaign-node.com/auth/v1';
        const fingerprint = generateCampaignFingerprint(artifact);

        // Setup campaign memory: seen 50 times
        await setCampaignMemory(fingerprint, 55);

        // Ensure fetch returns the same URL so it's not treated as a redirect
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: artifact,
            text: async () => '<html>Safe content</html>',
            headers: new Map()
        });

        const req = mockRequest({ artifact });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.campaign_correlation).toBeDefined();
        expect(result.campaign_correlation?.related_artifacts_count).toBeGreaterThan(50);
        expect(result.campaign_correlation?.campaign_name).toContain('High-Volume Campaign');

        // Boost score
        expect(result.why_it_matters.some(s => s.includes('Campaign Correlation'))).toBe(true);
    });

    // 4. Human-Grade Explanation (Dialectical)
    it('should generate dialectical analyst explanation', async () => {
        const artifact = 'https://unknown-site.xyz';

        const req = mockRequest({ artifact });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        const summary = result.analyst_insight?.analyst_summary || '';

        // Check for dialectical markers
        expect(summary).toMatch(/Although.*however.*therefore/i);
        // Check for counterfactual/epistemic honesty if not clear cut
        if (result.confidence_range?.uncertainty !== 'LOW') {
             expect(summary).toMatch(/shift in behavioral patterns|verification of ownership/i);
        }
    });

    // 5. Context Amplification: SMS
    it('should downgrade verdict for SMS context', async () => {
        const artifact = 'https://example.com/promo';

        const req = mockRequest({
            artifact,
            context: { source: 'sms' }
        });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.contextual_verdict?.context_downgrade).toBe(true);
        expect(result.verdict).toBe('SUSPICIOUS'); // Even if example.com is safe
        expect(result.contextual_verdict?.context_notes.join('')).toContain('SMS');
    });

    // 6. Adversarial: Google Docs Phishing with Conflict Resolution
    it('should handle Google Docs Phishing with correct Conflict Resolution', async () => {
        const artifact = 'https://docs.google.com/forms/d/xyz/viewform';

        // Mock password field
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: artifact,
            text: async () => '<html><input type="password"></html>',
            headers: new Map()
        });

        const req = mockRequest({ artifact });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        // Intent (password in docs) vs Reputation (Google)
        expect(result.conflict_resolution?.conflict_detected).toBe(true);
        expect(result.conflict_resolution?.winning_signal).toBe('INTENT');
        expect(result.verdict).not.toBe('BENIGN');
        expect(result.infrastructure_intel?.provider_name).toBe('Trusted Productivity Suite');
    });

});
