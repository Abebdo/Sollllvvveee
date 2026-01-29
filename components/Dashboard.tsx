import React from 'react';
import { ViewType } from '../types';
import { MessageSquare, Zap, Sparkles, Code, ArrowRight } from 'lucide-react';

interface DashboardProps {
  onViewChange: (view: ViewType) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
  const features = [
    {
      title: "Chat Assistant",
      description: "Engage in fluid, natural conversations with context awareness.",
      icon: MessageSquare,
      view: 'chat',
      color: "from-blue-500 to-cyan-500"
    },
    {
        title: "Code Generation",
        description: "Generate robust code snippets in Python, TypeScript, and more.",
        icon: Code,
        view: 'chat',
        color: "from-purple-500 to-pink-500"
    },
    {
        title: "Deep Reasoning",
        description: "Solve complex problems with step-by-step logical breakdown.",
        icon: Sparkles,
        view: 'chat',
        color: "from-amber-400 to-orange-500"
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-12 animate-fade-in">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Hero Section */}
        <div className="space-y-6 text-center lg:text-left py-10">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4">
            <Zap size={14} className="mr-2" fill="currentColor" />
            Powered by Gemini 3 Flash
          </div>
          <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-4">
            Welcome to <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400">Nova</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl leading-relaxed">
            Your all-in-one AI workspace. Experience the next generation of multimodal AI interactions with lightning-fast responses.
          </p>
          <div className="flex flex-wrap gap-4 justify-center lg:justify-start pt-4">
            <button 
                onClick={() => onViewChange('chat')}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/25 transition-all transform hover:-translate-y-1 flex items-center"
            >
                Start Chatting <ArrowRight size={20} className="ml-2" />
            </button>
            <button 
                className="px-8 py-4 bg-surface border border-slate-700 hover:bg-slate-800 text-slate-200 rounded-xl font-semibold transition-all"
            >
                View Documentation
            </button>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <div 
                key={idx}
                onClick={() => onViewChange(feature.view as ViewType)}
                className="group relative bg-surface border border-slate-800 rounded-2xl p-6 hover:border-slate-600 transition-all cursor-pointer overflow-hidden"
            >
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${feature.color} opacity-10 blur-2xl rounded-bl-full transition-opacity group-hover:opacity-20`} />
                
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 shadow-lg`}>
                    <feature.icon className="text-white" size={24} />
                </div>
                
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed mb-6">
                    {feature.description}
                </p>
                
                <div className="flex items-center text-sm font-medium text-slate-500 group-hover:text-slate-300 transition-colors">
                    Try now <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
            </div>
          ))}
        </div>
        
        {/* Footer info */}
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between text-slate-500 text-sm">
            <p>&copy; {new Date().getFullYear()} Nova Workspace.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
                <a href="#" className="hover:text-slate-300">Privacy Policy</a>
                <a href="#" className="hover:text-slate-300">Terms of Service</a>
            </div>
        </div>
      </div>
    </div>
  );
};