import { Env } from '../_lib/types';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, env } = context;
  const id = params.id as string;

  if (!id) {
      return new Response(JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Missing ID' } }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
      const cached = await env.ANALYSIS_CACHE.get(id, 'json');
      if (!cached) {
          return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Analysis not found' } }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      return new Response(JSON.stringify({
          id,
          timestamp: new Date().toISOString(),
          status: 'completed',
          result: cached
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (e) {
      return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: String(e) } }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
};
