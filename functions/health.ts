import { Env } from './_lib/types';
import type { PagesFunction } from '@cloudflare/workers-types';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const checks: string[] = [];
    let status = 'ok';

    // Check Bindings
    if (!context.env.ANALYSIS_CACHE) {
        checks.push('ANALYSIS_CACHE missing');
        status = 'degraded';
    }
    if (!context.env.AI) {
        checks.push('AI binding missing');
        // AI might be optional depending on setup, but logging it as missing
    }

    // Attempt a KV read to verify connectivity
    if (context.env.ANALYSIS_CACHE) {
        try {
            await context.env.ANALYSIS_CACHE.get('health_check');
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            checks.push(`KV access failed: ${errorMessage}`);
            status = 'error';
        }
    }

    // If status is degraded or error, we might still want to return 200 OK so the service is "reachable"
    // but the body indicates the issue. However, for "Analysis Engine Unreachable",
    // if we can reach this endpoint, the "Engine" (Compute) is reachable.
    // The "Analysis" capability might be degraded.

    // The user requirement: It must return { "status": "ok" }
    // If it's actually broken, I should probably report it, but let's default to 'ok' if minimal requirements met.

    return new Response(JSON.stringify({
        status: status,
        checks: checks,
        timestamp: new Date().toISOString()
    }), {
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
        }
    });
};
