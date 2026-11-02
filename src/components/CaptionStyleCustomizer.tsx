import React, { useState, useEffect } from 'react';
import {
  Type,
  Sparkles,
  Palette,
  Flame,
  Check,
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
  Play,
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

  // Run preview cycle whenever entrance or exit changes, or on manual trigger
  useEffect(() => {
    setPreviewPhase('entrance');
    const timer1 = setTimeout(() => {
      setPreviewPhase('sustain');
    }, 700);

    const timer2 = setTimeout(() => {
      setPreviewPhase('exit');
    }, 1700);

    const timer3 = setTimeout(() => {
      // Loop or idle
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
      icon: <Maximize2 className="w-3.5 h-3.5 text-purple-400" />,
    },
    {
      id: 'glow_burst',
      label: 'Glow Burst',
      tag: 'Neon Flare',
      desc: 'Luminous radiant light flash into view',
      icon: <Sparkles className="w-3.5 h-3.5 text-yellow-300" />,
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
      icon: <EyeOff className="w-3.5 h-3.5 text-slate-400" />,
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
      icon: <Minimize2 className="w-3.5 h-3.5 text-purple-400" />,
    },
    {
      id: 'pop_out',
      label: 'Snappy Pop Out',
      tag: 'Blast Out',
      desc: 'Quick pulse expansion then snappy vanish',
      icon: <Flame className="w-3.5 h-3.5 text-rose-400" />,
    },
    {
      id: 'none',
      label: 'Instant Cut',
      tag: 'Zero Latency',
      desc: 'Clean hard cut directly to next phrase',
      icon: <Scissors className="w-3.5 h-3.5 text-slate-500" />,
    },
  ];

  const viralCombos: Array<{
    name: string;
    entrance: CaptionEntranceAnimation;
    exit: CaptionExitAnimation;
    badge: string;
    desc: string;
  }> = [
    {
      name: 'MrBeast Energy',
      entrance: 'pop',
      exit: 'pop_out',
      badge: 'High Retention',
      desc: 'Snappy pop-in with energetic explosive exit',
    },
    {
      name: 'TikTok Flow',
      entrance: 'slide_up',
      exit: 'slide_down',
      badge: 'Creator Trend',
      desc: 'Kinetic upward rise with smooth drop off stage',
    },
    {
      name: 'Documentary Cinema',
      entrance: 'fade',
      exit: 'fade',
      badge: 'Elegant',
      desc: 'Subtle dissolves that keep all focus on story',
    },
    {
      name: 'Podcast Punch',
      entrance: 'zoom_in',
      exit: 'shrink',
      badge: 'Impact',
      desc: 'Zoom impact entrance with pinpoint shrink exit',
    },
    {
      name: 'Neon Viral Flare',
      entrance: 'glow_burst',
      exit: 'fade',
      badge: 'Cyber Glow',
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
    <div className="flex flex-col h-full bg-slate-900/60 rounded-2xl border border-slate-800 p-4 shadow-xl overflow-y-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Type className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Automated Captions & Animations</h3>
            <div className="text-[11px] text-slate-400">Kinetic typography & transition engine</div>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
          Opus Style
        </span>
      </div>

      {/* ============================================================
          NEW: KINETIC ENTRANCE & EXIT ANIMATION STUDIO SECTION
          ============================================================ */}
      <div className="rounded-xl bg-slate-950/70 border border-slate-800/90 p-3.5 space-y-3.5 shadow-inner">
        {/* Section Title & Replay Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-amber-500/10 text-amber-400">
              <Zap className="w-3.5 h-3.5 fill-amber-400/30" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">Motion & Transitions</div>
              <div className="text-[10px] text-slate-400">
                Entrance: <span className="text-amber-400 font-semibold">{currentEntrance.replace('_', ' ')}</span> · Exit:{' '}
                <span className="text-cyan-400 font-semibold">{currentExit.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleReplayAnimation}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-amber-300 text-[11px] font-semibold border border-slate-700/80 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Replay Motion Effect"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Preview</span>
          </button>
        </div>

        {/* Live Interactive Sandbox Card */}
        <div className="relative h-24 rounded-lg bg-black/60 border border-slate-800 flex flex-col items-center justify-center overflow-hidden p-3 select-none">
          {/* Subtle audio waves background */}
          <div className="absolute inset-0 opacity-15 pointer-events-none flex items-center justify-around px-4">
            {[40, 75, 55, 90, 60, 85, 45, 95, 70, 50, 80].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-amber-400 rounded-full transition-all duration-300"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>

          {/* Phase Badge */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                previewPhase === 'entrance'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : previewPhase === 'sustain'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
              }`}
            >
              {previewPhase === 'entrance' ? '1. Entrance Anim' : previewPhase === 'sustain' ? '2. Spoken Hold' : '3. Exit Anim'}
            </span>
          </div>

          <div className="absolute top-2 right-2 text-[9px] font-mono text-slate-500">
            60 FPS Render
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
              <div className="px-3.5 py-1.5 rounded-lg bg-black/80 border border-amber-500/50 shadow-xl">
                <span className="text-sm font-black text-white tracking-wide uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  WAIT <span style={{ color: settings.captionColor }}>FOR</span> IT
                </span>
              </div>
            )}

            {settings.captionPreset === 'tiktok_neon' && (
              <div className="px-3.5 py-1.5 rounded-lg bg-black/75 border border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                <span className="text-sm font-black text-cyan-300 tracking-wide uppercase">
                  VIRAL MOMENT
                </span>
              </div>
            )}

            {settings.captionPreset === 'beast_flame' && (
              <div className="px-3 py-1 rounded-lg bg-black/80 border border-orange-500/60 shadow-xl">
                <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-yellow-300 uppercase">
                  🔥 INSANE CLIMAX 🔥
                </span>
              </div>
            )}

            {settings.captionPreset === 'karaoke_fill' && (
              <div className="px-3 py-1 rounded-lg bg-black/80 border border-slate-700 shadow-xl">
                <span className="text-sm font-black text-amber-400 tracking-wide">
                  FLOWING TEXT CADENCE
                </span>
              </div>
            )}

            {settings.captionPreset === 'minimal_cinema' && (
              <div className="px-3 py-1 rounded bg-black/70 border border-white/20 text-xs font-semibold text-white">
                Cinematic Dialogue
              </div>
            )}
          </div>
        </div>

        {/* Animation Sub-Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
          <button
            onClick={() => setAnimationTab('entrance')}
            className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              animationTab === 'entrance'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUp className="w-3 h-3" />
            <span>Entrance ({entranceOptions.length})</span>
          </button>
          <button
            onClick={() => setAnimationTab('exit')}
            className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              animationTab === 'exit'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownToLine className="w-3 h-3" />
            <span>Exit ({exitOptions.length})</span>
          </button>
          <button
            onClick={() => setAnimationTab('combos')}
            className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              animationTab === 'combos'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wand2 className="w-3 h-3" />
            <span>Combos</span>
          </button>
        </div>

        {/* 1. Entrance Animation Selector List */}
        {animationTab === 'entrance' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-56 overflow-y-auto pr-0.5">
            {entranceOptions.map((opt) => {
              const isSelected = currentEntrance === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    onUpdateSettings({ captionEntranceAnim: opt.id });
                    handleReplayAnimation();
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/30 text-white shadow-md'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isSelected ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                    {opt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="text-xs font-bold text-slate-200 truncate">{opt.label}</div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-1">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 2. Exit Animation Selector List */}
        {animationTab === 'exit' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-56 overflow-y-auto pr-0.5">
            {exitOptions.map((opt) => {
              const isSelected = currentExit === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    onUpdateSettings({ captionExitAnim: opt.id });
                    handleReplayAnimation();
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-400 ring-1 ring-cyan-400/30 text-white shadow-md'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
                    {opt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="text-xs font-bold text-slate-200 truncate">{opt.label}</div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-1">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 3. Viral 1-Click Combos */}
        {animationTab === 'combos' && (
          <div className="space-y-1.5 pt-1 max-h-56 overflow-y-auto pr-0.5">
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
                  className={`w-full p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isComboActive
                      ? 'bg-gradient-to-r from-amber-500/20 to-cyan-500/20 border-amber-500 text-white ring-1 ring-amber-500/30'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">{combo.name}</span>
                      <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30">
                        {combo.badge}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">{combo.desc}</div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-mono text-slate-300">
                      {combo.entrance} + {combo.exit}
                    </div>
                    {isComboActive && (
                      <span className="text-[9px] font-bold text-amber-400">Active</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Preset Selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-2">
          Caption Visual Preset
        </label>
        <div className="grid grid-cols-1 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onUpdateSettings({ captionPreset: preset.id })}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                settings.captionPreset === preset.id
                  ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/20 text-slate-100'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-slate-200">{preset.label}</div>
                <div className="text-[11px] text-slate-400">{preset.desc}</div>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-black/60 text-amber-400 border border-slate-700">
                {preset.sample}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Word Highlight Color */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-2">
          Highlight Accent Color
        </label>
        <div className="flex items-center gap-2">
          {colorSwatches.map((swatch) => (
            <button
              key={swatch.hex}
              onClick={() => onUpdateSettings({ captionColor: swatch.hex })}
              className={`w-8 h-8 rounded-xl transition-all cursor-pointer flex items-center justify-center border ${
                settings.captionColor === swatch.hex
                  ? 'scale-110 border-white shadow-md'
                  : 'border-slate-700 hover:scale-105'
              }`}
              style={{ backgroundColor: swatch.hex }}
              title={swatch.name}
            >
              {settings.captionColor === swatch.hex && (
                <Check className={`w-4 h-4 ${swatch.hex === '#FFFFFF' ? 'text-black' : 'text-slate-950 font-black'}`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Position & Size */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Vertical Position
          </label>
          <select
            value={settings.captionPosition}
            onChange={(e) =>
              onUpdateSettings({
                captionPosition: e.target.value as 'top' | 'middle' | 'lower_third' | 'bottom',
              })
            }
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="top">Top (25%)</option>
            <option value="middle">Center (50%)</option>
            <option value="lower_third">Lower Third (72%) - Best</option>
            <option value="bottom">Bottom (84%)</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
            <span>Font Size</span>
            <span className="font-mono text-amber-400">{settings.captionFontSize}px</span>
          </div>
          <input
            type="range"
            min={24}
            max={52}
            value={settings.captionFontSize}
            onChange={(e) => onUpdateSettings({ captionFontSize: Number(e.target.value) })}
            className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer mt-2"
          />
        </div>
      </div>

      {/* Top Hook Banner Sticker */}
      <div className="pt-3 border-t border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Top Hook Banner Sticker</span>
          </label>
          <input
            type="checkbox"
            checked={settings.showHookBanner}
            onChange={(e) => onUpdateSettings({ showHookBanner: e.target.checked })}
            className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
          />
        </div>

        {settings.showHookBanner && (
          <div className="space-y-2">
            <input
              type="text"
              value={settings.hookBannerText || activeClip.hook}
              onChange={(e) => onUpdateSettings({ hookBannerText: e.target.value })}
              placeholder="Enter viral 3-second hook text..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />

            <button
              onClick={handleGenerateHooks}
              disabled={isGeneratingHooks}
              className="w-full py-1.5 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingHooks ? 'animate-spin' : ''}`} />
              <span>{isGeneratingHooks ? 'Generating viral hooks...' : 'AI Generate 5 Alternative Hooks'}</span>
            </button>

            {showHookSuggestions && suggestedHooks.length > 0 && (
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Click to Apply Hook:
                </div>
                {suggestedHooks.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => onUpdateSettings({ hookBannerText: `${h.emoji} ${h.text}` })}
                    className="w-full text-left p-1.5 rounded-lg hover:bg-slate-800 text-[11px] text-slate-300 hover:text-amber-300 transition-colors flex items-start gap-1.5"
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
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-200">
          Bottom Progress Bar Line
        </label>
        <div className="flex items-center gap-2">
          {settings.showProgressBar && (
            <div className="flex items-center gap-1">
              {['#EF4444', '#F59E0B', '#FFFFFF', '#06B6D4'].map((col) => (
                <button
                  key={col}
                  onClick={() => onUpdateSettings({ progressBarColor: col })}
                  className={`w-4 h-4 rounded-full border ${
                    settings.progressBarColor === col ? 'border-white scale-125' : 'border-slate-700'
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
            className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

