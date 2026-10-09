import React from 'react';
import { Scissors, Sparkles, Upload, Download, Flame, Video, Youtube, Grid, Sliders, Plus } from 'lucide-react';
import { VideoSource, ClipHighlight } from '../types';

interface HeaderProps {
  currentVideo: VideoSource;
  activeClip: ClipHighlight | null;
  appMode: 'generator' | 'feed' | 'studio';
  onSetAppMode: (mode: 'generator' | 'feed' | 'studio') => void;
  onOpenImportModal: () => void;
  onOpenExportModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentVideo,
  activeClip,
  appMode,
  onSetAppMode,
  onOpenImportModal,
  onOpenExportModal,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/85 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div
          onClick={() => onSetAppMode('generator')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black group-hover:scale-105 transition-transform">
            <Scissors className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                ClipForge
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Opus Pro
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block truncate max-w-xs">
              {currentVideo.title}
            </p>
          </div>
        </div>

        {/* View Switcher Tabs (Opus Feed vs Klap Studio) */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => onSetAppMode('generator')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              appMode === 'generator'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clip Video</span>
          </button>

          <button
            onClick={() => onSetAppMode('feed')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              appMode === 'feed'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Clips Feed ({currentVideo.highlights.length})</span>
          </button>

          <button
            onClick={() => onSetAppMode('studio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              appMode === 'studio'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Studio Editor</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenExportModal}
            disabled={!activeClip}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            <span>Export 9:16</span>
          </button>
        </div>
      </div>
    </header>
  );
};
