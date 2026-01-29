import React, { useState } from 'react';
import { SmartInput } from './SmartInput';
import { AnalysisProgress } from './AnalysisProgress';
import { RiskDisplay } from './RiskDisplay';
import { SecurityBriefing } from './SecurityBriefing';
import { ClassificationResult, RiskAssessment, AnalysisStep } from '../types';
import { RiskEngine } from '../services/intelligence';
import { Shield, Star, PlayCircle, ArrowLeft } from 'lucide-react';
import { Button } from './ui/Button';

const ANALYSIS_STEPS: AnalysisStep[] = [
  { id: 0, label: "Ingesting Artifact...", duration: 800 },
  { id: 1, label: "Classifying Data Type...", duration: 500 },
  { id: 2, label: "Running Heuristic Analysis...", duration: 1000 },
  { id: 3, label: "Cross-Referencing Threat Intel...", duration: 1500 },
  { id: 4, label: "Correlating Risk Factors...", duration: 1000 },
  { id: 5, label: "Synthesizing Final Assessment...", duration: 600 },
];

interface AnalyzerViewProps {
  focused: boolean;
  setFocused: (focused: boolean) => void;
}

export const AnalyzerView: React.FC<AnalyzerViewProps> = ({ focused, setFocused }) => {
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'complete'>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);

  const handleAnalyze = async (input: string, classification: ClassificationResult) => {
    setStatus('analyzing');
    setCurrentStep(0);

    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      setCurrentStep(i);
      await new Promise(resolve => setTimeout(resolve, ANALYSIS_STEPS[i].duration));
    }

    const result = RiskEngine.assess(input, classification.type);
    setAssessment(result);
    setStatus('complete');
  };

  const reset = () => {
    setStatus('idle');
    setAssessment(null);
    setCurrentStep(0);
    setFocused(false);
  };

  const handleStartAnalysis = () => {
    setFocused(true);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 pt-12 md:pt-20 pb-20 animate-fade-in">
      
      {status === 'idle' && (
        <div className={`grid grid-cols-1 ${focused ? 'lg:grid-cols-1' : 'lg:grid-cols-2'} gap-12 items-center transition-all duration-700 ease-in-out min-h-[600px]`}>
          
          {/* Left Column: Text Content - Hides in Focus Mode */}
          <div className={`space-y-8 ${focused ? 'hidden lg:hidden' : 'animate-slide-up'}`}>
            
            {/* Star Badge */}
            <div className="inline-flex items-center gap-2 text-yellow-400 font-bold text-sm animate-fade-in">
              <Star size={16} fill="currentColor" />
              <span>1.4k+ stars on GitHub!</span>
            </div>

            {/* Headlines */}
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-[1.1] tracking-tight">
                Build Cyber <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">Resilience.</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-300 max-w-lg leading-relaxed font-medium">
                Explain the threat, not just detect it. Build, test, and deploy smart defense contracts with Solveya.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 pt-4">
              <Button 
                onClick={handleStartAnalysis}
                className="bg-btn-gradient text-white border-0 px-8 py-4 rounded-xl font-bold text-lg shadow-glow-purple hover:scale-105 transition-transform"
              >
                Start Analyzing
              </Button>
              <Button 
                variant="secondary"
                onClick={handleStartAnalysis}
                className="bg-surface/50 border-2 border-slate-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 hover:border-slate-500"
                rightIcon={<PlayCircle size={18} />}
              >
                View Demo
              </Button>
            </div>
          </div>

          {/* Right Column: Code Window / Input - Centers in Focus Mode */}
          <div className={`relative transition-all duration-700 ${focused ? 'w-full max-w-4xl mx-auto transform -translate-y-4' : 'animate-float mt-10 lg:mt-0'}`}>
             {/* Decorative "Tentacles" / Glow behind */}
             <div className={`absolute -inset-10 bg-gradient-to-tr from-violet-600/30 to-fuchsia-600/30 blur-3xl rounded-full opacity-60 transition-all duration-700 ${focused ? 'opacity-20' : ''}`}></div>
             
             {/* The "Code Window" containing SmartInput */}
             <div className={`relative transition-all duration-700 ${!focused && 'transform rotate-1 hover:rotate-0'}`}>
               <SmartInput 
                  onAnalyze={handleAnalyze} 
                  isAnalyzing={false} 
                  shouldFocus={focused}
               />
               
               {/* Floating Badge */}
               <div className="absolute -bottom-6 -right-6 bg-white text-black px-4 py-2 rounded-xl font-bold shadow-xl flex items-center gap-2 animate-bounce" style={{ animationDuration: '3s' }}>
                  <Shield size={20} className="text-primary" fill="currentColor" />
                  <span>Solveya AI</span>
               </div>
             </div>

              {/* Back Button (Only when focused) */}
             {focused && (
                 <div className="absolute -top-12 left-0 animate-fade-in">
                      <button onClick={() => setFocused(false)} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-semibold transition-colors group">
                          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Overview
                      </button>
                 </div>
             )}
          </div>

        </div>
      )}

      {/* ANALYZING STATE */}
      {status === 'analyzing' && (
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center space-y-12 py-20 animate-fade-in">
          <div className="text-center space-y-4">
             <div className="w-20 h-20 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow-purple animate-spin">
               <Shield className="text-primary" size={40} />
             </div>
             <h3 className="text-3xl font-bold text-white tracking-tight">Deconstructing Artifact</h3>
             <p className="text-slate-400 text-lg">Solveya Engine is parsing the threat vectors...</p>
          </div>
          <AnalysisProgress currentStep={currentStep} steps={ANALYSIS_STEPS} />
        </div>
      )}

      {/* COMPLETE STATE */}
      {status === 'complete' && assessment && (
        <div className="pt-10">
          <RiskDisplay assessment={assessment} onReset={reset} />
        </div>
      )}

      {/* Briefing Section (Only on Idle and NOT focused) */}
      {status === 'idle' && !focused && (
         <div className="mt-20">
            <SecurityBriefing />
         </div>
      )}
    </div>
  );
};