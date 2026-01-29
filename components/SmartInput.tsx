import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, File, Globe, Mail, Hash, MessageSquare, Loader2, Link, Terminal, Minimize, Maximize, X } from 'lucide-react';
import { InputClassifier } from '../services/intelligence';
import { ClassificationResult, InputType } from '../types';

interface SmartInputProps {
  onAnalyze: (input: string, classification: ClassificationResult) => void;
  isAnalyzing: boolean;
  shouldFocus?: boolean;
}

export const SmartInput: React.FC<SmartInputProps> = ({ onAnalyze, isAnalyzing, shouldFocus }) => {
  const [value, setValue] = useState('');
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Real-time classification
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (value.length > 3) {
        const result = InputClassifier.classify(value);
        setClassification(result);
      } else {
        setClassification(null);
      }
    }, 150);
    return () => clearTimeout(timeout);
  }, [value]);

  // Handle focus request
  useEffect(() => {
    if (shouldFocus && textareaRef.current) {
        // Small delay to allow layout transition to start
        setTimeout(() => {
            textareaRef.current?.focus();
        }, 150);
    }
  }, [shouldFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && value.length > 0 && classification) {
      e.preventDefault();
      onAnalyze(value, classification);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto transition-all duration-500">
      {/* Code Window Container */}
      <div className="rounded-xl overflow-hidden shadow-2xl bg-[#1e1e1e] border border-slate-700/50 flex flex-col h-[400px]">
        
        {/* Window Header */}
        <div className="bg-[#2d2d2d] px-4 py-3 flex items-center justify-between border-b border-black/20">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
            <Terminal size={12} />
            <span>analysis_terminal — zsh</span>
          </div>
          <div className="w-12"></div> {/* Spacer for centering */}
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative bg-[#1e1e1e] p-6 font-mono text-sm">
            {/* Line Numbers */}
            <div className="absolute left-0 top-6 bottom-0 w-12 text-right pr-3 text-slate-600 select-none leading-relaxed">
                <div>1</div>
                <div>2</div>
                <div>3</div>
                <div>4</div>
                <div>5</div>
                <div>6</div>
                <div>7</div>
                <div>8</div>
            </div>

            {/* Input Area */}
            <div className="pl-8 h-full flex flex-col">
                <div className="text-slate-500 mb-2"># Enter threat artifact to analyze:</div>
                <div className="text-purple-400 mb-2">
                    <span className="text-blue-400">const</span> <span className="text-yellow-300">target</span> = <span className="text-white">Input</span>.<span className="text-blue-300">read</span>();
                </div>
                
                <div className="flex-1 relative group">
                    <span className="absolute left-0 top-4 text-pink-500 font-bold">{'>'}</span>
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isAnalyzing}
                        placeholder="// Paste URL, IP, or Text..."
                        className="w-full h-full bg-transparent text-slate-200 placeholder-slate-600 resize-none focus:outline-none pl-6 pt-3 leading-relaxed selection:bg-purple-500/30"
                        spellCheck={false}
                    />
                    
                    {/* Floating Submit Action within the code window */}
                    <div className="absolute bottom-4 right-2">
                        <button
                            onClick={() => classification && onAnalyze(value, classification)}
                            disabled={!value || isAnalyzing}
                            className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-sans font-bold text-xs uppercase tracking-wide
                            ${value 
                                ? 'bg-primary text-white hover:bg-fuchsia-400 shadow-lg shadow-fuchsia-500/20' 
                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
                            `}
                        >
                            {isAnalyzing ? (
                                <><Loader2 size={14} className="animate-spin" /> Processing</>
                            ) : (
                                <><ArrowRight size={14} /> Run Analysis</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Status Bar */}
        <div className="bg-[#007acc] text-white px-3 py-1 text-[10px] flex justify-between items-center font-sans">
            <div className="flex gap-4">
                <span>HEAD</span>
                <span>{classification ? `Detected: ${classification.type.toUpperCase()}` : 'Ready'}</span>
            </div>
            <div className="flex gap-4">
                <span>Ln 4, Col {value.length}</span>
                <span>UTF-8</span>
                <span>TypeScript</span>
            </div>
        </div>
      </div>
    </div>
  );
};