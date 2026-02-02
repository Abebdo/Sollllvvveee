/**
 * Solveya Intelligence Platform - Core Domain Types
 * Phase 2: Production Hardening
 */

import { CognitiveTraceStep } from './cognitive_trace';

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

export interface ConfidenceRange {
  min: number;
  mostLikely: number;
  max: number;
  uncertainty: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RiskTimelineStage {
  stage: string;
  score: number;
}

// --- Meta Intelligence Types ---

export interface MetaJudgmentResult {
  source_diversity: number;        // 0.0 – 1.0
  agreement_score: number;         // 0.0 – 1.0
  echo_chamber_risk: 'LOW' | 'MEDIUM' | 'HIGH';
  fragility_level: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence_adjustment: number;   // multiplier
  warnings?: string[];

  // Phase 1 Extensions
  engine_count: number;
  engine_family_diversity: number; // 0.0 - 1.0 (Static, Heuristic, Semantic, Reputation)
  agreement_ratio: number;

  // Legacy/Compat fields
  consensus_score?: number;
  disagreement_level?: 'low' | 'medium' | 'high';
  contradictions?: string[];
  judgment_notes?: string[];
}

export interface SemanticIntentResult {
  intent: 'BENIGN' | 'SUSPICIOUS' | 'MALICIOUS';
  confidence: number;
  indicators: string[];
}

export interface FragilityResult {
  score: number; // 0–10
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
}

export interface ContextualVerdict {
  original_verdict: RiskVerdict;
  adjusted_verdict: RiskVerdict;
  context_downgrade: boolean;
  context_notes: string[];
}

export interface MetaAnalysisResult {
  consensus_score: number;
  disagreement_level: 'low' | 'medium' | 'high';
  dominant_engines: string[];
  weak_assumptions: string[];
}

export interface CounterfactualResult {
  sensitivity: number; // 0-1, how much the score changes when features are removed
  critical_dependencies: string[]; // features that strongly drive the score
  fragile_assumptions: string[]; // features that are high impact but low confidence
}

export interface SelfCritique {
  assumptions_made: string[];
  what_might_be_wrong: string[];
  missing_information: string[];
}

// --- Conflict Resolution & Analyst Insight ---

export interface ConflictResolution {
  conflict_detected: boolean;
  primary_conflict: string | null;
  winning_signal: 'REPUTATION' | 'INTENT' | 'BEHAVIOR' | 'STRUCTURE' | 'NONE';
  reasoning: string;
  confidence_adjustment: number;
}

export interface AnalystFlags {
  reputation_abuse: boolean;
  high_fragility: boolean;
  conflicting_signals: boolean;
  requires_human_attention: boolean;
}

export interface AnalystInsight {
  analyst_summary: string;
  analyst_takeaways: string[];
  analyst_recommendation: string;
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
  cognitive_trace?: CognitiveTraceStep[];

  // Phase 3: Meta-Intelligence Fields
  confidence_level?: number;       // How sure the system is (updated definition)
  stability_score?: number;        // How stable the result is across scenarios
  uncertainty_flags?: string[];    // Why doubt exists
  self_critique?: SelfCritique;    // Mandatory self-reflection

  // Phase 4: Epistemic Intelligence
  analysis_quality?: {
    confidence_level: 'high' | 'medium' | 'low';
    stability_score: number;
    anomaly_flags: string[];
    judgment_notes: string[];
  };

  // New Explainability & Auditability
  signals: string[]; // specific signals detected
  why_it_matters: string[]; // context on importance

  summary: string;

  // Categorized intelligence
  features: Record<string, FeatureResult>;

  // Phase 5: Deep Intelligence Fields
  meta_judgment?: MetaJudgmentResult;
  semantic_intent?: SemanticIntentResult;
  fragility?: FragilityResult;
  contextual_verdict?: ContextualVerdict;
  risk_timeline?: RiskTimelineStage[];
  confidence_range?: ConfidenceRange;

  // Phase 1: Behavioral & Infrastructure
  behavioral_timeline?: BehavioralTimelineResult;
  infrastructure_intel?: InfrastructureIntelResult;

  // Phase 2: Campaign Correlation
  campaign_correlation?: CampaignCorrelationResult;

  // Phase 6: Conflict & Analyst Insight
  conflict_resolution?: ConflictResolution;
  analyst_flags?: AnalystFlags;
  analyst_insight?: AnalystInsight;

  // Explainability
  explanation: {
    primaryFactors: string[];
    technicalAnalysis: string;
    recommendedActions: string[];
    // Extended XAI fields
    summary?: string; // override root summary if needed
    positive_factors?: string[];
    negative_factors?: string[];
    weights?: Record<string, number>;
    reasoning_steps?: string[];
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
