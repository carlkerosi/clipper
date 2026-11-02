import React, { useState, useEffect } from 'react';
import {
  Type,
  Sparkles,
  Zap,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
  Eye,
  EyeOff,
  Activity,
  Maximize2,
  Minimize2,
  Scissors,
  RotateCcw,
  Check,
  Wand2,
} from 'lucide-react';
import {
  CaptionPreset,
  ExportSettings,
  ClipHighlight,
  CaptionEntranceAnimation,
  CaptionExitAnimation,
} from '../types';

interface CaptionStyleCustomizerProps {
  settings: ExportSettings;
  activeClip: ClipHighlight;
  onUpdateSettings: (newSettings: Partial<ExportSettings>) => void;
}

export const CaptionStyleCustomizer: React.FC<CaptionStyleCustomizerProps> = ({
  settings,
  activeClip,
  onUpdateSettings,
}) => {
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
  const [suggestedHooks, setSuggestedHooks] = useState<Array<{ angle: string; text: string; emoji: string }>>([]);
  const [showHookSuggestions, setShowHookSuggestions] = useState(false);

  // Motion animation preview state
  const [animationTab, setAnimationTab] = useState<'entrance' | 'exit' | 'combos'>('entrance');
  const [previewKey, setPreviewKey] = useState(0);
  const [previewPhase, setPreviewPhase] = useState<'entrance' | 'sustain' | 'exit'>('entrance');

  const currentEntrance = settings.captionEntranceAnim || 'pop';
  const currentExit = settings.captionExitAnim || 'fade';

  useEffect(() => {
    setPreviewPhase('entrance');
    const timer1 = setTimeout(() => {
      setPreviewPhase('sustain');
    }, 700);

    const timer2 = setTimeout(() => {
      setPreviewPhase('exit');
    }, 1700);

    const timer3 = setTimeout(() => {
      setPreviewPhase('entrance');
    }, 2400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [currentEntrance, currentExit, previewKey]);

  const handleReplayAnimation = () => {
    setPreviewKey((k) => k + 1);
  };

  const presets: Array<{ id: CaptionPreset; label: string; desc: string; sample: string }> = [
    {
      id: 'hormozi',
      label: 'Hormozi / MrBeast',
      desc: 'Bold uppercase, black stroke, bouncing active word',
      sample: 'WAIT FOR IT',
    },
    {
      id: 'tiktok_neon',
      label: 'TikTok Neon Glow',
      desc: 'Cyan/Lime illuminated box with smooth glow',
      sample: 'VIRAL MOMENT',
    },
    {
      id: 'beast_flame',
      label: 'Beast Flame 🔥',
      desc: 'Fiery gradient with intense high-energy punch',
      sample: 'INSANE CLIMAX',
    },
    {
      id: 'karaoke_fill',
      label: 'Karaoke Gradient',
      desc: 'Word-by-word highlighted singing cadence',
      sample: 'FLOWING TEXT',
    },
    {
      id: 'minimal_cinema',
      label: 'Minimal Cinema',
      desc: 'Crisp film aesthetic with subtle dark matte',
      sample: 'Documentary',
    },
  ];

  const entranceOptions: Array<{
    id: CaptionEntranceAnimation;
    label: string;
    tag: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'pop',
      label: 'Pop Spring',
      tag: 'Bouncy Snap',
      desc: 'Snappy scale spring with elastic overshoot',
      icon: <Zap className="w-3.5 h-3.5 text-amber-400" />,
    },
    {
      id: 'slide_up',
      label: 'Slide Up',
      tag: 'Kinetic Rise',
      desc: 'Smooth upward ascent with motion blur flare',
      icon: <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />,
    },
    {
      id: 'slide_down',
      label: 'Slide Down',
      tag: 'Drop Impact',
      desc: 'High-impact drop from above into center',
      icon: <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />,
    },
    {
      id: 'fade',
      label: 'Cinematic Fade',
      tag: 'Dissolve',
      desc: 'Smooth cinematic transparency dissolve',
      icon: <Eye className="w-3.5 h-3.5 text-blue-400" />,
    },
    {
      id: 'bounce',
      label: 'Elastic Bounce',
      tag: 'Double Rebound',
      desc: 'Playful harmonic bounce with physical weight',
      icon: <Activity className="w-3.5 h-3.5 text-rose-400" />,
    },
    {
      id: 'zoom_in',
      label: 'Punch Zoom',
      tag: 'Scale Blast',
      desc: 'Aggressive 0.2x to 1x zoom-in punch',
      icon: <Maximize2 className="w-3.5 h-3.5 text-violet-400" />,
    },
    {
      id: 'glow_burst',
      label: 'Glow Burst',
      tag: 'Neon Flare',
      desc: 'Luminous radiant light flash into view',
      icon: <Sparkles className="w-3.5 h-3.5 text-amber-300" />,
    },
  ];

  const exitOptions: Array<{
    id: CaptionExitAnimation;
    label: string;
    tag: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'fade',
      label: 'Smooth Fade',
      tag: 'Clean Dissolve',
      desc: 'Gradual invisible transparency decay',
      icon: <EyeOff className="w-3.5 h-3.5 text-zinc-400" />,
    },
    {
      id: 'slide_down',
      label: 'Slide Down',
      tag: 'Drop Off',
      desc: 'Accelerates smoothly down off stage',
      icon: <ArrowDownToLine className="w-3.5 h-3.5 text-amber-400" />,
    },
    {
      id: 'slide_up',
      label: 'Slide Up',
      tag: 'Ascend Out',
      desc: 'Rises into the upper frame and vanishes',
      icon: <ArrowUpToLine className="w-3.5 h-3.5 text-cyan-400" />,
    },
    {
      id: 'shrink',
      label: 'Pinpoint Shrink',
      tag: 'Center Scale',
      desc: 'Collapses inward to a micro point',
      icon: <Minimize2 className="w-3.5 h-3.5 text-violet-400" />,
    },
    {
      id: 'pop_out',
      label: 'Snappy Pop Out',
      tag: 'Blast Out',
      desc: 'Quick pulse expansion then snappy vanish',
      icon: <Zap className="w-3.5 h-3.5 text-rose-400" />,
    },
    {
      id: 'none',
      label: 'Instant Cut',
      tag: 'Zero Latency',
      desc: 'Clean hard cut directly to next phrase',
      icon: <Scissors className="w-3.5 h-3.5 text-zinc-500" />,
    },
  ];

  const viralCombos: Array<{
    name: string;
    entrance: CaptionEntranceAnimation;
    exit: CaptionExitAnimation;
    desc: string;
  }> = [
    {
      name: 'MrBeast Energy',
      entrance: 'pop',
      exit: 'pop_out',
      desc: 'Snappy pop-in with explosive vanish',
    },
    {
      name: 'TikTok Flow',
      entrance: 'slide_up',
      exit: 'slide_down',
      desc: 'Kinetic upward rise with smooth drop',
    },
    {
      name: 'Documentary Cinema',
      entrance: 'fade',
      exit: 'fade',
      desc: 'Subtle dissolves that keep focus on story',
    },
    {
      name: 'Podcast Punch',
      entrance: 'zoom_in',
      exit: 'shrink',
      desc: 'Zoom impact entrance with pinpoint shrink',
    },
    {
      name: 'Neon Viral Flare',
      entrance: 'glow_burst',
      exit: 'fade',
      desc: 'Glowing illumination burst with clean fade',
    },
  ];

  const colorSwatches = [
    { name: 'Yellow', hex: '#FACC15' },
    { name: 'Cyan', hex: '#06B6D4' },
    { name: 'Lime', hex: '#84CC16' },
    { name: 'Orange', hex: '#F97316' },
    { name: 'Rose', hex: '#F43F5E' },
    { name: 'White', hex: '#FFFFFF' },
  ];

  const handleGenerateHooks = async () => {
    setIsGeneratingHooks(true);
    setShowHookSuggestions(true);
    try {
      const res = await fetch('/api/suggest-hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipTitle: activeClip.title,
          quote: activeClip.hook,
          category: activeClip.category,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.hooks && data.hooks.length > 0) {
          setSuggestedHooks(data.hooks);
        }
      }
    } catch (err) {
      console.error('Failed to generate hooks:', err);
    } finally {
      setIsGeneratingHooks(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/80 rounded-2xl border border-zinc-800 p-4 shadow-xl overflow-y-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-violet-400" />
          <div>
            <h3 className="text-xs font-semibold text-zinc-200">Subtitles & Kinetic Motion</h3>
            <div className="text-[11px] text-zinc-500">Typography styles & transition dynamics</div>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
          Studio V2
        </span>
      </div>

      {/* Kinetic Motion & Transition Studio */}
      <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 p-3.5 space-y-3 shadow-inner">
        {/* Section Title & Replay Button */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-zinc-200">Motion System</div>
            <div className="text-[11px] text-zinc-500 font-mono">
              In: {currentEntrance} · Out: {currentExit}
            </div>
          </div>

          <button
            onClick={handleReplayAnimation}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors cursor-pointer"
            title="Replay Motion Effect"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Replay</span>
          </button>
        </div>

        {/* Live Interactive Sandbox Card */}
        <div className="relative h-20 rounded-lg bg-black/60 border border-zinc-800 flex flex-col items-center justify-center overflow-hidden p-3 select-none">
          <div className="absolute top-2 left-2 text-[10px] font-mono text-zinc-500 uppercase">
            {previewPhase === 'entrance' ? '1. Entrance' : previewPhase === 'sustain' ? '2. Spoken' : '3. Exit'}
          </div>

          <div className="absolute top-2 right-2 text-[10px] font-mono text-zinc-500 tabular-nums">
            60 FPS
          </div>

          {/* Animated Caption Text Node */}
          <div
            key={`${previewKey}-${currentEntrance}-${currentExit}-${previewPhase}`}
            className={`relative z-10 transition-all ${
              previewPhase === 'entrance'
                ? `anim-entrance-${currentEntrance}`
                : previewPhase === 'exit'
                ? `anim-exit-${currentExit}`
                : 'scale-100 opacity-100'
            }`}
          >
            {settings.captionPreset === 'hormozi' && (
              <div className="px-3 py-1 rounded-md bg-black/80 border border-zinc-700">
                <span className="text-sm font-black text-white tracking-wide uppercase">
                  WAIT <span style={{ color: settings.captionColor }}>FOR</span> IT
                </span>
              </div>
            )}

            {settings.captionPreset === 'tiktok_neon' && (
              <div className="px-3 py-1 rounded-md bg-black/75 border border-cyan-400/80 shadow-[0_0_12px_rgba(6,182,212,0.4)]">
                <span className="text-sm font-black text-cyan-300 uppercase">
                  VIRAL MOMENT
                </span>
              </div>
            )}

            {settings.captionPreset === 'beast_flame' && (
              <div className="px-3 py-1 rounded-md bg-black/80 border border-orange-500/60">
                <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-yellow-300 uppercase">
                  🔥 INSANE CLIMAX
                </span>
              </div>
            )}

            {settings.captionPreset === 'karaoke_fill' && (
              <div className="px-3 py-1 rounded-md bg-black/80 border border-zinc-700">
                <span className="text-sm font-black text-amber-400">
                  FLOWING CADENCE
                </span>
              </div>
            )}

            {settings.captionPreset === 'minimal_cinema' && (
              <div className="px-3 py-1 rounded bg-black/70 border border-white/20 text-xs font-medium text-white">
                Cinematic Dialogue
              </div>
            )}
          </div>
        </div>

        {/* Animation Sub-Tabs */}
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-zinc-900 rounded-lg border border-zinc-800">
          <button
            onClick={() => setAnimationTab('entrance')}
            className={`py-1 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              animationTab === 'entrance'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Entrance ({entranceOptions.length})
          </button>
          <button
            onClick={() => setAnimationTab('exit')}
            className={`py-1 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              animationTab === 'exit'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Exit ({exitOptions.length})
          </button>
          <button
            onClick={() => setAnimationTab('combos')}
            className={`py-1 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              animationTab === 'combos'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Combos
          </button>
        </div>

        {/* 1. Entrance Selector */}
        {animationTab === 'entrance' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-52 overflow-y-auto pr-0.5">
            {entranceOptions.map((opt) => {
              const isSelected = currentEntrance === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    onUpdateSettings({ captionEntranceAnim: opt.id });
                    handleReplayAnimation();
                  }}
                  className={`p-2 rounded-xl border text-left transition-colors cursor-pointer flex items-start gap-2 ${
                    isSelected
                      ? 'bg-zinc-800 border-violet-500 text-white ring-1 ring-violet-500/30'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="p-1 rounded-md bg-zinc-950 shrink-0 mt-0.5">
                    {opt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-200">{opt.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-zinc-500 line-clamp-1">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 2. Exit Selector */}
        {animationTab === 'exit' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-52 overflow-y-auto pr-0.5">
            {exitOptions.map((opt) => {
              const isSelected = currentExit === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    onUpdateSettings({ captionExitAnim: opt.id });
                    handleReplayAnimation();
                  }}
                  className={`p-2 rounded-xl border text-left transition-colors cursor-pointer flex items-start gap-2 ${
                    isSelected
                      ? 'bg-zinc-800 border-violet-500 text-white ring-1 ring-violet-500/30'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="p-1 rounded-md bg-zinc-950 shrink-0 mt-0.5">
                    {opt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-200">{opt.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-zinc-500 line-clamp-1">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 3. Combos */}
        {animationTab === 'combos' && (
          <div className="space-y-1.5 pt-1 max-h-52 overflow-y-auto pr-0.5">
            {viralCombos.map((combo) => {
              const isComboActive =
                currentEntrance === combo.entrance && currentExit === combo.exit;
              return (
                <button
                  key={combo.name}
                  onClick={() => {
                    onUpdateSettings({
                      captionEntranceAnim: combo.entrance,
                      captionExitAnim: combo.exit,
                    });
                    handleReplayAnimation();
                  }}
                  className={`w-full p-2.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    isComboActive
                      ? 'bg-zinc-800 border-violet-500 text-white ring-1 ring-violet-500/30'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                  }`}
                >
                  <div>
                    <div className="text-xs font-medium text-zinc-200">{combo.name}</div>
                    <div className="text-[10px] text-zinc-500">{combo.desc}</div>
                  </div>

                  <div className="text-right shrink-0 font-mono text-[10px] text-zinc-400">
                    {combo.entrance} + {combo.exit}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Preset Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-zinc-300">
          Visual Style Preset
        </label>
        <div className="grid grid-cols-1 gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onUpdateSettings({ captionPreset: preset.id })}
              className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between ${
                settings.captionPreset === preset.id
                  ? 'bg-zinc-800 border-violet-500 text-white'
                  : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 text-zinc-400'
              }`}
            >
              <div>
                <div className="text-xs font-medium text-zinc-200">{preset.label}</div>
                <div className="text-[11px] text-zinc-500">{preset.desc}</div>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/60 text-zinc-300 border border-zinc-800">
                {preset.sample}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Word Highlight Color */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-zinc-300">
          Highlight Accent Color
        </label>
        <div className="flex items-center gap-2">
          {colorSwatches.map((swatch) => (
            <button
              key={swatch.hex}
              onClick={() => onUpdateSettings({ captionColor: swatch.hex })}
              className={`w-7 h-7 rounded-lg transition-all cursor-pointer flex items-center justify-center border ${
                settings.captionColor === swatch.hex
                  ? 'scale-110 border-white shadow-md'
                  : 'border-zinc-700 hover:scale-105'
              }`}
              style={{ backgroundColor: swatch.hex }}
              title={swatch.name}
            >
              {settings.captionColor === swatch.hex && (
                <Check className={`w-3.5 h-3.5 ${swatch.hex === '#FFFFFF' ? 'text-black' : 'text-zinc-950 font-bold'}`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Position & Size */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Vertical Position
          </label>
          <select
            value={settings.captionPosition}
            onChange={(e) =>
              onUpdateSettings({
                captionPosition: e.target.value as 'top' | 'middle' | 'lower_third' | 'bottom',
              })
            }
            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer"
          >
            <option value="top">Top (25%)</option>
            <option value="middle">Center (50%)</option>
            <option value="lower_third">Lower Third (72%)</option>
            <option value="bottom">Bottom (84%)</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-medium text-zinc-300 mb-1.5">
            <span>Font Size</span>
            <span className="font-mono tabular-nums text-zinc-400">{settings.captionFontSize}px</span>
          </div>
          <input
            type="range"
            min={24}
            max={52}
            value={settings.captionFontSize}
            onChange={(e) => onUpdateSettings({ captionFontSize: Number(e.target.value) })}
            className="w-full accent-violet-500 h-1 bg-zinc-800 rounded-lg cursor-pointer mt-1"
          />
        </div>
      </div>

      {/* Top Hook Banner Sticker */}
      <div className="pt-3 border-t border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-200">
            Top Hook Banner Sticker
          </label>
          <input
            type="checkbox"
            checked={settings.showHookBanner}
            onChange={(e) => onUpdateSettings({ showHookBanner: e.target.checked })}
            className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
          />
        </div>

        {settings.showHookBanner && (
          <div className="space-y-2">
            <input
              type="text"
              value={settings.hookBannerText || activeClip.hook}
              onChange={(e) => onUpdateSettings({ hookBannerText: e.target.value })}
              placeholder="Enter viral 3-second hook text..."
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
            />

            <button
              onClick={handleGenerateHooks}
              disabled={isGeneratingHooks}
              className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 text-violet-400 ${isGeneratingHooks ? 'animate-spin' : ''}`} />
              <span>{isGeneratingHooks ? 'Generating hooks...' : 'AI Generate 5 Alternative Hooks'}</span>
            </button>

            {showHookSuggestions && suggestedHooks.length > 0 && (
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                  Click to Apply:
                </div>
                {suggestedHooks.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => onUpdateSettings({ hookBannerText: `${h.emoji} ${h.text}` })}
                    className="w-full text-left p-1.5 rounded-md hover:bg-zinc-900 text-xs text-zinc-300 hover:text-white transition-colors flex items-start gap-1.5 cursor-pointer"
                  >
                    <span>{h.emoji}</span>
                    <span className="flex-1">{h.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* TikTok Bottom Progress Bar */}
      <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-200">
          Bottom Progress Bar Line
        </label>
        <div className="flex items-center gap-2">
          {settings.showProgressBar && (
            <div className="flex items-center gap-1">
              {['#EF4444', '#F59E0B', '#FFFFFF', '#06B6D4', '#8B5CF6'].map((col) => (
                <button
                  key={col}
                  onClick={() => onUpdateSettings({ progressBarColor: col })}
                  className={`w-3.5 h-3.5 rounded-full border ${
                    settings.progressBarColor === col ? 'border-white scale-125' : 'border-zinc-700'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          )}
          <input
            type="checkbox"
            checked={settings.showProgressBar}
            onChange={(e) => onUpdateSettings({ showProgressBar: e.target.checked })}
            className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
