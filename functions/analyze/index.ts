import { handleAnalysisRequest } from '../_lib/orchestrator';
import { Env } from '../_lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return await handleAnalysisRequest(context.request, context.env);
};
