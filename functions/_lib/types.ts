/**
 * Solveya Intelligence Platform - Core Domain Types
 * Phase 2: Production Hardening
 */

export interface Env {
  AI: any;
  ANALYSIS_CACHE: any; // KV Namespace
}

export type ArtifactType =
  | 'url'
  | 'ipv4'
  | 'ipv6'
  | 'domain'
  | 'hash_md5'
  | 'hash_sha1'
  | 'hash_sha256'
  | 'text'
  | 'email';

export type RiskVerdict =
  | 'MALICIOUS'
  | 'SUSPICIOUS'
  | 'BENIGN'
  | 'UNKNOWN';

export type IntelligenceTier =
  | 'TIER_1_LOCAL'       // Deterministic Heuristics
  | 'TIER_2_PUBLIC_API'  // External Data (Reserved)
  | 'TIER_4_PLATFORM';   // Advanced Inference (Reserved)

// --- Request / Response Contract ---

export interface AnalysisContext {
  source?: 'email' | 'web' | 'api' | 'redirect' | 'automation' | string;
  timestamp?: string;
  user_agent?: string;
  origin_ip?: string;
}

export interface AnalysisRequest {
  artifact: string;
  forceRefresh?: boolean;
  correlationId?: string;
  context?: AnalysisContext;
}

export interface ReasoningStep {
  signal: string;
  evidence: string;
  threshold?: string;
  impact: number;
  why_it_matters: string;
}

export interface ReasoningGraph {
  conclusion: string;
  chain: ReasoningStep[];
}

export interface TemporalAnalysis {
  last_score: number | null;
  delta: number | null;
  trend: 'improving' | 'degrading' | 'stable' | 'insufficient_data';
  velocity?: number | null;
}

export interface ConfidenceProfile {
  score: number; // 0-1
  reasons: string[];
}

export interface AnalysisResponse {
  id: string;
  timestamp: string;
  status: 'processing' | 'completed' | 'failed';
  result?: AnalysisResult;
  error?: {
    code: string;
    message: string;
  };
}

// --- Analysis Result Structure ---

export interface AnalysisResult {
  artifact: {
    raw: string;
    type: ArtifactType;
    canonical: string;
  };
  verdict: RiskVerdict;
  riskScore: number; // 0-100
  confidence: number; // 0.0-1.0 (Legacy, kept for compat)

  // New Structured Fields
  confidence_detail?: ConfidenceProfile;
  reasoning?: ReasoningGraph;
  temporal?: TemporalAnalysis;

  // New Explainability & Auditability
  signals: string[]; // specific signals detected
  why_it_matters: string[]; // context on importance

  summary: string;

  // Categorized intelligence
  features: Record<string, FeatureResult>;

  // Explainability
  explanation: {
    primaryFactors: string[];
    technicalAnalysis: string;
    recommendedActions: string[];
  };

  meta: {
    executionTimeMs: number;
    cached: boolean;
    tierUsed: IntelligenceTier[];
    modelVersion: string;
  };
}

export interface FeatureResult {
  id: string;
  tier: IntelligenceTier;
  detected: boolean;
  value?: string | number | boolean | object;
  riskContribution: number; // -10 to +10 impact on score
  description: string;
  evidence: string[]; // Raw data supporting this finding
}

// --- Standard API Response ---

export interface ApiResponse<T = any> {
  ok: boolean;
  error_code: string | null;
  message: string;
  data: T;
  // Legacy fields might be merged at root level in actual response object
}

// --- Error Types ---

export type ServiceError =
  | 'INVALID_INPUT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'UNSUPPORTED_ARTIFACT'
  | 'E_VALIDATION_INVALID_INPUT'
  | 'E_RATE_LIMIT_EXCEEDED'
  | 'E_ENGINE_FAILURE';
