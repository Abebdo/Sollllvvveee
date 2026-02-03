import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleAnalysisRequest } from '../../functions/_lib/orchestrator';
import { Env } from '../../functions/_lib/types';

// Mock Cache
const mockCache = {
  get: vi.fn(),
  put: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ keys: [] }),
};

const mockEnv = {
  AI: {},
  ANALYSIS_CACHE: mockCache,
} as unknown as Env;

// Mock Global Fetch
const originalFetch = global.fetch;

function createRequest(body: any) {
  return new Request('http://localhost/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Production Compliance & Atomic Analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should return a complete, valid result for a clean URL (google.com)', async () => {
    // Mock successful fetch for semantic engine (simulate google.com content)
    (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<html><body><form><input type="text" name="q"></form></body></html>', // Search form, no password
        headers: new Headers(),
        url: 'https://google.com' // Important for expandUrl mock if needed
    });

    const req = createRequest({ artifact: 'https://google.com' });
    const res = await handleAnalysisRequest(req, mockEnv);

    // Orchestrator returns 500 if it fails.
    if (res.status !== 200) {
        const err = await res.json();
        console.error('Analysis failed:', err);
    }

    expect(res.status).toBe(200);
    const body = await res.json() as any;

    expect(body.ok).toBe(true);
    expect(body.status).toBe('completed');
    expect(body.data).toBeDefined();

    const result = body.data;
    // google.com is a Root Trust Reality Anchor. Should be SAFE / BENIGN.
    expect(result.verdict).toBe('BENIGN');
    expect(result.root_trusted).toBe(true);
    expect(result.final_assessment).toBe('SAFE');

    // Compliance Checks
    expect(result.confidence).toBeGreaterThanOrEqual(0.40);
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.explanation).toBeDefined();
    expect(result.explanation.summary).toBeTruthy();

    // Ensure no placeholders
    expect(result.verdict).not.toBe('UNKNOWN');
    expect(result.verdict).not.toBe('PENDING');
  });

  it('should return a suspicious/malicious result for a known bad pattern', async () => {
    // Mock fetch for semantic engine (simulate phishing site)
    (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<html><body><form><input type="password" name="pass"></form></body></html>',
        headers: new Headers(),
        url: 'http://evil.com'
    });

    const req = createRequest({ artifact: 'http://login-secure-update-urgent.com/verify?account=123' });
    const res = await handleAnalysisRequest(req, mockEnv);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const result = body.data;

    expect(result.verdict).toMatch(/SUSPICIOUS|MALICIOUS/);
    expect(result.riskScore).toBeGreaterThan(50);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('should FAIL EXPLICITLY (500) if a mandatory engine fails', async () => {
    // Simulate Semantic Engine failure (e.g. Network Error)
    // analyzeSemantic throws if fetch fails.
    (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
    });

    const req = createRequest({ artifact: 'https://broken-api.com' });
    const res = await handleAnalysisRequest(req, mockEnv);

    // Expect 500 Internal Error (Fail Explicitly)
    expect(res.status).toBe(500);
    const body = await res.json() as any;

    expect(body.ok).toBe(false);
    expect(body.error_code).toMatch(/E_ENGINE_FAILURE|E_INTERNAL_ERROR/);
  });
});
