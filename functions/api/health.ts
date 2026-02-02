import { Env } from '../_lib/types';
import type { PagesFunction } from '@cloudflare/workers-types';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// We use explicit specific types to match the environment better or use simple ReturnType
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders }) as any;
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
        // AI is technically optional for Tier 1, so maybe just warning
    }

    // Attempt a KV read (even if key missing, just to test connection)
    if (context.env.ANALYSIS_CACHE) {
        try {
            await context.env.ANALYSIS_CACHE.get('health_check');
        } catch (e) {
            // Safely handle unknown error type
            const errorMessage = e instanceof Error ? e.message : String(e);
            checks.push(`KV access failed: ${errorMessage}`);
            status = 'error';
        }
    }

    return new Response(JSON.stringify({
        status: status,
        engine: "solveya-analysis",
        version: "2.0.0",
        // Adding extra debug info in a way that doesn't break the contract
        _diagnostics: checks.length > 0 ? checks : undefined
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) as any;
};
