import React from 'react';
import { RiskAssessment } from '../types';
import { Activity, Zap } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { RiskBadge } from './RiskBadge';
import { ConfidenceMeter } from './ConfidenceMeter';
import { ExplanationCard } from './ExplanationCard';
import { cn } from '../lib/utils';

interface RiskDisplayProps {
  assessment: RiskAssessment;
  onReset: () => void;
}

export const RiskDisplay: React.FC<RiskDisplayProps> = ({ assessment, onReset }) => {
  return (
    <div className="w-full max-w-5xl mx-auto pb-20 animate-slide-up">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Result Column */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Assessment Card */}
          <Card variant="elevated" padding="lg" className="relative overflow-hidden">
             {/* Dynamic Background Gradient based on Risk */}
            <div className={cn(
                "absolute top-0 right-0 w-96 h-96 bg-gradient-to-br blur-3xl rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none opacity-20",
                assessment.risk_level === 'Critical' ? 'from-risk-critical to-transparent' :
                assessment.risk_level === 'High' ? 'from-risk-high to-transparent' :
                assessment.risk_level === 'Medium' ? 'from-risk-medium to-transparent' :
                'from-risk-minimal to-transparent'
            )} />
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <RiskBadge level={assessment.risk_level} className="text-sm px-4 py-1.5" showIcon animate={assessment.risk_level === 'Critical'} />
              </div>
              
              <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
                {assessment.primary_hypothesis}
              </h1>
              <p className="text-lg text-slate-300 leading-relaxed mb-8">
                {assessment.summary}
              </p>

              <ConfidenceMeter
                percentage={assessment.uncertainty.confidence_percentage}
                range={assessment.uncertainty.confidence_range}
                className="bg-background/50 p-4 rounded-xl border border-slate-700/50"
              />

              {assessment.fragility && (
                <div className="mt-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                   <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Fragility</span>
                      <span className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded",
                          assessment.fragility.level === 'HIGH' ? "bg-risk-critical/20 text-risk-critical" :
                          assessment.fragility.level === 'MEDIUM' ? "bg-risk-medium/20 text-risk-medium" :
                          "bg-primary/20 text-primary"
                      )}>
                          {assessment.fragility.level}
                      </span>
                   </div>
                   <p className="text-sm text-slate-300">
                      Reason: {assessment.fragility.reasons[0] || "Analysis is stable."}
                   </p>
                </div>
              )}
            </div>
          </Card>

          {/* Evidence Factors */}
          <Card>
            <div className="flex items-center gap-2 mb-6">
               <Activity className="text-slate-400" size={18} />
               <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Key Risk Factors</h3>
            </div>
            
            <div className="space-y-3">
              {assessment.key_factors.length > 0 ? (
                 assessment.key_factors.map((factor, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-background/50 border border-slate-800 hover:border-slate-700 transition-colors">
                        <div className={cn("mt-1.5 w-2 h-2 rounded-full", factor.direction === 'for' ? 'bg-risk-high shadow-lg shadow-orange-500/50' : 'bg-risk-low')} />
                        <div>
                          <p className="text-slate-200 font-medium">{factor.description}</p>
                          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">
                            Impact: {factor.direction === 'for' ? 'Escalating' : 'Mitigating'}
                          </p>
                        </div>
                    </div>
                 ))
              ) : (
                  <div className="text-slate-500 italic p-4">No specific threat signatures detected.</div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Action Panel */}
          <div className="bg-gradient-to-br from-surface to-slate-900 border border-slate-700 rounded-2xl p-6 shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="text-primary text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <Zap size={16} /> Recommended Action
            </h3>
            <p className="text-white font-medium leading-relaxed relative z-10">
              {assessment.recommended_action}
            </p>
          </div>

          {/* Technical Signals */}
          <ExplanationCard title="Technical Signals" type="technical" defaultExpanded expandable>
            <div className="space-y-4 pt-2">
              {assessment.technical_signals.map((signal, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
                  <span className="text-slate-400 font-medium">{signal.name}</span>
                  <span className={cn("font-mono text-xs px-2 py-1 rounded", signal.detected ? 'bg-risk-high/10 text-risk-high' : 'bg-risk-low/10 text-risk-low')}>
                    {signal.value}
                  </span>
                </div>
              ))}
            </div>
          </ExplanationCard>

          {/* Analysis Limitations */}
           {assessment.uncertainty.known_unknowns.length > 0 && (
            <ExplanationCard title="Limitations" type="warning" expandable>
               <ul className="space-y-2 mt-2">
                {assessment.uncertainty.known_unknowns.map((u, i) => (
                    <li key={i} className="text-amber-200/70 flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 bg-amber-500 rounded-full flex-shrink-0"/>
                      {u}
                    </li>
                ))}
              </ul>
            </ExplanationCard>
          )}

          <Button 
            onClick={onReset}
            variant="secondary"
            size="lg"
            className="w-full h-16 text-lg hover:border-primary hover:text-white"
          >
            Analyze New Artifact
          </Button>
        </div>
      </div>
    </div>
  );
};