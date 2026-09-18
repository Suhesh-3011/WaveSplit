import React from 'react';
import { Sliders, Scissors, Sparkles, MessageSquare, Music2, Disc } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  activeTab: 'isolator' | 'cutter' | 'art' | 'chat';
  setActiveTab: (tab: 'isolator' | 'cutter' | 'art' | 'chat') => void;
  activeTrackTitle?: string;
  hasTrack: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeTrackTitle,
  hasTrack,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <Disc className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent font-['Space_Grotesk']">
                WaveSplit Studio
              </span>
              <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                DSP & AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Vocal Stem Isolation & Custom Snippet Cutter
            </p>
          </div>
        </div>

        {/* Current Active Track Pill */}
        {hasTrack && activeTrackTitle && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300 max-w-xs truncate">
            <Music2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 animate-pulse" />
            <span className="truncate">{activeTrackTitle}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            id="tab-btn-isolator"
            onClick={() => setActiveTab('isolator')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'isolator'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span className="hidden md:inline">Vocal Remover</span>
            <span className="md:hidden">Stems</span>
          </button>

          <button
            id="tab-btn-cutter"
            onClick={() => setActiveTab('cutter')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'cutter'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span className="hidden md:inline">Ringtone & Snippet Cutter</span>
            <span className="md:hidden">Cutter</span>
          </button>

          <button
            id="tab-btn-art"
            onClick={() => setActiveTab('art')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'art'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-300" />
            <span className="hidden md:inline">Cover Art (1K/2K/4K)</span>
            <span className="md:hidden">Artwork</span>
          </button>

          <button
            id="tab-btn-chat"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">AI Producer Chat</span>
            <span className="md:hidden">AI Chat</span>
          </button>

          {/* PWA Install in Edge / Chrome / Desktop */}
          <div className="ml-1 pl-2 border-l border-slate-800 flex items-center">
            <PWAInstallButton />
          </div>
        </nav>
      </div>
    </header>
  );
};
