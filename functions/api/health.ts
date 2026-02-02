import { corsHeaders } from '../_lib/orchestrator';
import { Env } from '../_lib/types';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    let dbStatus = 'connected';
    try {
        if (context.env.ANALYSIS_CACHE) {
             await context.env.ANALYSIS_CACHE.get('health_check');
        } else {
            dbStatus = 'disconnected (env missing)';
        }
    } catch (e) {
        dbStatus = 'disconnected';
    }

    return new Response(JSON.stringify({
        status: 'operational',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        services: {
            api: 'up',
            engine: 'up',
            database: dbStatus
        }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
};
