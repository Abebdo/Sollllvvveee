import React from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Github, MessageSquare, Users, Globe, GitCommit, Heart } from 'lucide-react';

interface CommunityViewProps {
    onStartAnalysis: () => void;
}

export const CommunityView: React.FC<CommunityViewProps> = ({ onStartAnalysis }) => {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-12 pb-20 animate-fade-in">
       
       <div className="relative mb-20">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 blur-3xl rounded-full pointer-events-none"></div>
          <div className="relative text-center space-y-6">
            <span className="inline-block px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-bold tracking-wider uppercase mb-4">
                The Hive Mind
            </span>
            <h1 className="text-6xl font-black text-white tracking-tighter">
                Join the <br/>
                Global <span className="text-purple-500">Intelligence</span>
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                Solveya is powered by a network of 5,000+ security researchers, white hat hackers, and engineers.
            </p>
            
            <div className="pt-4">
               <button 
                 onClick={onStartAnalysis}
                 className="bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold py-3 px-12 rounded-xl backdrop-blur-md transition-all shadow-xl hover:scale-105"
               >
                 Start Analyzing
               </button>
            </div>
          </div>
       </div>

       {/* Stats Grid */}
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {[
              { label: "Active Nodes", value: "12,403", icon: Globe, color: "text-blue-400" },
              { label: "Contributors", value: "842", icon: Users, color: "text-green-400" },
              { label: "Threats Blocked", value: "9.2M+", icon: GitCommit, color: "text-red-400" },
              { label: "GitHub Stars", value: "1.4k", icon: Heart, color: "text-yellow-400" },
          ].map((stat, i) => (
              <div key={i} className="bg-surface/50 border border-slate-700/50 p-6 rounded-2xl text-center backdrop-blur-sm hover:bg-surface transition-colors">
                  <stat.icon className={`mx-auto mb-3 ${stat.color}`} size={24} />
                  <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                  <div className="text-sm text-slate-500 font-medium">{stat.label}</div>
              </div>
          ))}
       </div>

       {/* Contributors */}
       <div className="bg-[#180a2e] border border-slate-800 rounded-3xl p-8 md:p-12 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
           
           <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
               <div className="text-center md:text-left">
                   <h2 className="text-3xl font-bold text-white mb-4">Top Contributors</h2>
                   <p className="text-slate-400 max-w-md">
                       Special thanks to the architects who committed code this week.
                   </p>
               </div>
               
               <div className="flex -space-x-4">
                   {[1,2,3,4,5].map((i) => (
                       <div key={i} className="w-14 h-14 rounded-full border-2 border-[#180a2e] bg-slate-700 flex items-center justify-center overflow-hidden hover:scale-110 hover:z-10 transition-transform cursor-pointer relative group">
                           <img src={`https://i.pravatar.cc/150?u=${i + 20}`} alt="Contributor" className="w-full h-full object-cover" />
                           <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                       </div>
                   ))}
                   <div className="w-14 h-14 rounded-full border-2 border-[#180a2e] bg-slate-800 flex items-center justify-center text-white font-bold text-sm hover:bg-slate-700 transition-colors cursor-pointer">
                       +42
                   </div>
               </div>
           </div>
       </div>

    </div>
  );
};