import React from 'react';
import { AnalysisStep } from '../types';
import { CheckCircle2, Loader2, Circle, Activity } from 'lucide-react';

interface AnalysisProgressProps {
  currentStep: number;
  steps: AnalysisStep[];
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ currentStep, steps }) => {
  return (
    <div className="w-full max-w-md mx-auto space-y-3 animate-fade-in">
      {steps.map((step, index) => {
        const isActive = currentStep === index;
        const isCompleted = currentStep > index;
        const isPending = currentStep < index;

        return (
          <div 
            key={step.id}
            className={`
              relative overflow-hidden rounded-xl border p-4 transition-all duration-300
              ${isActive 
                ? 'bg-surface border-primary/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
                : isCompleted ? 'bg-surface/50 border-transparent' : 'bg-transparent border-transparent opacity-50'}
            `}
          >
            {/* Active Step Progress Bar Background (Spec 2.5) */}
            {isActive && (
               <div className="absolute bottom-0 left-0 h-0.5 w-full bg-slate-800">
                 <div className="h-full w-full bg-gradient-to-r from-primary to-secondary animate-data-flow" 
                      style={{ backgroundSize: '200% 100%' }} />
               </div>
            )}

            <div className="flex items-center gap-4 relative z-10">
              <div className="flex-shrink-0 w-6">
                {isCompleted ? (
                  <CheckCircle2 className="text-risk-minimal" size={20} />
                ) : isActive ? (
                  <Loader2 className="text-primary animate-spin" size={20} />
                ) : (
                  <Circle className="text-slate-600" size={20} />
                )}
              </div>
              
              <div className="flex-1">
                <span className={`text-sm font-semibold tracking-wide ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>

              {isActive && (
                  <span className="text-xs text-primary font-mono animate-pulse flex items-center gap-1">
                    <Activity size={12} /> PROCESSING
                  </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};