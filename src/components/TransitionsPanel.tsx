import React, { useState, useEffect } from 'react';
import {
  Blend,
  RotateCcw,
  Check,
  Film,
  Play,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Clock,
  Scissors,
} from 'lucide-react';
import {
  CompilationTransitionType,
  ExportSettings,
  WipeDirection,
} from '../types';

interface TransitionsPanelProps {
  settings: ExportSettings;
  onUpdateSettings: (newSettings: Partial<ExportSettings>) => void;
  clipCount: number;
  onOpenCompilationExport: () => void;
}

interface TransitionOption {
  id: CompilationTransitionType;
  label: string;
  subtitle: string;
  engineLabel: string;
}

const TRANSITION_OPTIONS: TransitionOption[] = [
  {
    id: 'none',
    label: 'Hard Cut',
    subtitle: 'Instant frame-to-frame cut with no overlap or blend.',
    engineLabel: 'Direct concat',
  },
  {
    id: 'fade',
    label: 'Fade',
    subtitle: 'Dips smoothly through black between consecutive clips.',
    engineLabel: 'Dip to black',
  },
  {
    id: 'cross_dissolve',
    label: 'Cross-dissolve',
    subtitle: 'Gradual optical blend dissolving Clip A directly into Clip B.',
    engineLabel: 'Alpha blend',
  },
  {
    id: 'wipe',
    label: 'Wipe',
    subtitle: 'Clean directional sweep revealing the next clip across the frame.',
    engineLabel: 'Directional sweep',
  },
];

const WIPE_DIRECTIONS: Array<{
  id: WipeDirection;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'wipeleft', label: 'Left', Icon: ArrowLeft },
  { id: 'wiperight', label: 'Right', Icon: ArrowRight },
  { id: 'wipeup', label: 'Up', Icon: ArrowUp },
  { id: 'wipedown', label: 'Down', Icon: ArrowDown },
];

