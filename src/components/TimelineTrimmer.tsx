import React, { useRef, useState } from 'react';
import { Scissors, Play, Pause, ChevronLeft, ChevronRight, Clock, FastForward, Rewind } from 'lucide-react';
import { ClipHighlight } from '../types';

interface TimelineTrimmerProps {
  totalVideoDuration: number;
  activeClip: ClipHighlight;
  currentTime: number;
  onUpdateClipTime: (newStart: number, newEnd: number) => void;
  onSeek: (time: number) => void;
}

export const TimelineTrimmer: React.FC<TimelineTrimmerProps> = ({
  totalVideoDuration,
  activeClip,
  currentTime,
  onUpdateClipTime,
  onSeek,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);

  const duration = Math.max(1, activeClip.endTime - activeClip.startTime);
  const total = Math.max(1, totalVideoDuration || 300);

  // Calculate percentages
  const startPercent = (activeClip.startTime / total) * 100;
  const endPercent = (activeClip.endTime / total) * 100;
  const currentPercent = (currentTime / total) * 100;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * total;
    onSeek(targetTime);
  };

  const setDurationPreset = (targetDuration: number) => {
    let newEnd = activeClip.startTime + targetDuration;
    if (newEnd > total) {
      newEnd = total;
    }
    onUpdateClipTime(activeClip.startTime, newEnd);
  };

  const adjustStart = (delta: number) => {
    const newStart = Math.max(0, Math.min(activeClip.endTime - 3, activeClip.startTime + delta));
    onUpdateClipTime(newStart, activeClip.endTime);
  };

  const adjustEnd = (delta: number) => {
    const newEnd = Math.max(activeClip.startTime + 3, Math.min(total, activeClip.endTime + delta));
    onUpdateClipTime(activeClip.startTime, newEnd);
  };

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${mins}:${String(secs).padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Scissors className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-200">Timeline & Clip Trimmer</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-800 text-amber-400 border border-slate-700">
            {formatSec(duration)}s
          </span>
        </div>

        {/* Duration Presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline">Presets:</span>
          {[
            { label: '15s Story', sec: 15 },
            { label: '30s TikTok', sec: 30 },
            { label: '60s Shorts', sec: 60 },
          ].map((preset) => (
            <button
              key={preset.sec}
              onClick={() => setDurationPreset(preset.sec)}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700 transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Timeline Track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative h-14 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden cursor-pointer select-none group"
      >
        {/* Waveform bars simulation */}
        <div className="absolute inset-0 flex items-center justify-between px-2 gap-0.5 opacity-40 group-hover:opacity-60 transition-opacity">
          {Array.from({ length: 60 }).map((_, i) => {
            const heightFactor = Math.sin(i * 0.4) * 0.4 + Math.cos(i * 0.8) * 0.3 + 0.35;
            const heightPercent = Math.max(15, Math.min(95, heightFactor * 100));
            return (
              <div
                key={i}
                className="w-1 rounded-full bg-slate-600 transition-all"
                style={{ height: `${heightPercent}%` }}
              />
            );
          })}
        </div>

        {/* Selected Clip Highlight Range */}
        <div
          className="absolute top-0 bottom-0 bg-amber-500/20 border-y-2 border-amber-500"
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(1, endPercent - startPercent)}%`,
          }}
        >
          {/* Waveform highlight inside selection */}
          <div className="absolute inset-0 flex items-center justify-between gap-0.5 px-1 opacity-70">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-amber-400"
                style={{
                  height: `${Math.sin(i * 0.7) * 40 + 50}%`,
                }}
              />
            ))}
          </div>

          {/* Left In-Point Handle */}
          <div className="absolute top-0 bottom-0 left-0 w-3.5 bg-amber-500 rounded-l cursor-ew-resize flex items-center justify-center shadow-lg group/handle">
            <div className="w-1 h-4 bg-slate-950 rounded-full" />
          </div>

          {/* Right Out-Point Handle */}
          <div className="absolute top-0 bottom-0 right-0 w-3.5 bg-amber-500 rounded-r cursor-ew-resize flex items-center justify-center shadow-lg group/handle">
            <div className="w-1 h-4 bg-slate-950 rounded-full" />
          </div>
        </div>

        {/* Playhead needle */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-md shadow-white/50 pointer-events-none z-10"
          style={{ left: `${Math.min(100, Math.max(0, currentPercent))}%` }}
        >
          <div className="w-3 h-3 bg-white rotate-45 -ml-1 -mt-1 rounded-xs shadow" />
        </div>
      </div>

      {/* Fine-Tuning Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
        {/* Start adjustment */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">In-Point:</span>
          <button
            onClick={() => adjustStart(-1)}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            title="-1s"
          >
            <Rewind className="w-3 h-3" />
          </button>
          <span className="font-mono text-slate-200 font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
            {formatSec(activeClip.startTime)}
          </span>
          <button
            onClick={() => adjustStart(1)}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            title="+1s"
          >
            <FastForward className="w-3 h-3" />
          </button>
        </div>

        {/* Current Playhead */}
        <div className="text-slate-400 font-mono text-[11px]">
          Playhead: <span className="text-amber-400 font-bold">{formatSec(currentTime)}</span>
        </div>

        {/* End adjustment */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Out-Point:</span>
          <button
            onClick={() => adjustEnd(-1)}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            title="-1s"
          >
            <Rewind className="w-3 h-3" />
          </button>
          <span className="font-mono text-slate-200 font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
            {formatSec(activeClip.endTime)}
          </span>
          <button
            onClick={() => adjustEnd(1)}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            title="+1s"
          >
            <FastForward className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
