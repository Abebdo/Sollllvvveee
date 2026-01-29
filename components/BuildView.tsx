import React from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Code, Box, Layers, Zap, ArrowRight, Cpu, Terminal } from 'lucide-react';

export const BuildView: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-12 pb-20 animate-fade-in">
      <div className="text-center mb-16 space-y-4">
        <h1 className="text-5xl font-black text-white tracking-tight">
          Construct Your <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Defense Matrix</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          Define threat logic, automate responses, and deploy smart defense contracts using our TypeScript-native SDK.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
        <div className="space-y-8">
            <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <Code className="text-blue-400" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white mb-2">Declarative Rules</h3>
                    <p className="text-slate-400 leading-relaxed">
                        Write detection logic in plain TypeScript. No proprietary query languages to learn. Full type safety included.
                    </p>
                </div>
            </div>
            <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <Cpu className="text-purple-400" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white mb-2">Edge Deployment</h3>
                    <p className="text-slate-400 leading-relaxed">
                        Push your contracts to the edge. Solveya nodes execute your logic with <span className="text-white font-mono bg-white/10 px-1 rounded">~4ms</span> latency.
                    </p>
                </div>
            </div>
            <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
                    <Layers className="text-pink-400" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white mb-2">Multi-Modal Ingestion</h3>
                    <p className="text-slate-400 leading-relaxed">
                        Analyze logs, network traffic, email bodies, and file hashes simultaneously in a single contract.
                    </p>
                </div>
            </div>
            
            {/* Button removed as requested */}
        </div>

        {/* Code Visual */}
        <div className="relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-20 blur-xl group-hover:opacity-30 transition-opacity"></div>
            <div className="bg-[#0b001a] border border-slate-700 rounded-xl overflow-hidden shadow-2xl relative">
                <div className="bg-[#1e1e1e] px-4 py-2 border-b border-white/5 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">defend_api.ts</span>
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                    </div>
                </div>
                <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto">
                    <div className="text-slate-500">// Import the Defense Kit</div>
                    <div className="text-pink-400">import <span className="text-white">{'{'} Contract, Rule {'}'}</span> from <span className="text-green-400">'@solveya/sdk'</span>;</div>
                    <br />
                    <div className="text-blue-400">export const <span className="text-yellow-300">ApiGuard</span> = <span className="text-blue-400">new</span> <span className="text-yellow-300">Contract</span>({'{'}</div>
                    <div className="pl-4 text-white">name: <span className="text-green-400">'SQL Injection Block'</span>,</div>
                    <div className="pl-4 text-white">target: <span className="text-green-400">'http.request'</span>,</div>
                    <div className="pl-4 text-blue-400">rules: [</div>
                    <div className="pl-8 text-white">Rule.<span className="text-blue-300">matchPattern</span>(<span className="text-green-400">/UNION SELECT/i</span>)</div>
                    <div className="pl-12 text-white">.<span className="text-blue-300">then</span>(Action.<span className="text-red-400">BLOCK</span>)</div>
                    <div className="pl-12 text-white">.<span className="text-blue-300">alert</span>(<span className="text-green-400">'security-team-slack'</span>)</div>
                    <div className="pl-4 text-blue-400">]</div>
                    <div className="text-blue-400">{'}'});</div>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['Access Control', 'Fraud Detection', 'Data Loss Prevention'].map((item, i) => (
             <div key={i} className="bg-surface border border-slate-800 p-6 rounded-xl hover:border-slate-600 transition-colors cursor-pointer group">
                 <div className="flex justify-between items-start mb-4">
                    <Box className="text-slate-500 group-hover:text-white transition-colors" />
                    <ArrowRight className="text-slate-700 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-x-1" size={16} />
                 </div>
                 <h4 className="font-bold text-white text-lg">{item}</h4>
                 <p className="text-slate-500 text-sm mt-2">Pre-built templates to secure your infrastructure in minutes.</p>
             </div>
          ))}
      </div>
    </div>
  );
};