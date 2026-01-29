import React from 'react';
import { Activity, AlertTriangle, ShieldCheck, Globe, Lock, Cpu } from 'lucide-react';

export const SecurityBriefing: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mt-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
      {/* Threat Level Card */}
      <div className="bg-surface/30 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600 transition-colors backdrop-blur-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <Activity className="text-orange-500" size={20} />
          </div>
          <span className="text-xs font-mono text-orange-400 bg-orange-500/10 px-2 py-1 rounded">ELEVATED</span>
        </div>
        <h3 className="text-slate-400 text-sm font-medium mb-1">Global Threat Level</h3>
        <p className="text-white font-semibold">Active Campaigns Detected</p>
        <p className="text-xs text-slate-500 mt-2">Increased phishing targeting finance sectors.</p>
      </div>

      {/* Tip Card */}
      <div className="bg-surface/30 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600 transition-colors backdrop-blur-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <ShieldCheck className="text-blue-500" size={20} />
          </div>
          <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-1 rounded">DAILY TIP</span>
        </div>
        <h3 className="text-slate-400 text-sm font-medium mb-1">Defense Tactic</h3>
        <p className="text-white font-semibold">Verify Sender Identity</p>
        <p className="text-xs text-slate-500 mt-2">Display names can be spoofed. Check the actual email address.</p>
      </div>

      {/* System Status Card */}
      <div className="bg-surface/30 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600 transition-colors backdrop-blur-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Cpu className="text-emerald-500" size={20} />
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">ONLINE</span>
        </div>
        <h3 className="text-slate-400 text-sm font-medium mb-1">System Status</h3>
        <p className="text-white font-semibold">Engines Operational</p>
        <p className="text-xs text-slate-500 mt-2">Updated 4 mins ago • Latency 42ms</p>
      </div>
    </div>
  );
};