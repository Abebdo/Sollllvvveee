import { corsHeaders } from '../_lib/orchestrator';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestGet: PagesFunction = async () => {
    return new Response(JSON.stringify({
        supportedArtifacts: ['url', 'ipv4', 'ipv6', 'domain', 'email', 'hash_md5', 'hash_sha1', 'hash_sha256'],
        engines: [
            { id: 'heuristic', version: '2.0.0', type: 'deterministic', description: 'Advanced pattern matching and heuristic analysis' },
            { id: 'reputation', version: '1.5.0', type: 'lookup', description: 'Known good/bad reputation lists' },
            { id: 'structure', version: '1.1.0', type: 'deterministic', description: 'Structural analysis of artifacts' },
            { id: 'context', version: '1.0.0', type: 'probabilistic', description: 'Context-aware risk adjustment' },
            { id: 'meta', version: '3.2.0', type: 'ensemble', description: 'Meta-analysis and conflict resolution' }
        ],
        limits: {
            maxInputLength: 2048,
            rateLimit: '30/min burst, 500/hour sustained'
        }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
};
