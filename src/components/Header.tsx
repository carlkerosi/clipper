import React from 'react';
import { Scissors, Sparkles, Upload, Download, Grid, Sliders, Plus, Film } from 'lucide-react';
import { VideoSource, ClipHighlight } from '../types';

interface HeaderProps {
  currentVideo: VideoSource;
  activeClip: ClipHighlight | null;
  appMode: 'generator' | 'feed' | 'studio';
  onSetAppMode: (mode: 'generator' | 'feed' | 'studio') => void;
  onOpenImportModal: () => void;
  onOpenExportModal: () => void;
  onOpenAiDirector?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentVideo,
  activeClip,
  appMode,
  onSetAppMode,
  onOpenImportModal,
  onOpenExportModal,
  onOpenAiDirector,
}) => {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Brand & Source Project */}
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            onClick={() => onSetAppMode('generator')}
            className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-all">
              <Scissors className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-base tracking-tight text-zinc-100 group-hover:text-white transition-colors whitespace-nowrap">
                ClipForge
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 whitespace-nowrap">
                Opus Engine
              </span>
            </div>
          </button>

          <div className="hidden lg:flex items-center gap-2 pl-3.5 border-l border-zinc-800 text-xs text-zinc-400 min-w-0">
            <Film className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="truncate max-w-[200px] text-zinc-300 font-medium" title={currentVideo.title}>
              {currentVideo.title}
            </span>
            <span className="text-zinc-600">·</span>
            <button
              onClick={onOpenImportModal}
              className="text-emerald-400 hover:text-emerald-300 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Switch source
            </button>
          </div>
        </div>

        {/* Zone 2: Workflow Segmented Nav */}
        <nav aria-label="Workflow Steps" className="flex items-center p-1 rounded-lg bg-zinc-900 border border-zinc-800/90 shrink-0">
          <button
            onClick={() => onSetAppMode('generator')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              appMode === 'generator'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ingest</span>
          </button>

          <button
            onClick={() => onSetAppMode('feed')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              appMode === 'feed'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Clips</span>
            <span className="text-[11px] font-mono tabular-nums text-zinc-400">
              {currentVideo.highlights.length}
            </span>
          </button>

          <button
            onClick={() => onSetAppMode('studio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              appMode === 'studio'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Studio 9:16</span>
          </button>
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenAiDirector && (
            <button
              onClick={onOpenAiDirector}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-300 hover:text-white bg-violet-600/15 hover:bg-violet-600/30 border border-violet-500/40 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Open AI Studio Director"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="hidden sm:inline">AI Director</span>
            </button>
          )}

          <button
            onClick={onOpenImportModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>

          <button
            onClick={onOpenExportModal}
            disabled={!activeClip}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Export 9:16</span>
          </button>
        </div>
      </div>
    </header>
  );
};
