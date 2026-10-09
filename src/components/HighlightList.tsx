import React, { useState } from 'react';
import { Sparkles, Flame, Clock, Play, CheckCircle2, ChevronRight, Hash, TrendingUp, Smile, Zap, BookOpen, Swords } from 'lucide-react';
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'funny':
        return <Smile className="w-3.5 h-3.5 text-amber-400" />;
      case 'highlight':
        return <Zap className="w-3.5 h-3.5 text-orange-400" />;
      case 'educational':
        return <BookOpen className="w-3.5 h-3.5 text-cyan-400" />;
      case 'debate':
        return <Swords className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Flame className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const getViralityColor = (score: number) => {
    if (score >= 95) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    if (score >= 90) return 'text-orange-400 border-orange-500/40 bg-orange-500/10';
    return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = Math.floor(sec % 60);
    return `${mins}:${String(remainder).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>AI Detected Highlights</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  {filteredClips.length}
                </span>
              </h3>
            </div>
          </div>

          <button
            onClick={() => onTriggerAiScan(selectedCategory === 'all' ? undefined : selectedCategory)}
            disabled={isAiScanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all cursor-pointer disabled:opacity-50"
            title="Use Gemini to search for more viral peaks"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAiScanning ? 'animate-spin' : ''}`} />
            <span>{isAiScanning ? 'Scanning...' : 'Find More'}</span>
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: 'All Peaks' },
            { id: 'funny', label: '😂 Funny & Roast' },
            { id: 'highlight', label: '⚡ Climax' },
            { id: 'educational', label: '🧠 Knowledge' },
            { id: 'debate', label: '⚔️ Hot Takes' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as ClipCategory)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clip Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredClips.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Sparkles className="w-8 h-8 mx-auto text-amber-500/40 mb-2" />
            <p className="text-xs">No clips found for this category.</p>
            <button
              onClick={() => onTriggerAiScan(selectedCategory)}
              className="mt-3 px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg"
            >
              Scan with Gemini AI
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
                className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-800/90 border-amber-500 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30'
                    : 'bg-slate-900/60 hover:bg-slate-800/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top row: Category & Virality Score */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                      {getCategoryIcon(clip.category)}
                      <span className="capitalize">{clip.category}</span>
                    </div>

                    <div
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${getViralityColor(
                        clip.viralityScore
                      )}`}
                    >
                      <Flame className="w-3 h-3" />
                      <span>{clip.viralityScore}/100</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h4
                    className={`text-xs font-bold line-clamp-2 transition-colors mb-1.5 ${
                      isSelected ? 'text-amber-400' : 'text-slate-200 group-hover:text-white'
                    }`}
                  >
                    {clip.title}
                  </h4>

                  {/* Hook preview */}
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 mb-2">
                    <p className="text-[11px] text-amber-300 font-medium line-clamp-2">
                      <span className="text-slate-400 font-normal">Hook: </span>
                      "{clip.hook}"
                    </p>
                  </div>

                  {/* Reason */}
                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-2.5">
                    {clip.reason}
                  </p>
                </div>

                {/* Footer metadata & selection */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px] font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>
                      {formatSeconds(clip.startTime)} - {formatSeconds(clip.endTime)}
                    </span>
                    <span className="text-slate-400 font-bold">({duration}s)</span>
                  </div>

                  <div className="flex items-center gap-1 font-semibold text-xs text-amber-400">
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-amber-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-400 group-hover:text-amber-400 transition-colors">
                        <Play className="w-3 h-3" />
                        <span>Clip</span>
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
