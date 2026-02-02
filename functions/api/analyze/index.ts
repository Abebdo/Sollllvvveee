import { PagesFunction } from '@cloudflare/workers-types';
import { Env } from '../../_lib/types';
import { handleAnalysisRequest } from '../../_lib/orchestrator';

export const onRequestOptions: PagesFunction = async () => {
    return new Response(null, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    return handleAnalysisRequest(context.request, context.env);
};
