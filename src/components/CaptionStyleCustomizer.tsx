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
  Highlighter,
  SlidersHorizontal,
} from 'lucide-react';
import {
  CaptionPreset,
  CaptionHighlightStyle,
  CaptionFontFamily,
  CaptionTextCase,
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
  const [hookError, setHookError] = useState<string | null>(null);

  // Motion & highlight preview state
  const [animationTab, setAnimationTab] = useState<'entrance' | 'exit' | 'combos'>('entrance');
  const [previewKey, setPreviewKey] = useState(0);
  const [previewPhase, setPreviewPhase] = useState<'entrance' | 'sustain' | 'exit'>('entrance');
  const [activePreviewWordIdx, setActivePreviewWordIdx] = useState(1);

  const currentEntrance = settings.captionEntranceAnim || 'pop';
  const currentExit = settings.captionExitAnim || 'fade';
  const highlightStyle: CaptionHighlightStyle = settings.captionHighlightStyle || 'active_box';
  const baseColor = settings.captionBaseColor || '#FFFFFF';
  const accentColor = settings.captionColor || '#22C55E';
  const fontFamily: CaptionFontFamily = settings.captionFontFamily || 'Montserrat';
  const textCase: CaptionTextCase = settings.captionTextCase || 'uppercase';
  const outlineWidth = settings.captionOutlineWidth ?? 6;
  const wordsPerLine = settings.captionWordsPerLine || 'multi_line';
  const dropShadow = settings.captionDropShadow !== false;

  useEffect(() => {
    setPreviewPhase('entrance');
    const timer1 = setTimeout(() => setPreviewPhase('sustain'), 600);
    const timer2 = setTimeout(() => setPreviewPhase('exit'), 1900);
    const timer3 = setTimeout(() => setPreviewPhase('entrance'), 2500);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [currentEntrance, currentExit, previewKey]);

  useEffect(() => {
    const wordCycle = setInterval(() => {
      setActivePreviewWordIdx((i) => (i + 1) % 3);
    }, 550);
    return () => clearInterval(wordCycle);
  }, []);

  const handleReplayAnimation = () => {
    setPreviewKey((k) => k + 1);
  };

  const presets: Array<{
    id: CaptionPreset;
    label: string;
    desc: string;
    sample: string;
    highlight: CaptionHighlightStyle;
    accent: string;
    base: string;
    font: CaptionFontFamily;
    textCase: CaptionTextCase;
  }> = [
    {
      id: 'opus_box',
      label: 'Opus Active Box',
      desc: 'Vibrant green box tracking each spoken word',
      sample: 'VIRAL',
      highlight: 'active_box',
      accent: '#22C55E',
      base: '#FFFFFF',
      font: 'Montserrat',
      textCase: 'uppercase',
    },
    {
      id: 'opus_classic',
      label: 'Opus Classic Pop',
      desc: 'Crisp bold outline with vivid accent word scale',
      sample: 'CLASSIC',
      highlight: 'text_color',
      accent: '#22C55E',
      base: '#FFFFFF',
      font: 'Montserrat',
      textCase: 'uppercase',
    },
    {
      id: 'hormozi',
      label: 'Hormozi / Beast',
      desc: 'Punchy yellow emphasis & thick black stroke',
      sample: 'WAIT FOR',
      highlight: 'text_color',
      accent: '#FACC15',
      base: '#FFFFFF',
      font: 'Montserrat',
      textCase: 'uppercase',
    },
    {
      id: 'tiktok_neon',
      label: 'TikTok Neon Frame',
      desc: 'Translucent matte pill with glowing cyan underline',
      sample: 'NEON',
      highlight: 'underline_glow',
      accent: '#06B6D4',
      base: '#FFFFFF',
      font: 'Plus Jakarta Sans',
      textCase: 'uppercase',
    },
    {
      id: 'karaoke_fill',
      label: 'Karaoke Dual Tone',
      desc: 'Progressive word-by-word spoken color fill',
      sample: 'FLOW',
      highlight: 'dual_tone',
      accent: '#F59E0B',
      base: '#E4E4E7',
      font: 'Plus Jakarta Sans',
      textCase: 'titlecase',
    },
    {
      id: 'minimal_cinema',
      label: 'Minimal Cinema',
      desc: 'Clean documentary dialogue subtitle strip',
      sample: 'Cinema',
      highlight: 'none',
      accent: '#22C55E',
      base: '#FFFFFF',
      font: 'Plus Jakarta Sans',
      textCase: 'original',
    },
  ];

  const handleSelectPreset = (p: typeof presets[number]) => {
    onUpdateSettings({
      captionPreset: p.id,
      captionHighlightStyle: p.highlight,
      captionColor: p.accent,
      captionBaseColor: p.base,
      captionFontFamily: p.font,
      captionTextCase: p.textCase,
    });
    handleReplayAnimation();
  };

  const highlightStyles: Array<{ id: CaptionHighlightStyle; label: string; desc: string }> = [
    { id: 'active_box', label: 'Active Box', desc: 'Solid pill behind spoken word' },
    { id: 'text_color', label: 'Color Pop', desc: 'Scale & accent color highlight' },
    { id: 'underline_glow', label: 'Underline', desc: 'Glowing accent bar beneath word' },
    { id: 'dual_tone', label: 'Dual Tone', desc: 'Progressive karaoke fill' },
    { id: 'none', label: 'Clean Off', desc: 'Uniform subtitle text' },
  ];

  const entranceOptions: Array<{
    id: CaptionEntranceAnimation;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    { id: 'pop', label: 'Pop Spring', desc: 'Snappy scale overshoot', icon: <Zap className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'slide_up', label: 'Slide Up', desc: 'Smooth upward ascent', icon: <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'slide_down', label: 'Slide Down', desc: 'Punchy drop into frame', icon: <ArrowDown className="w-3.5 h-3.5 text-cyan-400" /> },
    { id: 'fade', label: 'Clean Fade', desc: 'Smooth opacity dissolve', icon: <Eye className="w-3.5 h-3.5 text-blue-400" /> },
    { id: 'bounce', label: 'Bounce', desc: 'Elastic double-rebound', icon: <Activity className="w-3.5 h-3.5 text-rose-400" /> },
    { id: 'zoom_in', label: 'Punch Zoom', desc: 'Scale blast into frame', icon: <Maximize2 className="w-3.5 h-3.5 text-violet-400" /> },
    { id: 'glow_burst', label: 'Glow Burst', desc: 'Radiant highlight flash', icon: <Sparkles className="w-3.5 h-3.5 text-amber-300" /> },
  ];

  const exitOptions: Array<{
    id: CaptionExitAnimation;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    { id: 'fade', label: 'Smooth Fade', desc: 'Clean dissolve out', icon: <EyeOff className="w-3.5 h-3.5 text-zinc-400" /> },
    { id: 'slide_down', label: 'Slide Down', desc: 'Drop out smoothly', icon: <ArrowDownToLine className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'slide_up', label: 'Slide Up', desc: 'Ascend out of view', icon: <ArrowUpToLine className="w-3.5 h-3.5 text-cyan-400" /> },
    { id: 'shrink', label: 'Shrink', desc: 'Collapse inward cleanly', icon: <Minimize2 className="w-3.5 h-3.5 text-violet-400" /> },
    { id: 'pop_out', label: 'Pop Out', desc: 'Snappy outward cut', icon: <Zap className="w-3.5 h-3.5 text-rose-400" /> },
    { id: 'none', label: 'Instant Cut', desc: 'Zero exit transition', icon: <Scissors className="w-3.5 h-3.5 text-zinc-500" /> },
  ];

  const viralCombos: Array<{
    name: string;
    entrance: CaptionEntranceAnimation;
    exit: CaptionExitAnimation;
    desc: string;
  }> = [
    { name: 'Opus Viral Punch', entrance: 'pop', exit: 'none', desc: 'Crisp word-lock cadence used by top podcasters' },
    { name: 'MrBeast Energy', entrance: 'pop', exit: 'pop_out', desc: 'Snappy pop-in with explosive vanish' },
    { name: 'TikTok Flow', entrance: 'slide_up', exit: 'slide_down', desc: 'Kinetic upward rise with smooth drop' },
    { name: 'Documentary Cinema', entrance: 'fade', exit: 'fade', desc: 'Subtle dissolves that keep focus on story' },
  ];

  const baseColorSwatches = [
    { name: 'Pure White', hex: '#FFFFFF' },
    { name: 'Warm Cream', hex: '#FEF9C3' },
    { name: 'Cool Silver', hex: '#E4E4E7' },
    { name: 'Ice Cyan', hex: '#E0F2FE' },
  ];

  const highlightSwatches = [
    { name: 'Opus Green', hex: '#22C55E' },
    { name: 'Hormozi Yellow', hex: '#FACC15' },
    { name: 'Violet Pop', hex: '#8B5CF6' },
    { name: 'Cyan Neon', hex: '#06B6D4' },
    { name: 'Amber Gold', hex: '#F97316' },
    { name: 'Crimson Rose', hex: '#F43F5E' },
  ];

  const formatSandboxWord = (w: string) => {
    if (textCase === 'uppercase') return w.toUpperCase();
    if (textCase === 'titlecase') return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    return w;
  };

  const sandboxWords = ['Wait', 'For', 'It!'];

  const handleGenerateHooks = async () => {
    setIsGeneratingHooks(true);
    setShowHookSuggestions(true);
    setHookError(null);
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate alternative hooks.');
      }
      if (data.hooks && data.hooks.length > 0) {
        setSuggestedHooks(data.hooks);
      }
    } catch (err: any) {
      setHookError(err.message || 'Could not generate alternative hooks.');
    } finally {
      setIsGeneratingHooks(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/80 rounded-2xl border border-zinc-800 p-4 shadow-xl overflow-y-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-emerald-400" />
          <div>
            <h3 className="text-xs font-semibold text-zinc-100">Custom Subtitle & Highlight Form</h3>
            <div className="text-[11px] text-zinc-500">Opus-style word highlights & caption builder</div>
          </div>
        </div>
        <button
          onClick={handleReplayAnimation}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium border border-zinc-700 transition-colors cursor-pointer"
          title="Replay animation & highlight preview"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Replay</span>
        </button>
      </div>

      {/* Live Interactive Sandbox reflecting exact custom form values */}
      <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <span>LIVE SUBTITLE SANDBOX · {highlightStyle.replace('_', ' ').toUpperCase()}</span>
          <span className="tabular-nums">{fontFamily}</span>
        </div>

        <div className="relative h-20 rounded-lg bg-black/80 border border-zinc-800/80 flex items-center justify-center overflow-hidden px-3 select-none">
          <div
            key={`${previewKey}-${currentEntrance}-${currentExit}-${previewPhase}`}
            className={`flex flex-wrap items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg ${
              settings.captionPreset === 'tiktok_neon'
                ? 'bg-zinc-950/90 border border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : settings.captionPreset === 'minimal_cinema'
                ? 'bg-black/75'
                : ''
            } ${
              previewPhase === 'entrance'
                ? `anim-entrance-${currentEntrance}`
                : previewPhase === 'exit'
                ? `anim-exit-${currentExit}`
                : ''
            }`}
            style={{ fontFamily: `"${fontFamily}", sans-serif` }}
          >
            {sandboxWords.map((word, idx) => {
              const isActive = idx === activePreviewWordIdx;
              const isSpoken = idx <= activePreviewWordIdx;
              const label = formatSandboxWord(word);

              const boxContrast =
                accentColor.toUpperCase() === '#FACC15' || accentColor.toUpperCase() === '#FFFFFF'
                  ? '#09090B'
                  : '#FFFFFF';

              return (
                <span
                  key={idx}
                  className="font-black text-base tracking-wide transition-all duration-150 inline-block"
                  style={{
                    color:
                      highlightStyle === 'active_box' && isActive
                        ? boxContrast
                        : highlightStyle === 'dual_tone'
                        ? isSpoken
                          ? accentColor
                          : baseColor
                        : isActive && highlightStyle !== 'none'
                        ? accentColor
                        : baseColor,
                    backgroundColor:
                      highlightStyle === 'active_box' && isActive ? accentColor : 'transparent',
                    padding: highlightStyle === 'active_box' && isActive ? '2px 8px' : '2px 2px',
                    borderRadius: highlightStyle === 'active_box' && isActive ? '6px' : undefined,
                    transform:
                      (highlightStyle === 'text_color' || highlightStyle === 'active_box') && isActive
                        ? 'scale(1.08)'
                        : 'scale(1)',
                    borderBottom:
                      highlightStyle === 'underline_glow' && isActive
                        ? `3px solid ${accentColor}`
                        : '3px solid transparent',
                    textShadow:
                      outlineWidth > 0 && !(highlightStyle === 'active_box' && isActive)
                        ? `0 2px ${Math.max(2, outlineWidth)}px rgba(0,0,0,0.95)`
                        : dropShadow
                        ? '0 2px 4px rgba(0,0,0,0.85)'
                        : 'none',
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* 1. Style Presets */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Style Templates</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {presets.map((preset) => {
            const isSelected = settings.captionPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-800 border-emerald-500/80 text-white'
                    : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold text-zinc-200 truncate">{preset.label}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                    style={{ backgroundColor: preset.accent }}
                  />
                </div>
                <div className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{preset.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Highlight Word Style (Opus-style form controls) */}
      <div className="space-y-2 pt-2 border-t border-zinc-800/80">
        <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
          <Highlighter className="w-3.5 h-3.5 text-emerald-400" />
          <span>Active Word Highlight Style</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {highlightStyles.map((hs) => {
            const active = highlightStyle === hs.id;
            return (
              <button
                key={hs.id}
                onClick={() => onUpdateSettings({ captionHighlightStyle: hs.id })}
                className={`px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-500/10 border-emerald-500/70 text-emerald-200'
                    : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="text-[11px] font-semibold">{hs.label}</div>
                <div className="text-[10px] text-zinc-500 line-clamp-1">{hs.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Custom Form: Font, Casing, Line Mode */}
      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-zinc-800/80">
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">Font Family</label>
          <select
            value={fontFamily}
            onChange={(e) => onUpdateSettings({ captionFontFamily: e.target.value as CaptionFontFamily })}
            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="Montserrat">Montserrat ExtraBold</option>
            <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
            <option value="Rubik Mono One">Rubik Mono Impact</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">Text Case</label>
          <select
            value={textCase}
            onChange={(e) => onUpdateSettings({ captionTextCase: e.target.value as CaptionTextCase })}
            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="uppercase">ALL CAPS</option>
            <option value="titlecase">Title Case</option>
            <option value="original">As Spoken</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">Lines Layout</label>
          <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => onUpdateSettings({ captionWordsPerLine: 'multi_line' })}
              className={`py-1 rounded text-[11px] font-medium cursor-pointer ${
                wordsPerLine === 'multi_line' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              2-3 Lines
            </button>
            <button
              onClick={() => onUpdateSettings({ captionWordsPerLine: 'single_line' })}
              className={`py-1 rounded text-[11px] font-medium cursor-pointer ${
                wordsPerLine === 'single_line' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Single
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">Vertical Position</label>
          <select
            value={settings.captionPosition}
            onChange={(e) =>
              onUpdateSettings({
                captionPosition: e.target.value as 'top' | 'middle' | 'lower_third' | 'bottom',
              })
            }
            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="top">Top (24%)</option>
            <option value="middle">Center (50%)</option>
            <option value="lower_third">Lower Third (72%)</option>
            <option value="bottom">Bottom (84%)</option>
          </select>
        </div>
      </div>

      {/* 4. Colors Form: Highlight Color + Base Text Color */}
      <div className="space-y-3 pt-2 border-t border-zinc-800/80">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-zinc-300">Highlight / Active Box Color</label>
            <span className="text-[10px] font-mono text-zinc-500 uppercase">{accentColor}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {highlightSwatches.map((swatch) => (
              <button
                key={swatch.hex}
                onClick={() => onUpdateSettings({ captionColor: swatch.hex })}
                className={`w-6 h-6 rounded-md transition-all cursor-pointer flex items-center justify-center border ${
                  accentColor.toUpperCase() === swatch.hex
                    ? 'scale-110 border-white ring-1 ring-white/40'
                    : 'border-zinc-700 hover:scale-105'
                }`}
                style={{ backgroundColor: swatch.hex }}
                title={swatch.name}
              >
                {accentColor.toUpperCase() === swatch.hex && (
                  <Check className="w-3 h-3 text-zinc-950 stroke-[3]" />
                )}
              </button>
            ))}
            <label
              className="w-6 h-6 rounded-md border border-zinc-700 bg-zinc-950 flex items-center justify-center text-[10px] text-zinc-400 hover:text-white cursor-pointer overflow-hidden"
              title="Custom hex highlight color"
            >
              <input
                type="color"
                value={accentColor}
                onChange={(e) => onUpdateSettings({ captionColor: e.target.value })}
                className="w-8 h-8 opacity-0 absolute cursor-pointer"
              />
              <span>+</span>
            </label>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-zinc-300">Base Text Color</label>
            <span className="text-[10px] font-mono text-zinc-500 uppercase">{baseColor}</span>
          </div>
          <div className="flex items-center gap-2">
            {baseColorSwatches.map((swatch) => (
              <button
                key={swatch.hex}
                onClick={() => onUpdateSettings({ captionBaseColor: swatch.hex })}
                className={`w-6 h-6 rounded-md transition-all cursor-pointer flex items-center justify-center border ${
                  baseColor.toUpperCase() === swatch.hex
                    ? 'scale-110 border-emerald-400 ring-1 ring-emerald-400/40'
                    : 'border-zinc-700 hover:scale-105'
                }`}
                style={{ backgroundColor: swatch.hex }}
                title={swatch.name}
              >
                {baseColor.toUpperCase() === swatch.hex && (
                  <Check className="w-3 h-3 text-zinc-950 stroke-[3]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Size, Outline Stroke & Drop Shadow */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80">
        <div>
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-300 mb-1">
            <span>Font Size</span>
            <span className="font-mono tabular-nums text-zinc-400">{settings.captionFontSize}px</span>
          </div>
          <input
            type="range"
            min={24}
            max={52}
            value={settings.captionFontSize}
            onChange={(e) => onUpdateSettings({ captionFontSize: Number(e.target.value) })}
            className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-300 mb-1">
            <span>Stroke Outline</span>
            <span className="font-mono tabular-nums text-zinc-400">{outlineWidth}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={12}
            value={outlineWidth}
            onChange={(e) => onUpdateSettings({ captionOutlineWidth: Number(e.target.value) })}
            className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      <label className="flex items-center justify-between text-xs text-zinc-300 pt-1 cursor-pointer">
        <span>Drop Shadow Depth</span>
        <input
          type="checkbox"
          checked={dropShadow}
          onChange={(e) => onUpdateSettings({ captionDropShadow: e.target.checked })}
          className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
        />
      </label>

      {/* 6. Kinetic Motion Dynamics */}
      <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
            <SlidersHorizontal className="w-3.5 h-3.5 text-violet-400" />
            <span>Kinetic Transitions</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {currentEntrance} · {currentExit}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 p-0.5 bg-zinc-900 rounded-lg border border-zinc-800">
          {(['entrance', 'exit', 'combos'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setAnimationTab(tab)}
              className={`py-1 px-2 rounded-md text-[11px] font-medium capitalize transition-colors cursor-pointer ${
                animationTab === tab ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {animationTab === 'entrance' && (
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
            {entranceOptions.map((opt) => {
              const isSelected = currentEntrance === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    onUpdateSettings({ captionEntranceAnim: opt.id });
                    handleReplayAnimation();
                  }}
                  className={`p-2 rounded-lg border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-zinc-800 border-violet-500 text-white'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                  }`}
                >
                  <span className="shrink-0">{opt.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-zinc-200 truncate">{opt.label}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {animationTab === 'exit' && (
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
            {exitOptions.map((opt) => {
              const isSelected = currentExit === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    onUpdateSettings({ captionExitAnim: opt.id });
                    handleReplayAnimation();
                  }}
                  className={`p-2 rounded-lg border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-zinc-800 border-violet-500 text-white'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                  }`}
                >
                  <span className="shrink-0">{opt.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-zinc-200 truncate">{opt.label}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {animationTab === 'combos' && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
            {viralCombos.map((combo) => {
              const isComboActive = currentEntrance === combo.entrance && currentExit === combo.exit;
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
                  className={`w-full p-2 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    isComboActive
                      ? 'bg-zinc-800 border-violet-500 text-white'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-zinc-200">{combo.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{combo.desc}</div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                    {combo.entrance}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Hook Banner Sticker */}
      <div className="pt-3 border-t border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-200">Top Hook Banner</label>
          <input
            type="checkbox"
            checked={settings.showHookBanner}
            onChange={(e) => onUpdateSettings({ showHookBanner: e.target.checked })}
            className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
          />
        </div>

        {settings.showHookBanner && (
          <div className="space-y-2">
            <input
              type="text"
              value={settings.hookBannerText || activeClip.hook}
              onChange={(e) => onUpdateSettings({ hookBannerText: e.target.value })}
              placeholder="Enter viral 3-second hook text..."
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
            />

            <button
              onClick={handleGenerateHooks}
              disabled={isGeneratingHooks}
              className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 text-emerald-400 ${isGeneratingHooks ? 'animate-spin' : ''}`} />
              <span>{isGeneratingHooks ? 'Generating hooks...' : 'AI Suggest 5 Hooks'}</span>
            </button>

            {hookError && (
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300">
                {hookError}
              </div>
            )}

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

      {/* Bottom Progress Bar */}
      <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-200">Retention Progress Bar</label>
        <div className="flex items-center gap-2">
          {settings.showProgressBar && (
            <div className="flex items-center gap-1">
              {['#22C55E', '#EF4444', '#FACC15', '#FFFFFF', '#06B6D4'].map((col) => (
                <button
                  key={col}
                  onClick={() => onUpdateSettings({ progressBarColor: col })}
                  className={`w-3.5 h-3.5 rounded-full border cursor-pointer ${
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
            className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
