import React, { useState } from 'react';
import { DonationSection } from './components/DonationSection';
import { Menu, X } from 'lucide-react';
import { AnalyzerView } from './components/AnalyzerView';
import { CommunityView } from './components/CommunityView';
import { DocsView } from './components/DocsView';

type ViewPage = 'home' | 'community' | 'docs';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewPage>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAnalyzerFocused, setIsAnalyzerFocused] = useState(false);

  const navItems = [
    { id: 'community', label: 'Community' },
    { id: 'docs', label: 'Documentation' },
  ];

  const handleNavClick = (view: ViewPage) => {
    setCurrentView(view);
    setIsAnalyzerFocused(false);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartAnalysis = () => {
    setCurrentView('home');
    setIsAnalyzerFocused(true);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden selection:bg-primary selection:text-white flex flex-col">
      
      {/* Background Elements */}
      <div className="stars"></div>
      <div className="fixed inset-0 bg-hero-glow pointer-events-none z-0"></div>

      {/* Navbar */}
      <header className="w-full relative z-50 pt-6 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => handleNavClick('home')}>
            <div className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
               solveya<span className="text-primary text-3xl group-hover:animate-pulse">.</span>
            </div>
            <div className="hidden md:flex items-center text-[10px] text-slate-400 font-mono border-l border-slate-700 pl-3 ml-3">
              Powered by<br/><span className="text-white font-bold ml-1">Solveya Engine</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 font-semibold text-slate-300">
             {navItems.map((item) => (
               <button 
                 key={item.id}
                 onClick={() => handleNavClick(item.id as ViewPage)}
                 className={`transition-colors hover:text-white ${currentView === item.id ? 'text-white border-b-2 border-primary' : ''}`}
               >
                 {item.label}
               </button>
             ))}
          </nav>

          {/* CTA Button */}
          <div className="hidden md:block">
            <button 
                onClick={handleStartAnalysis}
                className="bg-white text-black px-6 py-2.5 rounded-full font-bold hover:bg-slate-200 transition-colors shadow-lg shadow-white/10"
            >
              Start Analyzing
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden text-white cursor-pointer" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen && (
            <div className="md:hidden absolute top-20 left-0 w-full bg-[#0b001a] border-b border-slate-800 p-6 z-50 animate-slide-up shadow-2xl">
                <nav className="flex flex-col gap-4 text-lg font-semibold text-slate-300">
                    <button onClick={() => handleNavClick('home')} className="text-left hover:text-white">Home</button>
                    {navItems.map((item) => (
                        <button 
                            key={item.id}
                            onClick={() => handleNavClick(item.id as ViewPage)}
                            className={`text-left hover:text-white ${currentView === item.id ? 'text-primary' : ''}`}
                        >
                            {item.label}
                        </button>
                    ))}
                    <button onClick={handleStartAnalysis} className="bg-white text-black px-6 py-3 rounded-xl font-bold mt-4">
                        Start Analyzing
                    </button>
                </nav>
            </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full flex-1">
        
        {currentView === 'home' && (
            <AnalyzerView 
                focused={isAnalyzerFocused} 
                setFocused={setIsAnalyzerFocused} 
            />
        )}
        {currentView === 'community' && <CommunityView onStartAnalysis={handleStartAnalysis} />}
        {currentView === 'docs' && <DocsView />}

      </main>

       {/* Donation Section (Global) */}
       <div className="w-full relative z-10 mt-10">
         <DonationSection />
       </div>

      {/* Footer */}
      <footer className="w-full border-t border-white/10 bg-[#050010] py-12 relative z-10 mt-auto">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-slate-500">
            <div className="mb-4 md:mb-0">
               <span className="font-bold text-white text-lg">solveya.</span>
               <p className="text-xs mt-1">© 2024 Cyber-Intelligence Platform</p>
            </div>
            <div className="flex gap-8 text-sm font-medium">
              <button onClick={() => handleNavClick('docs')} className="hover:text-primary transition-colors">Documentation</button>
              <button onClick={() => handleNavClick('community')} className="hover:text-primary transition-colors">GitHub</button>
              <button onClick={() => handleNavClick('community')} className="hover:text-primary transition-colors">Discord</button>
            </div>
          </div>
      </footer>

    </div>
  );
};

export default App;