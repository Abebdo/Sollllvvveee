import { ArtifactType } from './types';

export type SignalSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface Signal {
  id: string;
  name: string;
  severity: SignalSeverity;
  score_contribution: number; // 0-100
  description: string;
  metadata?: Record<string, any>;
}

export interface Verification {
  check: string; // e.g., "entropy_calculated", "dns_resolved"
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  evidence: any; // Concrete value: e.g., entropy value, IP address
  timestamp: string;
}

export interface EngineResult {
  engine: string;
  executed: boolean;
  error?: string; // If failed/degraded
  signals: Signal[]; // RISK signals (Suspicious only)
  verification: Verification[]; // MANDATORY proof of work
  confidenceImpact: number; // 0.0 - 1.0 (How much this engine adds to certainty)
  metadata: Record<string, any>;
}

export interface EngineConfig {
    enabled: boolean;
    timeoutMs: number;
    weight: number;
}

export type EngineFunction = (artifact: string, type: ArtifactType, context?: any) => Promise<EngineResult>;
