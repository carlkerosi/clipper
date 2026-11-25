import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Clock,
  Play,
  CheckCircle2,
  TrendingUp,
  Plus,
  Copy,
  Trash2,
  ArrowUpDown,
  Zap,
  Loader2,
} from 'lucide-react';
import { ClipHighlight, ClipCategory } from '../types';

interface HighlightListProps {
  highlights: ClipHighlight[];
  activeClip: ClipHighlight | null;
  onSelectClip: (clip: ClipHighlight) => void;
  onTriggerAiScan: (filter?: string, customPrompt?: string) => void;
  onCreateCustomClip?: () => void;
  onDuplicateClip?: (clip: ClipHighlight) => void;
  onDeleteClip?: (clipId: string) => void;
  onAiBoostClip?: (clip: ClipHighlight) => void;
  aiBoostingClipId?: string | null;
  isAiScanning: boolean;
}

export const HighlightList: React.FC<HighlightListProps> = ({
  highlights,
  activeClip,
  onSelectClip,
  onTriggerAiScan,
  onCreateCustomClip,
  onDuplicateClip,
  onDeleteClip,
  onAiBoostClip,
  aiBoostingClipId = null,
  isAiScanning,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ClipCategory>('all');
  const [sortMode, setSortMode] = useState<'score' | 'timeline' | 'duration'>('score');
  const [customPrompt, setCustomPrompt] = useState('');

  const filteredClips = useMemo(() => {
    const base = highlights.filter((clip) => {
      if (selectedCategory === 'all') return true;
      return clip.category === selectedCategory;
    });
    return [...base].sort((a, b) => {
      if (sortMode === 'timeline') return a.startTime - b.startTime;
      if (sortMode === 'duration') {
        return b.endTime - b.startTime - (a.endTime - a.startTime);
      }
      return b.viralityScore - a.viralityScore;
    });
  }, [highlights, selectedCategory, sortMode]);

  const cycleSort = () => {
    setSortMode((prev) =>
      prev === 'score' ? 'timeline' : prev === 'timeline' ? 'duration' : 'score'
    );
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);
    return `${mins}:${String(remainder).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/80 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-3.5 border-b border-zinc-800 bg-zinc-950/60 space-y-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-4 h-4 text-violet-400 shrink-0" />
            <h3 className="text-xs font-semibold text-zinc-200 truncate">
              Clips ({filteredClips.length})
            </h3>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onCreateCustomClip && (
              <button
                onClick={onCreateCustomClip}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                title="Create new clip starting at current playhead"
              >
                <Plus className="w-3 h-3" />
                <span>Custom</span>
              </button>
            )}

            <button
              onClick={() =>
                onTriggerAiScan(
                  selectedCategory === 'all' ? undefined : selectedCategory,
                  customPrompt.trim() || undefined
                )
              }
              disabled={isAiScanning}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Search for more viral moments"
            >
              <Sparkles className={`w-3 h-3 text-violet-400 ${isAiScanning ? 'animate-spin' : ''}`} />
              <span>{isAiScanning ? 'Scanning' : 'Find'}</span>
            </button>
          </div>
        </div>

        {/* Custom AI Prompt Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isAiScanning) return;
            onTriggerAiScan(
              selectedCategory === 'all' ? undefined : selectedCategory,
              customPrompt.trim() || undefined
            );
            setCustomPrompt('');
          }}
        >
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            disabled={isAiScanning}
            placeholder="Custom AI prompt (e.g. 'best 12s hook')..."
            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500 disabled:opacity-60"
          />
        </form>

        {/* Category Filter + Sort */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            {[
              { id: 'all', label: 'All' },
              { id: 'funny', label: 'Humor' },
              { id: 'highlight', label: 'Climax' },
              { id: 'educational', label: 'Insight' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as ClipCategory)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded-md shrink-0 transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <button
            onClick={cycleSort}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-950 border border-zinc-800 shrink-0 cursor-pointer"
            title="Cycle clip sort order"
          >
            <ArrowUpDown className="w-2.5 h-2.5" />
            <span>{sortMode === 'score' ? 'Score' : sortMode === 'timeline' ? 'Time' : 'Dur'}</span>
          </button>
        </div>
      </div>

      {/* Clip Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredClips.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 space-y-2">
            <Sparkles className="w-6 h-6 mx-auto text-zinc-600" />
            <p className="text-xs">No moments in this category.</p>
            <button
              onClick={() =>
                onTriggerAiScan(
                  selectedCategory === 'all' ? undefined : selectedCategory,
                  customPrompt.trim() || undefined
                )
              }
              disabled={isAiScanning}
              className="px-3 py-1 bg-violet-600 text-white font-medium text-xs rounded-lg cursor-pointer disabled:opacity-50"
            >
              Scan with AI
            </button>
          </div>
        ) : (
          filteredClips.map((clip) => {
            const isSelected = activeClip?.id === clip.id;
            const duration = Math.round(clip.endTime - clip.startTime);
            const isBoosting = aiBoostingClipId === clip.id;

            return (
              <div
                key={clip.id}
                onClick={() => onSelectClip(clip)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-zinc-800/90 border-violet-500/80 shadow-md ring-1 ring-violet-500/30'
                    : 'bg-zinc-950/60 hover:bg-zinc-800/50 border-zinc-800/80'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-zinc-400 uppercase">
                      {clip.category}
                    </span>
                    <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                      {clip.viralityScore}% score
                    </span>
                  </div>

                  <h4
                    className={`text-xs font-medium line-clamp-2 transition-colors ${
                      isSelected ? 'text-white font-semibold' : 'text-zinc-300'
                    }`}
                  >
                    {clip.title}
                  </h4>

                  <p className="text-[11px] text-zinc-400 line-clamp-1 italic">
                    "{clip.hook}"
                  </p>
                </div>

                <div className="pt-2 mt-2 border-t border-zinc-800/80 flex items-center justify-between gap-1 text-[11px]">
                  <div className="flex items-center gap-1 font-mono text-zinc-400 tabular-nums truncate">
                    <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
                    <span className="truncate">
                      {formatSeconds(clip.startTime)}–{formatSeconds(clip.endTime)} ({duration}s)
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {onAiBoostClip && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAiBoostClip(clip);
                        }}
                        disabled={isBoosting}
                        title="AI Boost hook, pacing & captions"
                        className="p-1 rounded bg-violet-500/15 hover:bg-violet-500/30 text-violet-300 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isBoosting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Zap className="w-3 h-3" />
                        )}
                      </button>
                    )}

                    {onDuplicateClip && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateClip(clip);
                        }}
                        title="Duplicate clip"
                        className="p-1 rounded hover:bg-zinc-700/70 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}

                    {onDeleteClip && highlights.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteClip(clip.id);
                        }}
                        title="Delete clip"
                        className="p-1 rounded hover:bg-rose-500/20 text-zinc-500 hover:text-rose-300 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}

                    {isSelected ? (
                      <span className="text-violet-400 flex items-center gap-0.5 font-medium pl-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="text-zinc-500 flex items-center gap-0.5 pl-0.5">
                        <Play className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
