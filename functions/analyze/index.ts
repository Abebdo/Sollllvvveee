import { Env, AnalysisRequest, AnalysisResult, RiskVerdict } from '../_lib/types';
import { classifyArtifact, analyzeTier1, analyzeTier4 } from '../_lib/logic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const start = Date.now();

  try {
    const body = await request.json() as AnalysisRequest;
    const artifact = body.artifact;
    if (!artifact) {
         return new Response('Missing artifact', { status: 400, headers: corsHeaders });
    }

    // Canonicalize
    const type = classifyArtifact(artifact);

    // Check Cache
    const cacheKey = `analysis:${type}:${encodeURIComponent(artifact)}`;
    let cached: any = null;
    try {
        cached = await env.ANALYSIS_CACHE.get(cacheKey, 'json');
    } catch (e) {
        console.warn('Cache lookup failed', e);
    }

    if (cached && !body.forceRefresh) {
         // Generate a new ID for this retrieval so GET /analyze/:id works
         const newId = crypto.randomUUID();
         try {
            await env.ANALYSIS_CACHE.put(newId, JSON.stringify(cached), { expirationTtl: 86400 });
         } catch(e) {
             console.warn('Cache write failed (newId)', e);
         }

         return new Response(JSON.stringify({
             id: newId,
             timestamp: new Date().toISOString(),
             status: 'completed',
             result: { ...cached, meta: { ...cached.meta, cached: true } }
         }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Run Analysis
    const tier1 = analyzeTier1(artifact, type);
    const tier4 = await analyzeTier4(artifact, type, tier1.score, env);

    const finalScore = Math.min(100, Math.max(0, tier1.score + tier4.riskAdjustment));

    let verdict: RiskVerdict = 'UNKNOWN';
    if (finalScore > 80) verdict = 'MALICIOUS';
    else if (finalScore > 50) verdict = 'SUSPICIOUS';
    else verdict = 'BENIGN';

    const result: AnalysisResult = {
        artifact: { raw: artifact, type, canonical: artifact }, // simplified canonical
        verdict,
        riskScore: finalScore,
        confidence: 0.85, // Mocked confidence
        summary: tier4.summary,
        features: tier1.features,
        explanation: {
            primaryFactors: Object.values(tier1.features).map(f => f.description),
            technicalAnalysis: tier4.explanation,
            recommendedActions: verdict === 'MALICIOUS' ? ['Block', 'Report'] : ['Monitor']
        },
        meta: {
            executionTimeMs: Date.now() - start,
            cached: false,
            tierUsed: ['TIER_1_LOCAL', 'TIER_4_PLATFORM'],
            modelVersion: 'v1'
        }
    };

    // Cache result (TTL 24h)
    try {
        // Store by artifact for deduplication
        await env.ANALYSIS_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 });

        // Store by ID for retrieval
        const resultId = crypto.randomUUID();
        await env.ANALYSIS_CACHE.put(resultId, JSON.stringify(result), { expirationTtl: 86400 });

        return new Response(JSON.stringify({
            id: resultId,
            timestamp: new Date().toISOString(),
            status: 'completed',
            result
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    } catch(e) {
         console.warn('Cache write failed', e);
         // Return result even if cache fails
         const resultId = crypto.randomUUID();
         return new Response(JSON.stringify({
            id: resultId,
            timestamp: new Date().toISOString(),
            status: 'completed',
            result
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

  } catch (e) {
    return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: String(e) } }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
};
