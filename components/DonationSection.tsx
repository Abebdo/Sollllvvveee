import React from 'react';
import { Coffee, Sparkles, ArrowRight, Heart } from 'lucide-react';

export const DonationSection: React.FC = () => {
  const handleDonate = () => {
    // Placeholder for PayPal integration
    // window.open('https://paypal.me/youraccount', '_blank');
    alert("Redirecting to secure donation gateway...");
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-6 mb-32 relative z-20 animate-fade-in">
      
      {/* 1. Ambient Background Glows (The "Aurora") */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[150%] bg-gradient-to-r from-violet-600/20 via-cyan-500/20 to-fuchsia-600/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>

      {/* 2. The Main Glass Card */}
      <div className="relative group">
        
        {/* Animated Border Gradient */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-cyan-400 rounded-[32px] opacity-75 blur-sm group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-shimmer"></div>
        
        <div className="relative bg-[#0b001a]/90 backdrop-blur-2xl rounded-[30px] p-8 md:p-12 border border-white/10 overflow-hidden">
          
          {/* Inner Decorative Noise Texture */}
          <div className="absolute inset-0 opacity-[0.03] bg-white pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
            
            {/* Left Content */}
            <div className="flex-1 text-center md:text-left space-y-6">
              
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-cyan-300 text-xs font-bold uppercase tracking-widest shadow-lg shadow-cyan-500/10">
                <Sparkles size={12} className="text-cyan-400" />
                <span>Fuel the Intelligence</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1]">
                Enjoying <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">the Power?</span>
              </h2>

              <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-md">
                Solveya is free for everyone. If we helped you solve a case today, consider buying us a coffee.
              </p>

              <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-4">
                <button 
                  onClick={handleDonate}
                  className="group relative px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5 transition-all overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Heart size={18} className="fill-white/20" /> Support Us
                  </span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
                
                <div className="flex items-center gap-2">
                    {[5, 15].map((amount) => (
                    <button 
                        key={amount}
                        onClick={handleDonate}
                        className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 font-semibold hover:bg-white/10 hover:border-cyan-500/50 hover:text-cyan-400 transition-all active:scale-95 text-sm"
                    >
                        ${amount}
                    </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Right Visual - Holographic Coffee */}
            <div className="relative flex-shrink-0 mt-6 md:mt-0">
               {/* Glowing Orb Background behind cup */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500 rounded-full blur-[80px] opacity-30 animate-pulse"></div>
               
               {/* The 3D-ish Container */}
               <div 
                 onClick={handleDonate}
                 className="relative w-48 h-48 md:w-56 md:h-56 bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-full flex items-center justify-center shadow-2xl cursor-pointer group/icon hover:scale-105 transition-transform duration-500 backdrop-blur-md"
               >
                  <div className="absolute inset-4 rounded-full border border-white/5"></div>
                  
                  {/* Floating Icon */}
                  <div className="relative">
                    <Coffee 
                        size={80} 
                        strokeWidth={1}
                        className="text-white drop-shadow-[0_0_25px_rgba(34,211,238,0.6)] transform group-hover/icon:rotate-6 transition-transform duration-500" 
                    />
                    
                    {/* Floating particles */}
                    <div className="absolute -top-4 -right-2 w-2 h-2 bg-cyan-400 rounded-full animate-bounce opacity-80 shadow-[0_0_10px_cyan]"></div>
                    <div className="absolute top-0 -left-2 w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping opacity-60" style={{ animationDuration: '3s' }}></div>
                  </div>

                  {/* Button Overlay on Hover */}
                  <div className="absolute -bottom-4 bg-white text-black px-5 py-1.5 rounded-full font-bold text-xs shadow-lg shadow-white/20 flex items-center gap-2 transform translate-y-4 opacity-0 group-hover/icon:opacity-100 group-hover/icon:translate-y-0 transition-all duration-300">
                    Donate <ArrowRight size={12} />
                  </div>
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};