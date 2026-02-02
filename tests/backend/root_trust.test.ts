import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAnalysisRequest } from '../../functions/_lib/orchestrator';
import { AnalysisResult } from '../../functions/_lib/types';

// Mock Env (Copy from existing test)
class MockKV {
    store: Record<string, string> = {};
    async get(key: string) { return this.store[key] || null; }
    async put(key: string, value: string) { this.store[key] = value; }
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

describe('Root Infrastructure Immunity & Usage-Based Intelligence', () => {

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

    // 1. Google Docs Phishing (Trusted Domain + Malicious Usage)
    it('should classify Google Docs Phishing as TRUSTED_SERVICE_ABUSED', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://docs.google.com/forms/d/e/12345/viewform',
            text: async () => '<html><body><form><input type="password" name="p"></form></body></html>', // Phishing
            headers: new Map()
        });

        const req = mockRequest({ artifact: 'https://docs.google.com/forms/d/e/12345/viewform' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.root_trusted).toBe(true);
        expect(result.domain_trust).toBe('SAFE');
        expect(result.usage_risk).toBe('MALICIOUS');
        expect(result.final_assessment).toBe('TRUSTED_SERVICE_ABUSED');

        // Explanation Check
        expect(result.explanation.summary).toMatch(/globally trusted service/);
        expect(result.explanation.summary).toMatch(/abusing its infrastructure|abuse trusted platform/);
    });

    // 2. GitHub Raw Abuse (Trusted Domain + Malicious Code)
    it('should classify GitHub Raw Abuse as TRUSTED_SERVICE_ABUSED', async () => {
         // Use strong signals to trigger detection:
         // 1. "urgent" -> Heuristic Urgency (25)
         // 2. "password" -> Heuristic Credential (30) - Wait, "password" is not in keywords list. "account" is.
         // Total Heuristic > 50.
         // Also add form to trigger Semantic MALICIOUS for robustness, although raw doesn't have forms usually.
         // Update: Heuristic engine is static (URL only). It won't see text content.
         // Semantic engine sees content. It requires <form> and password input.
         // We simulate a phishing page source code hosted on GitHub.
         (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://raw.githubusercontent.com/evil/repo/main/phish.html',
            text: async () => '<html><form><input type="password" name="secret"></form></html>',
            headers: new Map()
        });

        const req = mockRequest({ artifact: 'https://raw.githubusercontent.com/evil/repo/main/malware.sh' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.root_trusted).toBe(true);
        expect(result.domain_trust).toBe('SAFE');
        expect(result.usage_risk).toMatch(/SUSPICIOUS|MALICIOUS/);
        expect(result.final_assessment).toBe('TRUSTED_SERVICE_ABUSED');
    });

    // 3. Standard Malicious Domain
    it('should classify Standard Malicious Domain as MALICIOUS_SERVICE', async () => {
         (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://evil-phishing.com/login',
            text: async () => '<html><body><form><input type="password" name="p"></form></body></html>',
            headers: new Map()
        });

        const req = mockRequest({ artifact: 'https://evil-phishing.com/login' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.root_trusted).toBe(false);
        expect(result.usage_risk).toBe('MALICIOUS');
        expect(result.final_assessment).toBe('MALICIOUS_SERVICE');
    });

    // 4. Standard Benign Domain
    it('should classify Standard Benign Domain as SAFE', async () => {
         (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://wikipedia.org',
            text: async () => '<html><body>Knowledge</body></html>',
            headers: new Map()
        });

        const req = mockRequest({ artifact: 'https://wikipedia.org' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.root_trusted).toBe(false);
        expect(result.usage_risk).toBe('BENIGN');
        expect(result.final_assessment).toBe('SAFE');
    });

    // 5. Root Trusted Safe (Google Search)
    it('should classify Google Search as SAFE', async () => {
         (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            url: 'https://google.com',
            text: async () => '<html><body>Search</body></html>',
            headers: new Map()
        });

        const req = mockRequest({ artifact: 'https://google.com' });
        const res = await handleAnalysisRequest(req, mockEnv);
        const data = await res.json() as any;
        const result = data.data as AnalysisResult;

        expect(result.root_trusted).toBe(true);
        expect(result.domain_trust).toBe('SAFE');
        expect(result.usage_risk).toBe('BENIGN');
        expect(result.final_assessment).toBe('SAFE');
    });

});
