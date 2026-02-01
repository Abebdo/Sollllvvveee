import { FeatureResult } from '../types';

export interface EngineResult {
  name: string;
  confidence: number; // 0.0 - 1.0
  score: number; // 0 - 100
  signals: string[]; // List of signal IDs
  features: FeatureResult[]; // Detailed feature objects
  summary?: string;
  explanation?: string;
}
