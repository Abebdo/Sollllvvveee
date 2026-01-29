/**
 * Solveya Intelligence Platform - Core Domain Types
 * Phase 1: Foundation
 */

export interface Env {
  AI: any;
  ANALYSIS_CACHE: any;
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

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CERTAIN';

export type IntelligenceTier =
  | 'TIER_1_LOCAL'       // Offline heuristics
  | 'TIER_2_PUBLIC_API'  // DNS, RDAP
  | 'TIER_3_SIMULATED'   // Sandbox/Headless
  | 'TIER_4_PLATFORM';   // AI/ML Inference

// --- Request / Response Contract ---

export interface AnalysisRequest {
  artifact: string;
  forceRefresh?: boolean;
  correlationId?: string;
  context?: {
    source?: string;
    timestamp?: string;
  };
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
  confidence: number; // 0.0-1.0

  summary: string; // LLM generated summary

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

// --- Storage / Cache Schema ---

export interface CachedAnalysis {
  v: number; // schema version
  created: number; // unix timestamp
  expires: number; // unix timestamp
  data: AnalysisResult;
}

// --- Error Types ---

export type ServiceError =
  | 'INVALID_INPUT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'UNSUPPORTED_ARTIFACT';
