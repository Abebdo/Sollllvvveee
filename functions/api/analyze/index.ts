import type { PagesFunction } from '@cloudflare/workers-types';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestPost: PagesFunction = async () => {
  return new Response(JSON.stringify({
    verdict: "PENDING",
    confidence: {
      mostLikely: 50,
      range: { min: 40, max: 60 },
      uncertainty: "HIGH"
    },
    reason: "Analysis engine initializing"
  }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
};
