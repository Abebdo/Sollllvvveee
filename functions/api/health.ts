import { corsHeaders } from '../_lib/orchestrator';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestGet: PagesFunction = async () => {
    return new Response(JSON.stringify({
        status: 'operational',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        services: {
            api: 'up',
            engine: 'up',
            database: 'connected'
        }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
};
