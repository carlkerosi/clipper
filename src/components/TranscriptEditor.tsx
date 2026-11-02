import React, { useState } from 'react';
import { FileText, Sparkles, Edit3, Check, Clock, Tag } from 'lucide-react';
import { ClipHighlight, CaptionChunk } from '../types';

interface TranscriptEditorProps {
  activeClip: ClipHighlight;
  onUpdateCaptions: (newCaptions: CaptionChunk[]) => void;
  onSeek: (time: number) => void;
  currentTimeInClip: number;
}

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  activeClip,
  onUpdateCaptions,
  onSeek,
  currentTimeInClip,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editEmphasis, setEditEmphasis] = useState('');
  const [isAiRegenerating, setIsAiRegenerating] = useState(false);

  const handleStartEdit = (index: number, chunk: CaptionChunk) => {
    setEditingIndex(index);
    setEditText(chunk.text);
    setEditEmphasis(chunk.emphasisWord || '');
  };

  const handleSaveEdit = (index: number) => {
    const updated = [...activeClip.captions];
    updated[index] = {
      ...updated[index],
      text: editText,
      emphasisWord: editEmphasis || undefined,
    };
    onUpdateCaptions(updated);
    setEditingIndex(null);
  };

  const handleAiRegenerate = async () => {
    setIsAiRegenerating(true);
    try {
      const fullText = activeClip.captions.map((c) => c.text).join(' ');
      const duration = activeClip.endTime - activeClip.startTime;

      const res = await fetch('/api/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullText || activeClip.title,
          duration,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.captions && data.captions.length > 0) {
          onUpdateCaptions(data.captions);
        }
      }
    } catch (err) {
      console.error('Failed to regenerate captions:', err);
    } finally {
      setIsAiRegenerating(false);
    }
  };

  const formatSec = (s: number) => {
    const ms = Math.floor((s % 1) * 10);
    const secs = Math.floor(s % 60);
    return `${secs}.${ms}s`;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/80 rounded-2xl border border-zinc-800 p-4 shadow-xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-violet-400" />
          <div>
            <h3 className="text-xs font-semibold text-zinc-200">Dialogue Script</h3>
            <p className="text-[11px] text-zinc-500">Click to seek timestamp. Edit words or emphasis.</p>
          </div>
        </div>

        <button
          onClick={handleAiRegenerate}
          disabled={isAiRegenerating}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
          title="Regenerate timed subtitles with Gemini"
        >
          <Sparkles className={`w-3 h-3 text-violet-400 ${isAiRegenerating ? 'animate-spin' : ''}`} />
          <span>{isAiRegenerating ? 'Syncing...' : 'AI Re-sync'}</span>
        </button>
      </div>

      {/* Caption Line Items */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {activeClip.captions.map((chunk, idx) => {
          const isActive = currentTimeInClip >= chunk.start && currentTimeInClip <= chunk.end;
          const isEditing = editingIndex === idx;

          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border transition-colors ${
                isActive
                  ? 'bg-zinc-800/90 border-violet-500/80 shadow-sm ring-1 ring-violet-500/30'
                  : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1.5">
                <button
                  onClick={() => onSeek(activeClip.startTime + chunk.start)}
                  className="flex items-center gap-1.5 hover:text-violet-300 transition-colors cursor-pointer tabular-nums"
                >
                  <Clock className="w-3 h-3 text-zinc-500" />
                  <span>
                    {formatSec(chunk.start)} - {formatSec(chunk.end)}
                  </span>
                  {isActive && (
                    <span className="ml-1 text-[10px] text-violet-400 font-semibold uppercase">
                      Current
                    </span>
                  )}
                </button>

                {!isEditing ? (
                  <button
                    onClick={() => handleStartEdit(idx, chunk)}
                    className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    title="Edit caption text"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSaveEdit(idx)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[11px] font-medium cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>Done</span>
                  </button>
                )}
              </div>

              {!isEditing ? (
                <div
                  onClick={() => onSeek(activeClip.startTime + chunk.start)}
                  className="cursor-pointer"
                >
                  <p className="text-xs font-medium text-zinc-200 leading-relaxed">
                    {chunk.text}
                  </p>
                  {chunk.emphasisWord && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-violet-400 font-mono">
                      <Tag className="w-2.5 h-2.5" />
                      <span>Emphasis: "{chunk.emphasisWord}"</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 mt-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-violet-500"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400">Emphasis word:</span>
                    <input
                      type="text"
                      value={editEmphasis}
                      onChange={(e) => setEditEmphasis(e.target.value)}
                      placeholder="e.g. INSANE"
                      className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-violet-300 w-32 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
