import React, { useState } from 'react';
import { Palette, RotateCcw, Check, Sun, Contrast, Droplets, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { ExportSettings, VideoFilterPreset } from '../types';
import { VIDEO_FILTER_PRESETS, getCssFilterString } from '../utils/videoFilters';

interface VideoEffectsPanelProps {
  settings: ExportSettings;
  onUpdateSettings: (newSettings: Partial<ExportSettings>) => void;
  videoUrl?: string;
  playableSourceUrl?: string;
  videoTitle?: string;
  clipHook?: string;
  currentTimestamp?: number;
}

export const VideoEffectsPanel: React.FC<VideoEffectsPanelProps> = ({
  settings,
  onUpdateSettings,
  videoUrl,
  playableSourceUrl,
  videoTitle,
  clipHook,
  currentTimestamp = 1,
}) => {
  const [isAutoGrading, setIsAutoGrading] = useState(false);
  const [gradeNote, setGradeNote] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);

  const activePreset = settings.videoFilter || 'none';
  const brightness = settings.filterBrightness ?? 100;
  const contrast = settings.filterContrast ?? 100;
  const saturate = settings.filterSaturate ?? 100;
  const activeCssFilter = getCssFilterString(settings);

  const isDefault =
    activePreset === 'none' &&
    brightness === 100 &&
    contrast === 100 &&
    saturate === 100;

  const handleResetAll = () => {
    setGradeNote(null);
    setGradeError(null);
    onUpdateSettings({
      videoFilter: 'none',
      filterBrightness: 100,
      filterContrast: 100,
      filterSaturate: 100,
    });
  };

  const handleAiAutoGrade = async () => {
    setIsAutoGrading(true);
    setGradeError(null);
    setGradeNote(null);
    try {
      const res = await fetch('/api/ai-color-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          playableSourceUrl,
          timestamp: currentTimestamp,
          title: videoTitle,
          hook: clipHook,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI color grading failed.');
      }
      onUpdateSettings({
        videoFilter: (data.videoFilter as VideoFilterPreset) || 'vivid',
        filterBrightness: data.filterBrightness ?? 100,
        filterContrast: data.filterContrast ?? 100,
        filterSaturate: data.filterSaturate ?? 100,
      });
      if (data.rationale) {
        setGradeNote(data.rationale);
      }
    } catch (err: any) {
      setGradeError(err.message || 'Could not auto-grade frame.');
    } finally {
      setIsAutoGrading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/80 rounded-2xl border border-zinc-800 p-4 shadow-xl overflow-y-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-violet-400" />
          <div>
            <h3 className="text-xs font-semibold text-zinc-200">Video Effects & Color</h3>
            <div className="text-[11px] text-zinc-500">Live CSS color grading & AI Vision</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleAiAutoGrade}
            disabled={isAutoGrading}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs font-semibold border border-violet-500/40 transition-colors cursor-pointer disabled:opacity-50"
            title="Inspect frame with Gemini Vision and auto-select color grade"
          >
            {isAutoGrading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            <span>{isAutoGrading ? 'Grading...' : 'AI Auto-Grade'}</span>
          </button>

          <button
            onClick={handleResetAll}
            disabled={isDefault}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Reset all video effects"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {gradeError && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{gradeError}</span>
        </div>
      )}

      {gradeNote && (
        <div className="p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/30 text-[11px] text-violet-200 flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
          <span>{gradeNote}</span>
        </div>
      )}

      {/* Active Filter Status */}
      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 font-medium">Active CSS Filter</span>
          <span className="font-mono text-violet-400 uppercase text-[10px]">
            {VIDEO_FILTER_PRESETS.find((p) => p.id === activePreset)?.label || 'Original'}
          </span>
        </div>
        <div className="px-2.5 py-1.5 rounded-lg bg-black/70 border border-zinc-800/80 font-mono text-[11px] text-zinc-300 truncate">
          filter: {activeCssFilter};
        </div>
      </div>

      {/* Color Grading Presets */}
      <div className="space-y-2.5">
        <label className="block text-xs font-medium text-zinc-300">
          Color Grading Presets
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {VIDEO_FILTER_PRESETS.map((preset) => {
            const isSelected = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onUpdateSettings({ videoFilter: preset.id })}
                className={`group p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 ${
                  isSelected
                    ? 'bg-zinc-800 border-violet-500 text-white ring-1 ring-violet-500/30'
                    : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {/* Visual Filter Swatch Preview */}
                <div className="relative h-12 w-full rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800/80">
                  <div
                    className="w-full h-full bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-600 flex items-center justify-center"
                    style={{ filter: preset.css || 'none' }}
                  >
                    <div className="w-6 h-6 rounded-full bg-white/90 shadow-md" />
                  </div>
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-violet-600 text-white flex items-center justify-center shadow">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-medium text-zinc-200 truncate">{preset.label}</div>
                  <div className="text-[10px] text-zinc-500 line-clamp-1">{preset.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fine-Tune Sliders */}
      <div className="pt-3 border-t border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-300">Fine-Tune Adjustments</label>
          <span className="text-[10px] font-mono text-zinc-500">Live Preview</span>
        </div>

        {/* Brightness */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Brightness</span>
            </span>
            <span className="font-mono tabular-nums text-zinc-400">{brightness}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={150}
            value={brightness}
            onChange={(e) => onUpdateSettings({ filterBrightness: Number(e.target.value) })}
            className="w-full accent-violet-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Contrast */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Contrast className="w-3.5 h-3.5 text-cyan-400" />
              <span>Contrast</span>
            </span>
            <span className="font-mono tabular-nums text-zinc-400">{contrast}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={200}
            value={contrast}
            onChange={(e) => onUpdateSettings({ filterContrast: Number(e.target.value) })}
            className="w-full accent-violet-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Saturation */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Droplets className="w-3.5 h-3.5 text-rose-400" />
              <span>Saturation</span>
            </span>
            <span className="font-mono tabular-nums text-zinc-400">{saturate}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            value={saturate}
            onChange={(e) => onUpdateSettings({ filterSaturate: Number(e.target.value) })}
            className="w-full accent-violet-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
