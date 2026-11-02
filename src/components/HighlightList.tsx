import React, { useState } from 'react';
import { Sparkles, Clock, Play, CheckCircle2, TrendingUp, Smile, Zap, BookOpen, Swords } from 'lucide-react';
import { ClipHighlight, ClipCategory } from '../types';

interface HighlightListProps {
  highlights: ClipHighlight[];
  activeClip: ClipHighlight | null;
  onSelectClip: (clip: ClipHighlight) => void;
  onTriggerAiScan: (filter?: string) => void;
  isAiScanning: boolean;
}

export const HighlightList: React.FC<HighlightListProps> = ({
  highlights,
  activeClip,
  onSelectClip,
  onTriggerAiScan,
  isAiScanning,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ClipCategory>('all');

  const filteredClips = highlights.filter((clip) => {
    if (selectedCategory === 'all') return true;
    return clip.category === selectedCategory;
  });

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);
    return `${mins}:${String(remainder).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/80 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-3.5 border-b border-zinc-800 bg-zinc-950/60">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <h3 className="text-xs font-semibold text-zinc-200">
              Clips Library
            </h3>
            <span className="text-[11px] font-mono tabular-nums text-zinc-500">
              ({filteredClips.length})
            </span>
          </div>

          <button
            onClick={() => onTriggerAiScan(selectedCategory === 'all' ? undefined : selectedCategory)}
            disabled={isAiScanning}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
            title="Search for more viral moments"
          >
            <Sparkles className={`w-3 h-3 text-violet-400 ${isAiScanning ? 'animate-spin' : ''}`} />
            <span>{isAiScanning ? 'Scanning...' : 'Find More'}</span>
          </button>
        </div>

        {/* Category Filter Pills */}
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
      </div>

      {/* Clip Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredClips.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 space-y-2">
            <Sparkles className="w-6 h-6 mx-auto text-zinc-600" />
            <p className="text-xs">No moments in this category.</p>
            <button
              onClick={() => onTriggerAiScan(selectedCategory)}
              className="px-3 py-1 bg-violet-600 text-white font-medium text-xs rounded-lg"
            >
              Scan with AI
            </button>
          </div>
        ) : (
          filteredClips.map((clip) => {
            const isSelected = activeClip?.id === clip.id;
            const duration = Math.round(clip.endTime - clip.startTime);

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

                <div className="pt-2 mt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 font-mono text-zinc-400 tabular-nums">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    <span>
                      {formatSeconds(clip.startTime)} - {formatSeconds(clip.endTime)} ({duration}s)
                    </span>
                  </div>

                  {isSelected ? (
                    <span className="text-violet-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Loaded</span>
                    </span>
                  ) : (
                    <span className="text-zinc-500 group-hover:text-zinc-300 flex items-center gap-1">
                      <Play className="w-2.5 h-2.5" />
                      <span>Select</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
