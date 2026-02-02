import type { PagesFunction } from '@cloudflare/workers-types';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*"
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({
    status: "alive",
    service: "solveya-backend",
    env: "production",
    timestamp: new Date().toISOString()
  }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
};
