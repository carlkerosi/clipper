import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Send, Loader2, Wand2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ClipHighlight, ExportSettings, VideoSource } from '../types';
import { parseJsonResponse } from '../utils/safeFetchJson';

export interface DirectorActions {
  hookBannerText?: string;
  showHookBanner?: boolean;
  framingMode?: ExportSettings['framingMode'];
  panX?: number;
  captionPreset?: ExportSettings['captionPreset'];
  captionColor?: string;
  captionEntranceAnim?: ExportSettings['captionEntranceAnim'];
  captionExitAnim?: ExportSettings['captionExitAnim'];
  videoFilter?: ExportSettings['videoFilter'];
  filterBrightness?: number;
  filterContrast?: number;
  filterSaturate?: number;
  startTime?: number;
  endTime?: number;
  newClipTitle?: string;
  triggerClipMorePrompt?: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  appliedSummary?: string[];
}

interface AiDirectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentVideo: VideoSource;
  activeClip: ClipHighlight | null;
  settings: ExportSettings;
  onApplyActions: (actions: DirectorActions) => string[];
}

export const AiDirectorDrawer: React.FC<AiDirectorDrawerProps> = ({
  isOpen,
  onClose,
  currentVideo,
  activeClip,
  settings,
  onApplyActions,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: 'I am your ClipForge AI Director. Tell me how to style captions, grade colors, tighten your hook, adjust trim timing, or extract more clips from this video.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setErrorMsg(null);
    setIsSending(true);

    try {
      const res = await fetch('/api/ai-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, text: m.text })),
          videoContext: {
            title: currentVideo.title,
            duration: currentVideo.duration,
            aiSummary: currentVideo.aiSummary,
            visualSummary: currentVideo.visualSummary,
            transcript: currentVideo.transcript,
          },
          activeClip,
          settings,
        }),
      });

      const data = await parseJsonResponse(res, 'AI Director request failed');
      if (!res.ok) {
        throw new Error(data.error || 'AI Director request failed.');
      }

      const appliedSummary = data.actions ? onApplyActions(data.actions) : [];
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: data.reply || 'Done.',
          appliedSummary: appliedSummary.length > 0 ? appliedSummary : undefined,
        },
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not reach AI Director.');
    } finally {
      setIsSending(false);
    }
  };

  const quickPrompts = [
    'Optimize this clip for maximum TikTok retention',
    'Apply Film Noir grade + Minimal Cinema captions',
    'Write a stronger 3-second viral hook',
    'Find 3 more high-energy moments in this video',
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-400">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">AI Studio Director</h3>
              <p className="text-[11px] text-zinc-400 line-clamp-1">
                {activeClip ? activeClip.title : currentVideo.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {msg.appliedSummary && msg.appliedSummary.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-zinc-800 space-y-1">
                    {msg.appliedSummary.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium"
                      >
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 px-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
              <span>AI Director is updating your Studio...</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        <div className="px-4 py-2 border-t border-zinc-800/80 bg-zinc-900/40 flex flex-wrap gap-1.5">
          {quickPrompts.map((qp) => (
            <button
              key={qp}
              type="button"
              onClick={() => sendMessage(qp)}
              disabled={isSending}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 transition-colors cursor-pointer disabled:opacity-50 text-left"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center gap-2"
        >
          <div className="relative flex-1 flex items-center">
            <Sparkles className="w-3.5 h-3.5 text-violet-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSending}
              placeholder="Direct AI: e.g. 'Make captions neon & warm grade'..."
              className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors cursor-pointer disabled:opacity-40"
            title="Send to AI Director"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