export const TransitionsPanel: React.FC<TransitionsPanelProps> = ({
  settings,
  onUpdateSettings,
  clipCount,
  onOpenCompilationExport,
}) => {
  const activeTransition: CompilationTransitionType =
    settings.compilationTransition || 'none';
  const durationSec = Number(settings.transitionDuration) || 0.6;
  const wipeDirection: WipeDirection = settings.wipeDirection || 'wipeleft';

  const [previewPhase, setPreviewPhase] = useState<'a' | 'transition' | 'b'>('a');
  const [previewNonce, setPreviewNonce] = useState(0);

  // Cycle animated stage preview whenever effect, duration, direction, or replay changes
  useEffect(() => {
    setPreviewPhase('a');
    const t1 = window.setTimeout(() => setPreviewPhase('transition'), 650);
    const t2 = window.setTimeout(
      () => setPreviewPhase('b'),
      650 + Math.round(durationSec * 1000)
    );
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [activeTransition, durationSec, wipeDirection, previewNonce]);

  const isDefault =
    activeTransition === 'none' &&
    Math.abs(durationSec - 0.6) < 0.05 &&
    wipeDirection === 'wipeleft';

  const handleReset = () => {
    onUpdateSettings({
      compilationTransition: 'none',
      transitionDuration: 0.6,
      wipeDirection: 'wipeleft',
    });
  };

  // Compute live CSS visual preview style for Clip B incoming layer
  const durMs = Math.round(durationSec * 1000);
  const getIncomingLayerStyle = (): React.CSSProperties => {
    if (previewPhase === 'a') {
      if (activeTransition === 'wipe') {
        const startClip: Record<WipeDirection, string> = {
          wipeleft: 'inset(0 0 0 100%)',
          wiperight: 'inset(0 100% 0 0)',
          wipeup: 'inset(100% 0 0 0)',
          wipedown: 'inset(0 0 100% 0)',
        };
        return {
          opacity: 1,
          clipPath: startClip[wipeDirection],
          transition: 'none',
        };
      }
      return { opacity: 0, transition: 'none' };
    }

    if (activeTransition === 'none') {
      return {
        opacity: previewPhase === 'transition' || previewPhase === 'b' ? 1 : 0,
        transition: 'none',
      };
    }

    if (activeTransition === 'cross_dissolve') {
      return {
        opacity: 1,
        transition: `opacity ${durMs}ms ease-in-out`,
      };
    }

    if (activeTransition === 'fade') {
      // Phase 'transition' dips Clip A down first, then reveals Clip B on second half
      return {
        opacity: previewPhase === 'b' ? 1 : 0,
        transition: `opacity ${Math.round(durMs * 0.55)}ms ease-in-out`,
      };
    }

    // Wipe
    return {
      opacity: 1,
      clipPath: 'inset(0 0 0 0)',
      transition: `clip-path ${durMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
    };
  };

  const getOutgoingLayerStyle = (): React.CSSProperties => {
    if (activeTransition === 'fade' && previewPhase === 'transition') {
      return {
        opacity: 0,
        transition: `opacity ${Math.round(durMs * 0.45)}ms ease-in-out`,
      };
    }
    if (activeTransition === 'fade' && previewPhase === 'b') {
      return { opacity: 0, transition: 'none' };
    }
    return { opacity: 1, transition: 'none' };
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/80 rounded-2xl border border-zinc-800 p-4 shadow-xl overflow-y-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Blend className="w-4 h-4 text-violet-400 shrink-0" />
          <div>
            <h3 className="text-xs font-semibold text-zinc-200">Compilation Transitions</h3>
            <div className="text-[11px] text-zinc-500">
              Applied between clips in Highlight Reel exports
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          disabled={isDefault}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          title="Reset to Hard Cut"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Live Visual Transition Preview Stage */}
      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 font-medium">Transition Preview</span>
          <div className="flex items-center gap-2">
            <span className="font-mono tabular-nums text-violet-300 text-[10px]">
              {TRANSITION_OPTIONS.find((t) => t.id === activeTransition)?.label}
              {activeTransition !== 'none' ? ` · ${durationSec.toFixed(1)}s` : ''}
            </span>
            <button
              type="button"
              onClick={() => setPreviewNonce((n) => n + 1)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-[10px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-2.5 h-2.5" />
              <span>Replay</span>
            </button>
          </div>
        </div>

        {/* Dual-Clip Compositor Stage */}
        <div className="relative h-24 w-full rounded-lg overflow-hidden bg-black border border-zinc-800 select-none">
          {/* Clip A (Outgoing) */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-zinc-900 to-teal-950 flex items-center justify-between px-4"
            style={getOutgoingLayerStyle()}
          >
            <div>
              <div className="text-[10px] font-mono text-emerald-400">Clip 01</div>
              <div className="text-xs font-semibold text-zinc-100">Opening Hook</div>
            </div>
            <div className="w-10 h-10 rounded-lg border border-emerald-500/30 bg-emerald-500/15 flex items-center justify-center text-xs font-mono text-emerald-300">
              A
            </div>
          </div>

          {/* Clip B (Incoming) */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-violet-950 via-zinc-900 to-indigo-950 flex items-center justify-between px-4"
            style={getIncomingLayerStyle()}
          >
            <div>
              <div className="text-[10px] font-mono text-violet-400">Clip 02</div>
              <div className="text-xs font-semibold text-zinc-100">Climax Payoff</div>
            </div>
            <div className="w-10 h-10 rounded-lg border border-violet-500/30 bg-violet-500/15 flex items-center justify-center text-xs font-mono text-violet-300">
              B
            </div>
          </div>
        </div>
      </div>

      {/* Effect Selector Grid */}
      <div className="space-y-2.5">
        <label className="block text-xs font-medium text-zinc-300">
          Select Transition Effect
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {TRANSITION_OPTIONS.map((opt) => {
            const isSelected = activeTransition === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onUpdateSettings({ compilationTransition: opt.id })}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer space-y-1.5 ${
                  isSelected
                    ? 'bg-zinc-800 border-violet-500 text-white ring-1 ring-violet-500/30'
                    : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {opt.id === 'none' ? (
                      <Scissors className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    ) : (
                      <Blend
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-violet-400' : 'text-zinc-400'
                        }`}
                      />
                    )}
                    <span className="text-xs font-semibold truncate">{opt.label}</span>
                  </div>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">{opt.subtitle}</p>
                <div className="text-[10px] font-mono text-zinc-500">{opt.engineLabel}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration & Wipe Direction Controls */}
      {activeTransition !== 'none' && (
        <div className="pt-3 border-t border-zinc-800 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                <Clock className="w-3.5 h-3.5 text-violet-400" />
                <span>Transition Duration</span>
              </span>
              <span className="font-mono tabular-nums text-violet-300">
                {durationSec.toFixed(1)}s
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[0.4, 0.6, 1.0, 1.5].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onUpdateSettings({ transitionDuration: sec })}
                  className={`py-1.5 rounded-lg text-[11px] font-mono tabular-nums border transition-colors cursor-pointer whitespace-nowrap ${
                    Math.abs(durationSec - sec) < 0.05
                      ? 'bg-violet-600/25 border-violet-500 text-violet-200 font-semibold'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                  }`}
                >
                  {sec.toFixed(1)}s
                </button>
              ))}
            </div>

            <input
              type="range"
              min={0.2}
              max={2.0}
              step={0.1}
              value={durationSec}
              onChange={(e) =>
                onUpdateSettings({ transitionDuration: Number(e.target.value) })
              }
              className="w-full accent-violet-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>

          {activeTransition === 'wipe' && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-300">
                Wipe Direction
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {WIPE_DIRECTIONS.map(({ id, label, Icon }) => {
                  const selected = wipeDirection === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onUpdateSettings({ wipeDirection: id })}
                      className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                        selected
                          ? 'bg-violet-600/25 border-violet-500 text-violet-200'
                          : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Direct Compilation Export Trigger */}
      <div className="pt-3 border-t border-zinc-800 space-y-2 mt-auto">
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span>Available clips in project</span>
          <span className="font-mono tabular-nums text-zinc-200">{clipCount} clips</span>
        </div>

        <button
          type="button"
          disabled={clipCount < 2}
          onClick={onOpenCompilationExport}
          className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Film className="w-4 h-4 shrink-0" />
          <span>
            {clipCount < 2
              ? 'Need 2+ clips for compilation'
              : `Export Compilation Reel (${Math.min(10, clipCount)} clips)`}
          </span>
        </button>
      </div>
    </div>
  );
};
