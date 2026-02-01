import { corsHeaders } from '../_lib/orchestrator';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestGet: PagesFunction = async () => {
    return new Response(JSON.stringify({
        supportedArtifacts: ['url', 'ipv4', 'ipv6', 'domain', 'email', 'hash_md5', 'hash_sha1', 'hash_sha256'],
        engines: [
            { id: 'heuristic', version: '2.0.0', type: 'deterministic', description: 'Advanced pattern matching and heuristic analysis' }
        ],
        limits: {
            maxInputLength: 2048,
            rateLimit: '30/min burst, 500/hour sustained'
        }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
};
