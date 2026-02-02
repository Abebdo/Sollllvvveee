import { PagesFunction } from '@cloudflare/workers-types';
import { Env } from '../_lib/types';
import { corsHeaders } from '../_lib/orchestrator';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        if (!context.env.ANALYSIS_CACHE) {
             throw new Error("ANALYSIS_CACHE binding missing");
        }
        // Perform a real check: list one key (lightweight)
        await context.env.ANALYSIS_CACHE.list({ limit: 1 });

        return new Response(JSON.stringify({
            status: "alive",
            service: "solveya-backend",
            env: "production",
            timestamp: new Date().toISOString(),
            checks: {
                kv: "connected",
                engines: "ready"
            }
        }), {
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json"
            }
        });
    } catch (e) {
        return new Response(JSON.stringify({
            status: "error",
            error: String(e),
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json"
            }
        });
    }
};
