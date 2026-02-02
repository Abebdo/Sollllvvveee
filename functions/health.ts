import { Env } from './_lib/types';
import { corsHeaders } from './_lib/orchestrator';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const status = {
    status: 'alive',
    service: 'solveya-backend',
    env: 'production',
    timestamp: new Date().toISOString(),
    checks: {
      kv: false
    }
  };

  if (env.ANALYSIS_CACHE) {
    try {
      await env.ANALYSIS_CACHE.list({ limit: 1 });
      status.checks.kv = true;
    } catch (e) {
      console.error('Health KV check failed', e);
      status.status = 'degraded';
    }
  } else {
    status.status = 'misconfigured';
  }

  return new Response(JSON.stringify(status), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
};
