import React, { useRef, useState } from 'react';
import {
  Scissors,
  ZoomIn,
  Undo2,
  ArrowRightToLine,
  ArrowLeftToLine,
  Link2,
  SkipBack,
  SkipForward,
  Play,
} from 'lucide-react';
import { ClipHighlight } from '../types';

interface TimelineTrimmerProps {
  totalVideoDuration: number;
  activeClip: ClipHighlight;
  currentTime: number;
  onUpdateClipTime: (
    newStart: number,
    newEnd: number,
    options?: { skipHistory?: boolean; shiftCaptions?: boolean }
  ) => void;
  onSeek: (time: number) => void;
  onSetInPoint?: () => void;
  onSetOutPoint?: () => void;
  onUndoTrim?: () => void;
  canUndoTrim?: boolean;
  syncCaptionsOnTrim?: boolean;
  onToggleSyncCaptions?: () => void;
}

const MIN_CLIP_SECONDS = 2;

export const TimelineTrimmer: React.FC<TimelineTrimmerProps> = ({
  totalVideoDuration,
  activeClip,
  currentTime,
  onUpdateClipTime,
  onSeek,
  onSetInPoint,
  onSetOutPoint,
  onUndoTrim,
  canUndoTrim = false,
  syncCaptionsOnTrim = true,
  onToggleSyncCaptions,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<'full' | 'zoom'>('zoom');
  const dragStateRef = useRef<{
    type: 'in' | 'out' | 'slip' | 'scrub';
    pointerStartX: number;
    origStart: number;
    origEnd: number;
    winStart: number;
    winSpan: number;
  } | null>(null);
  const [activeDragType, setActiveDragType] = useState<'in' | 'out' | 'slip' | 'scrub' | null>(null);

  const total = Math.max(4, totalVideoDuration || 300, activeClip.endTime);
  const duration = Math.max(MIN_CLIP_SECONDS, activeClip.endTime - activeClip.startTime);

  // Compute visible window (Full Source vs Zoomed around clip +/- 15s)
  const zoomPad = Math.max(12, Math.min(30, duration * 0.6));
  const winStart =
    viewMode === 'zoom' ? Math.max(0, activeClip.startTime - zoomPad) : 0;
  const winEnd =
    viewMode === 'zoom' ? Math.min(total, activeClip.endTime + zoomPad) : total;
  const winSpan = Math.max(MIN_CLIP_SECONDS + 2, winEnd - winStart);

  const toPercent = (sec: number) =>
    Math.max(0, Math.min(100, ((sec - winStart) / winSpan) * 100));

  const startPercent = toPercent(activeClip.startTime);
  const endPercent = toPercent(activeClip.endTime);
  const currentPercent = toPercent(currentTime);

  const clientXToSec = (clientX: number, wStart: number, wSpan: number): number => {
    if (!trackRef.current) return wStart;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    return Math.round((wStart + ratio * wSpan) * 10) / 10;
  };

  const startDrag = (
    e: React.PointerEvent<HTMLElement>,
    type: 'in' | 'out' | 'slip' | 'scrub'
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      type,
      pointerStartX: e.clientX,
      origStart: activeClip.startTime,
      origEnd: activeClip.endTime,
      winStart,
      winSpan,
    };
    setActiveDragType(type);

    if (type === 'scrub') {
      const targetSec = clientXToSec(e.clientX, winStart, winSpan);
      onSeek(targetSec);
    }
  };

  const moveDrag = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragStateRef.current;
    if (!drag || !trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const dxSec = ((e.clientX - drag.pointerStartX) / Math.max(1, rect.width)) * drag.winSpan;

    if (drag.type === 'scrub') {
      const targetSec = clientXToSec(e.clientX, drag.winStart, drag.winSpan);
      onSeek(targetSec);
      return;
    }

    if (drag.type === 'in') {
      const nextStart = Math.max(
        0,
        Math.min(drag.origEnd - MIN_CLIP_SECONDS, Math.round((drag.origStart + dxSec) * 10) / 10)
      );
      onUpdateClipTime(nextStart, drag.origEnd, { skipHistory: true });
      onSeek(nextStart);
    } else if (drag.type === 'out') {
      const nextEnd = Math.min(
        total,
        Math.max(drag.origStart + MIN_CLIP_SECONDS, Math.round((drag.origEnd + dxSec) * 10) / 10)
      );
      onUpdateClipTime(drag.origStart, nextEnd, { skipHistory: true });
      onSeek(nextEnd);
    } else if (drag.type === 'slip') {
      const clipLen = drag.origEnd - drag.origStart;
      let nextStart = Math.round((drag.origStart + dxSec) * 10) / 10;
      nextStart = Math.max(0, Math.min(total - clipLen, nextStart));
      const nextEnd = Math.round((nextStart + clipLen) * 10) / 10;
      onUpdateClipTime(nextStart, nextEnd, { skipHistory: true });
      onSeek(nextStart);
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragStateRef.current) return;
    const drag = dragStateRef.current;
    dragStateRef.current = null;
    setActiveDragType(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (drag.type !== 'scrub') {
      // Commit final step to history if start or end changed noticeably
      if (
        Math.abs(activeClip.startTime - drag.origStart) >= 0.1 ||
        Math.abs(activeClip.endTime - drag.origEnd) >= 0.1
      ) {
        onUpdateClipTime(activeClip.startTime, activeClip.endTime);
      }
    }
  };

  const setDurationPreset = (targetDuration: number) => {
    let newEnd = Math.round((activeClip.startTime + targetDuration) * 10) / 10;
    if (newEnd > total) {
      newEnd = total;
    }
    onUpdateClipTime(activeClip.startTime, newEnd);
  };

  const adjustStart = (delta: number) => {
    const newStart = Math.max(
      0,
      Math.min(activeClip.endTime - MIN_CLIP_SECONDS, activeClip.startTime + delta)
    );
    onUpdateClipTime(newStart, activeClip.endTime);
    onSeek(newStart);
  };

  const adjustEnd = (delta: number) => {
    const newEnd = Math.max(
      activeClip.startTime + MIN_CLIP_SECONDS,
      Math.min(total, activeClip.endTime + delta)
    );
    onUpdateClipTime(activeClip.startTime, newEnd);
    onSeek(Math.max(newStartOrZero(activeClip.startTime), newEnd - 2));
  };

  function newStartOrZero(s: number) {
    return Math.max(0, s);
  }

  const formatSec = (s: number) => {
    const safe = Math.max(0, s);
    const mins = Math.floor(safe / 60);
    const secs = Math.floor(safe % 60);
    const ms = Math.floor((safe % 1) * 10);
    return `${mins}:${String(secs).padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-3.5 shadow-xl space-y-2.5">
      {/* Top Header: Title, Duration, Zoom, Undo, Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scissors className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="text-xs font-semibold text-zinc-200 whitespace-nowrap">
            Timeline Trimmer
          </span>
          <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded bg-zinc-950 text-violet-300 border border-zinc-800 whitespace-nowrap">
            {formatSec(duration)}s
          </span>

          <button
            type="button"
            onClick={() => setViewMode((v) => (v === 'zoom' ? 'full' : 'zoom'))}
            title={
              viewMode === 'zoom'
                ? 'Showing zoomed clip region — click for full source overview'
                : 'Showing full source video — click to zoom around clip'
            }
            className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              viewMode === 'zoom'
                ? 'bg-violet-500/15 text-violet-300 border-violet-500/40'
                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            <ZoomIn className="w-3 h-3" />
            <span>{viewMode === 'zoom' ? 'Zoomed' : 'Full Track'}</span>
          </button>

          {onToggleSyncCaptions && (
            <button
              type="button"
              onClick={onToggleSyncCaptions}
              title="Keep subtitles aligned with audio when moving the In trim marker"
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                syncCaptionsOnTrim
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                  : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300'
              }`}
            >
              <Link2 className="w-3 h-3" />
              <span className="hidden sm:inline">Caption Lock</span>
            </button>
          )}
        </div>

        {/* Right: Presets + Undo */}
        <div className="flex items-center gap-1">
          {onUndoTrim && (
            <button
              type="button"
              onClick={onUndoTrim}
              disabled={!canUndoTrim}
              title="Undo last trim change (Ctrl+Z)"
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 mr-1"
            >
              <Undo2 className="w-3 h-3" />
              <span>Undo</span>
            </button>
          )}

          {[
            { label: '15s', sec: 15 },
            { label: '30s', sec: 30 },
            { label: '60s', sec: 60 },
          ].map((preset) => (
            <button
              key={preset.sec}
              type="button"
              onClick={() => setDurationPreset(preset.sec)}
              className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Timeline Track with Draggable Handles & Slip Region */}
      <div
        ref={trackRef}
        onPointerDown={(e) => startDrag(e, 'scrub')}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative h-12 bg-zinc-950 rounded-xl border border-zinc-800/90 overflow-hidden cursor-crosshair select-none group touch-none"
      >
        {/* Waveform bars */}
        <div className="absolute inset-0 flex items-center justify-between px-2 gap-0.5 opacity-30 group-hover:opacity-45 transition-opacity pointer-events-none">
          {Array.from({ length: 64 }).map((_, i) => {
            const heightFactor = Math.sin(i * 0.4) * 0.4 + Math.cos(i * 0.8) * 0.3 + 0.35;
            const heightPercent = Math.max(15, Math.min(90, heightFactor * 100));
            return (
              <div
                key={i}
                className="w-1 rounded-full bg-zinc-600"
                style={{ height: `${heightPercent}%` }}
              />
            );
          })}
        </div>

        {/* Selected Clip Range (draggable as a whole for Slip-Trim) */}
        <div
          onPointerDown={(e) => startDrag(e, 'slip')}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="Drag bar horizontally to slip clip window while preserving duration"
          className={`absolute top-0 bottom-0 bg-violet-500/20 border-y border-violet-500/80 cursor-grab active:cursor-grabbing ${
            activeDragType === 'slip' ? 'bg-violet-500/30' : ''
          }`}
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(1.5, endPercent - startPercent)}%`,
          }}
        >
          {/* Waveform inside selection */}
          <div className="absolute inset-0 flex items-center justify-between gap-0.5 px-2 opacity-65 pointer-events-none">
            {Array.from({ length: 32 }).map((_, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-violet-400"
                style={{
                  height: `${Math.sin(i * 0.7) * 40 + 50}%`,
                }}
              />
            ))}
          </div>

          {/* Left Draggable In-Point Handle */}
          <div
            onPointerDown={(e) => startDrag(e, 'in')}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            title="Drag to trim Start (In) point — or press Ctrl+["
            className={`absolute top-0 bottom-0 left-0 w-3.5 bg-emerald-400 hover:bg-emerald-300 rounded-l cursor-ew-resize flex items-center justify-center shadow-lg z-20 ${
              activeDragType === 'in' ? 'ring-2 ring-white' : ''
            }`}
          >
            <div className="w-0.5 h-4 bg-zinc-950 rounded-full" />
          </div>

          {/* Right Draggable Out-Point Handle */}
          <div
            onPointerDown={(e) => startDrag(e, 'out')}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            title="Drag to trim End (Out) point — or press Ctrl+]"
            className={`absolute top-0 bottom-0 right-0 w-3.5 bg-violet-400 hover:bg-violet-300 rounded-r cursor-ew-resize flex items-center justify-center shadow-lg z-20 ${
              activeDragType === 'out' ? 'ring-2 ring-white' : ''
            }`}
          >
            <div className="w-0.5 h-4 bg-zinc-950 rounded-full" />
          </div>
        </div>

        {/* Playhead Needle */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md shadow-white/60 pointer-events-none z-30"
          style={{ left: `${currentPercent}%` }}
        >
          <div className="w-2.5 h-2.5 bg-white rotate-45 -ml-1 -mt-1 rounded-xs shadow" />
        </div>
      </div>

      {/* Direct Player Marker Row + Fine-Tuning Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
        {/* In-Point Nudge + Set In */}
        <div className="flex items-center gap-1">
          {onSetInPoint && (
            <button
              type="button"
              onClick={onSetInPoint}
              title="Set In marker at current player playhead (Ctrl+[)"
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <ArrowRightToLine className="w-3 h-3" />
              <span>Set In</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => adjustStart(-1)}
            className="px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-mono cursor-pointer whitespace-nowrap"
            title="Move In point -1.0s"
          >
            -1s
          </button>
          <button
            type="button"
            onClick={() => adjustStart(-0.1)}
            className="px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-mono cursor-pointer whitespace-nowrap"
            title="Move In point -0.1s"
          >
            -.1
          </button>
          <button
            type="button"
            onClick={() => onSeek(activeClip.startTime)}
            className="font-mono text-emerald-300 hover:text-emerald-200 tabular-nums px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] cursor-pointer whitespace-nowrap"
            title="Jump playhead to In point ([)"
          >
            {formatSec(activeClip.startTime)}
          </button>
          <button
            type="button"
            onClick={() => adjustStart(0.1)}
            className="px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-mono cursor-pointer whitespace-nowrap"
            title="Move In point +0.1s"
          >
            +.1
          </button>
          <button
            type="button"
            onClick={() => adjustStart(1)}
            className="px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-mono cursor-pointer whitespace-nowrap"
            title="Move In point +1.0s"
          >
            +1s
          </button>
        </div>

        {/* Center Playhead + Boundary Jumpers */}
        <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px] tabular-nums">
          <button
            type="button"
            onClick={() => onSeek(activeClip.startTime)}
            title="Jump to In marker ([)"
            className="p-1 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 cursor-pointer"
          >
            <SkipBack className="w-3 h-3" />
          </button>
          <span className="text-zinc-200 font-medium px-1">{formatSec(currentTime)}</span>
          <button
            type="button"
            onClick={() => onSeek(Math.max(activeClip.startTime, activeClip.endTime - 3))}
            title="Cue 3s before Out point"
            className="px-1.5 py-0.5 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-2.5 h-2.5" />
            <span>-3s</span>
          </button>
          <button
            type="button"
            onClick={() => onSeek(activeClip.endTime)}
            title="Jump to Out marker (])"
            className="p-1 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 cursor-pointer"
          >
            <SkipForward className="w-3 h-3" />
          </button>
        </div>

        {/* Out-Point Nudge + Set Out */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => adjustEnd(-1)}
            className="px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-mono cursor-pointer whitespace-nowrap"
            title="Move Out point -1.0s"
          >
            -1s
          </button>
          <button
            type="button"
            onClick={() => adjustEnd(-0.1)}
            className="px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-mono cursor-pointer whitespace-nowrap"
            title="Move Out point -0.1s"
          >
            -.1
          </button>
          <button
            type="button"
            onClick={() => onSeek(activeClip.endTime)}
            className="font-mono text-violet-300 hover:text-violet-200 tabular-nums px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] cursor-pointer whitespace-nowrap"
            title="Jump playhead to Out point (])"
          >
            {formatSec(activeClip.endTime)}
          </button>
          <button
            type="button"
            onClick={() => adjustEnd(0.1)}
            className="px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-mono cursor-pointer whitespace-nowrap"
            title="Move Out point +0.1s"
          >
            +.1
          </button>
          <button
            type="button"
            onClick={() => adjustEnd(1)}
            className="px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-mono cursor-pointer whitespace-nowrap"
            title="Move Out point +1.0s"
          >
            +1s
          </button>
          {onSetOutPoint && (
            <button
              type="button"
              onClick={onSetOutPoint}
              title="Set Out marker at current player playhead (Ctrl+])"
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/35 text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <span>Set Out</span>
              <ArrowLeftToLine className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Compact Keyboard Shortcuts Strip */}
      <div className="pt-1.5 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-zinc-500">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span>
            <kbd className="font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 px-1 py-0.5 rounded">
              Ctrl+[
            </kbd>{' '}
            Set In
          </span>
          <span>
            <kbd className="font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 px-1 py-0.5 rounded">
              Ctrl+]
            </kbd>{' '}
            Set Out
          </span>
          <span>
            <kbd className="font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 px-1 py-0.5 rounded">
              Space
            </kbd>{' '}
            Play
          </span>
          <span>
            <kbd className="font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 px-1 py-0.5 rounded">
              J / L
            </kbd>{' '}
            ±5s
          </span>
          <span>
            <kbd className="font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 px-1 py-0.5 rounded">
              Shift+←/→
            </kbd>{' '}
            ±0.1s
          </span>
          <span>
            <kbd className="font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 px-1 py-0.5 rounded">
              [ / ]
            </kbd>{' '}
            Jump In/Out
          </span>
        </div>
        <span className="font-mono text-zinc-500 hidden sm:inline">
          Drag bar to slip range
        </span>
      </div>
    </div>
  );
};
