import React, { useState } from 'react';
import { Type, Sparkles, Palette, AlignVerticalJustifyCenter, Flame, Check, SlidersHorizontal, Lightbulb } from 'lucide-react';
import { CaptionPreset, ExportSettings, ClipHighlight } from '../types';

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
          <h3 className="text-sm font-bold text-slate-100">Automated Captions & Style</h3>
        </div>
        <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
          TikTok Optimized
        </span>
      </div>

      {/* Preset Selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-2">
          Caption Animation Preset
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
