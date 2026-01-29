import React from 'react';
import { Search, Book, Code, Shield, ChevronRight } from 'lucide-react';

export const DocsView: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-8 pb-20 animate-fade-in min-h-screen flex gap-10">
       
       {/* Sidebar - Hidden on mobile */}
       <aside className="hidden lg:block w-64 flex-shrink-0 sticky top-24 h-fit">
           <div className="relative mb-6">
               <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
               <input 
                 type="text" 
                 placeholder="Search docs..." 
                 className="w-full bg-surface border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
               />
           </div>

           <div className="space-y-6">
               <div>
                   <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Getting Started</h4>
                   <ul className="space-y-1">
                       <li className="text-blue-400 font-medium border-l-2 border-blue-400 pl-4 py-1 cursor-pointer">Introduction</li>
                       <li className="text-slate-400 hover:text-white pl-4 py-1 cursor-pointer transition-colors border-l-2 border-transparent hover:border-slate-700">Installation</li>
                       <li className="text-slate-400 hover:text-white pl-4 py-1 cursor-pointer transition-colors border-l-2 border-transparent hover:border-slate-700">Quick Start</li>
                   </ul>
               </div>
               <div>
                   <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Core Concepts</h4>
                   <ul className="space-y-1">
                       <li className="text-slate-400 hover:text-white pl-4 py-1 cursor-pointer transition-colors border-l-2 border-transparent hover:border-slate-700">Risk Scoring</li>
                       <li className="text-slate-400 hover:text-white pl-4 py-1 cursor-pointer transition-colors border-l-2 border-transparent hover:border-slate-700">Threat Models</li>
                       <li className="text-slate-400 hover:text-white pl-4 py-1 cursor-pointer transition-colors border-l-2 border-transparent hover:border-slate-700">Defense Contracts</li>
                   </ul>
               </div>
               <div>
                   <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">API Reference</h4>
                   <ul className="space-y-1">
                       <li className="text-slate-400 hover:text-white pl-4 py-1 cursor-pointer transition-colors border-l-2 border-transparent hover:border-slate-700">Authentication</li>
                       <li className="text-slate-400 hover:text-white pl-4 py-1 cursor-pointer transition-colors border-l-2 border-transparent hover:border-slate-700">Endpoints</li>
                   </ul>
               </div>
           </div>
       </aside>

       {/* Main Content */}
       <div className="flex-1">
           <div className="mb-8 pb-8 border-b border-slate-800">
               <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                   <span>Docs</span>
                   <ChevronRight size={14} />
                   <span>Getting Started</span>
                   <ChevronRight size={14} />
                   <span className="text-white">Introduction</span>
               </div>
               <h1 className="text-4xl font-bold text-white mb-4">Introduction to Solveya</h1>
               <p className="text-lg text-slate-400 leading-relaxed">
                   Solveya is a programmable cyber-intelligence platform designed to not just detect threats, but explain them.
               </p>
           </div>

           <div className="space-y-12">
               <section>
                   <h2 className="text-2xl font-bold text-white mb-4">Why Solveya?</h2>
                   <p className="text-slate-400 leading-relaxed mb-6">
                       Traditional security tools act as "black boxes"—they block a request and give you a generic error code. 
                       Solveya uses a heuristic engine combined with LLM-based reasoning to provide a 
                       <span className="text-white font-semibold"> detailed risk assessment </span> 
                       and a <span className="text-white font-semibold">confidence score</span>.
                   </p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="bg-surface border border-slate-700 p-5 rounded-xl">
                           <Shield className="text-blue-400 mb-3" />
                           <h3 className="text-white font-bold mb-2">Determinism + AI</h3>
                           <p className="text-sm text-slate-400">Combines regex-based speed with transformer-based context awareness.</p>
                       </div>
                       <div className="bg-surface border border-slate-700 p-5 rounded-xl">
                           <Book className="text-purple-400 mb-3" />
                           <h3 className="text-white font-bold mb-2">Self-Documenting</h3>
                           <p className="text-sm text-slate-400">Every decision comes with a generated explanation in plain English.</p>
                       </div>
                   </div>
               </section>

               <section>
                   <h2 className="text-2xl font-bold text-white mb-4">Basic Usage</h2>
                   <p className="text-slate-400 mb-4">
                       To analyze a threat artifact, simply pass the string to the <code className="bg-slate-800 px-1.5 py-0.5 rounded text-blue-300 text-sm">RiskEngine.assess()</code> method.
                   </p>
                   <div className="bg-[#1e1e1e] border border-slate-700 rounded-xl overflow-hidden">
                       <div className="bg-[#2d2d2d] px-4 py-2 border-b border-black/20 flex items-center justify-between">
                           <span className="text-xs text-slate-400">example.ts</span>
                           <Code size={14} className="text-slate-500" />
                       </div>
                       <div className="p-4 font-mono text-sm text-slate-300">
                           <div><span className="text-pink-400">import</span> {'{'} RiskEngine {'}'} <span className="text-pink-400">from</span> <span className="text-green-400">'@solveya/engine'</span>;</div>
                           <br/>
                           <div><span className="text-slate-500">// Analyze a suspicious URL</span></div>
                           <div><span className="text-blue-400">const</span> result = RiskEngine.assess(<span className="text-green-400">'http://paypa1-secure.com'</span>, <span className="text-green-400">'url'</span>);</div>
                           <br/>
                           <div>console.log(result.risk_level); <span className="text-slate-500">// "High"</span></div>
                           <div>console.log(result.primary_hypothesis); <span className="text-slate-500">// "Credential Harvesting"</span></div>
                       </div>
                   </div>
               </section>
           </div>
       </div>

    </div>
  );
};