import React, { useState } from 'react';
import { FileText, Sparkles, Edit3, Check, Clock, Tag, Languages, AlertCircle } from 'lucide-react';
import { ClipHighlight, CaptionChunk } from '../types';
import { parseJsonResponse } from '../utils/safeFetchJson';

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
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState('Spanish');
  const [aiError, setAiError] = useState<string | null>(null);

  const handleStartEdit = (index: number, chunk: CaptionChunk) => {
    setEditingIndex(index);
    setEditText(chunk.text);
    setEditEmphasis(chunk.emphasisWord || '');
  };

  const handleSaveEdit = (index: number) => {
    const updated = [...activeClip.captions];
    const chunk = updated[index];
    const wordsList = editText.trim().split(/\s+/).filter(Boolean);
    const seg = (chunk.end - chunk.start) / Math.max(1, wordsList.length);
    const nextWords = wordsList.map((w, wi) => ({
      w,
      start: Math.round((chunk.start + wi * seg) * 10) / 10,
      end: Math.round((chunk.start + (wi + 1) * seg) * 10) / 10,
    }));
    updated[index] = {
      ...chunk,
      text: editText.trim(),
      emphasisWord: editEmphasis.trim() || undefined,
      words: nextWords,
    };
    onUpdateCaptions(updated);
    setEditingIndex(null);
  };

  const handleAiRegenerate = async () => {
    setIsAiRegenerating(true);
    setAiError(null);
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

      const data = await parseJsonResponse(res, 'Failed to regenerate captions');
      if (!res.ok) {
        throw new Error(data.error || 'Failed to regenerate captions.');
      }
      if (data.captions && data.captions.length > 0) {
        onUpdateCaptions(data.captions);
      }
    } catch (err: any) {
      setAiError(err.message || 'Could not re-sync captions with Gemini.');
    } finally {
      setIsAiRegenerating(false);
    }
  };

  const handleAiTranslate = async () => {
    if (!activeClip.captions.length) return;
    setIsTranslating(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai-translate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captions: activeClip.captions,
          targetLanguage: targetLang,
        }),
      });
      const data = await parseJsonResponse(res, 'Failed to transform captions');
      if (!res.ok) {
        throw new Error(data.error || 'Failed to transform captions.');
      }
      if (data.captions && data.captions.length > 0) {
        onUpdateCaptions(data.captions);
      }
    } catch (err: any) {
      setAiError(err.message || 'Could not translate or adapt captions.');
    } finally {
      setIsTranslating(false);
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
            <p className="text-[11px] text-zinc-500">Click to seek. Edit, re-sync, or translate.</p>
          </div>
        </div>

        <button
          onClick={handleAiRegenerate}
          disabled={isAiRegenerating || isTranslating}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
          title="Regenerate timed subtitles with Gemini"
        >
          <Sparkles className={`w-3 h-3 text-violet-400 ${isAiRegenerating ? 'animate-spin' : ''}`} />
          <span>{isAiRegenerating ? 'Syncing...' : 'AI Re-sync'}</span>
        </button>
      </div>

      {/* AI Translate / Tone Adapt Bar */}
      <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-950/70 border border-zinc-800">
        <Languages className="w-3.5 h-3.5 text-violet-400 shrink-0 ml-1" />
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          disabled={isTranslating}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          <option value="Spanish">Translate: Spanish</option>
          <option value="French">Translate: French</option>
          <option value="Portuguese">Translate: Portuguese</option>
          <option value="German">Translate: German</option>
          <option value="Japanese">Translate: Japanese</option>
          <option value="Hindi">Translate: Hindi</option>
          <option value="Ultra-Punchy TikTok English Hooks">Rewrite: Punchy Hooks (EN)</option>
        </select>
        <button
          onClick={handleAiTranslate}
          disabled={isTranslating || isAiRegenerating}
          className="px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 text-[11px] font-semibold cursor-pointer disabled:opacity-50 shrink-0"
        >
          {isTranslating ? 'Applying...' : 'AI Adapt'}
        </button>
      </div>

      {aiError && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{aiError}</span>
        </div>
      )}

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
