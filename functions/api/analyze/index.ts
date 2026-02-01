import { Env } from '../../_lib/types';
import { handleAnalysisRequest, corsHeaders } from '../../_lib/orchestrator';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    return handleAnalysisRequest(context.request, context.env);
};
