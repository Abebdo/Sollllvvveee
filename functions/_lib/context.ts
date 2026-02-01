import { AnalysisContext, ArtifactType } from './types';

interface ContextAdjustment {
  scoreModifier: number;
  reason: string | null;
}

export function calculateContextAdjustment(
  context: AnalysisContext | undefined,
  artifactType: ArtifactType
): ContextAdjustment {
  if (!context || !context.source) {
    return { scoreModifier: 0, reason: null };
  }

  let modifier = 0;
  let reason: string | null = null;

  const source = context.source.toLowerCase();

  // Deterministic context logic
  if (source === 'email') {
     // Email context generally increases risk for links/files due to phishing prevalence
     if (artifactType === 'url' || artifactType === 'domain') {
       modifier = 10;
       reason = 'URL detected in Email context (High Phishing Risk)';
     }
  } else if (source === 'api') {
     // API context might be neutral
     modifier = 0;
     reason = 'API context (Neutral)';
  } else if (source === 'redirect') {
      modifier = 5;
      reason = 'Redirect chain context (Obfuscation Risk)';
  } else if (source === 'automation') {
      modifier = 0;
      reason = 'Automated scan context';
  }

  return { scoreModifier: modifier, reason };
}
