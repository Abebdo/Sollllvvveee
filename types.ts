export type InputType = 'url' | 'ip' | 'email' | 'hash' | 'domain' | 'file' | 'message' | 'ambiguous';
export type RiskLevel = 'Minimal' | 'Low' | 'Medium' | 'High' | 'Critical';

export interface ClassificationResult {
  type: InputType;
  confidence: number;
}

export interface RiskArgument {
  description: string;
  direction: 'for' | 'against' | 'neutral';
  confidence: number; // 0.0 to 1.0
}

export interface UncertaintyProfile {
  confidence_percentage: number;
  confidence_range?: { min: number; max: number };
  known_unknowns: string[];
  suggested_verification: string[];
}

export interface RiskAssessment {
  risk_level: RiskLevel;
  primary_hypothesis: string;
  summary: string;
  uncertainty: UncertaintyProfile;
  key_factors: RiskArgument[];
  recommended_action: string;
  technical_signals: { name: string; value: string; detected: boolean }[];
  fragility?: { level: 'LOW' | 'MEDIUM' | 'HIGH'; reasons: string[] };
}

export interface AnalysisStep {
  id: number;
  label: string;
  duration: number; // ms
}

export enum ModelType {
  FLASH = 'gemini-3-flash-preview',
  PRO = 'gemini-3-pro-preview',
}

export type ViewType = 'dashboard' | 'chat' | 'settings';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
}