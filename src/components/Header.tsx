import React, { useState, useRef, useEffect } from 'react';
import {
  Scissors,
  Sparkles,
  Upload,
  Download,
  Grid,
  Sliders,
  Plus,
  Film,
  ChevronDown,
  Youtube,
  Music2,
  Zap,
  BarChart3,
} from 'lucide-react';
import { VideoSource, ClipHighlight } from '../types';
import { ExportPlatform, PLATFORM_PRESETS } from '../utils/platformExport';
import { useFirebase } from '../contexts/FirebaseContext';

interface HeaderProps {
  currentVideo: VideoSource;
  activeClip: ClipHighlight | null;
  appMode: 'generator' | 'feed' | 'studio' | 'dashboard';
  onSetAppMode: (mode: 'generator' | 'feed' | 'studio' | 'dashboard') => void;
  onOpenImportModal: () => void;
  onOpenExportModal: () => void;
  onQuickExportPlatform?: (platform: ExportPlatform) => void;
  onOpenAiDirector?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentVideo,
  activeClip,
  appMode,
  onSetAppMode,
  onOpenImportModal,
  onOpenExportModal,
  onQuickExportPlatform,
  onOpenAiDirector,
}) => {
  const { socialAccounts, getDefaultAccountForPlatform } = useFirebase();
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isExportMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportMenuOpen]);

  const platformIcons: Record<ExportPlatform, React.ReactNode> = {
    shorts: <Youtube className="w-4 h-4 text-red-500 shrink-0" />,
    tiktok: <Music2 className="w-4 h-4 text-cyan-400 shrink-0" />,
  };

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

          <button
            onClick={() => onSetAppMode('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              appMode === 'dashboard'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Dashboard</span>
            {socialAccounts.length > 0 && (
              <span className="text-[11px] font-mono tabular-nums text-emerald-400">
                {socialAccounts.length}
              </span>
            )}
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

          {/* Split Export 9:16 + Platform Shortcuts Dropdown */}
          <div ref={menuRef} className="relative flex items-center">
            <button
              onClick={onOpenExportModal}
              disabled={!activeClip}
              className={`flex items-center gap-1.5 pl-3.5 pr-2.5 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 ${
                onQuickExportPlatform ? 'rounded-l-lg border-r border-emerald-600/40' : 'rounded-lg pr-3.5'
              }`}
            >
              <Download className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Export 9:16</span>
            </button>

            {onQuickExportPlatform && (
              <button
                type="button"
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                disabled={!activeClip}
                aria-label="Platform Export Shortcuts"
                title="One-click export to YouTube Shorts or TikTok"
                className="px-2 py-1.5 rounded-r-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}

            {isExportMenuOpen && onQuickExportPlatform && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-1.5 z-50">
                <div className="px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400 border-b border-zinc-800 mb-1">
                  <Zap className="w-3 h-3 text-emerald-400" />
                  <span>Quick Export Shortcut</span>
                </div>

                {(['shorts', 'tiktok'] as ExportPlatform[]).map((platformId) => {
                  const preset = PLATFORM_PRESETS[platformId];
                  const linkedAcc = getDefaultAccountForPlatform(platformId);
                  return (
                    <button
                      key={platformId}
                      type="button"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        onQuickExportPlatform(platformId);
                      }}
                      className="w-full px-2.5 py-2 rounded-lg hover:bg-zinc-800 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {platformIcons[platformId]}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 truncate">
                            {preset.label}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono truncate">
                            {linkedAcc ? linkedAcc.handle : preset.tag}
                          </div>
                        </div>
                      </div>
                      <kbd className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[10px] font-mono text-zinc-400 shrink-0">
                        {preset.shortcut}
                      </kbd>
                    </button>
                  );
                })}

                <div className="mt-1 pt-1 border-t border-zinc-800 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      onOpenExportModal();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-xs text-zinc-300 text-left transition-colors cursor-pointer"
                  >
                    Custom Export Options...
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      onSetAppMode('dashboard');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-xs text-emerald-400 text-left transition-colors cursor-pointer"
                  >
                    Manage Social Accounts & Monitor...
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
