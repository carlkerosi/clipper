import { ExportSettings, VideoFilterPreset } from '../types';

export interface VideoFilterDefinition {
  id: VideoFilterPreset;
  label: string;
  desc: string;
  css: string;
}

export const VIDEO_FILTER_PRESETS: VideoFilterDefinition[] = [
  {
    id: 'none',
    label: 'Original',
    desc: 'Natural ungraded color',
    css: '',
  },
  {
    id: 'grayscale',
    label: 'Grayscale',
    desc: 'Clean monochrome B&W',
    css: 'grayscale(100%)',
  },
  {
    id: 'sepia',
    label: 'Sepia',
    desc: 'Warm retro film tone',
    css: 'sepia(85%)',
  },
  {
    id: 'high_contrast',
    label: 'High Contrast',
    desc: 'Punchy blacks & crisp highlights',
    css: 'contrast(145%) saturate(110%)',
  },
  {
    id: 'vivid',
    label: 'Vivid Pop',
    desc: 'Boosted TikTok color punch',
    css: 'saturate(155%) contrast(112%) brightness(104%)',
  },
  {
    id: 'noir',
    label: 'Film Noir',
    desc: 'Moody high-contrast B&W',
    css: 'grayscale(100%) contrast(155%) brightness(92%)',
  },
  {
    id: 'warm',
    label: 'Warm Sunset',
    desc: 'Golden hour warmth',
    css: 'sepia(28%) saturate(130%) brightness(104%)',
  },
  {
    id: 'cool',
    label: 'Cool Teal',
    desc: 'Crisp studio blue tint',
    css: 'hue-rotate(16deg) saturate(115%) contrast(108%)',
  },
  {
    id: 'vintage',
    label: 'Vintage 90s',
    desc: 'Faded analog camcorder look',
    css: 'sepia(45%) contrast(115%) brightness(95%) saturate(85%)',
  },
];

export function getCssFilterString(settings: Pick<ExportSettings, 'videoFilter' | 'filterBrightness' | 'filterContrast' | 'filterSaturate'>): string {
  const parts: string[] = [];

  const preset = VIDEO_FILTER_PRESETS.find((p) => p.id === (settings.videoFilter || 'none'));
  if (preset?.css) {
    parts.push(preset.css);
  }

  const brightness = settings.filterBrightness ?? 100;
  const contrast = settings.filterContrast ?? 100;
  const saturate = settings.filterSaturate ?? 100;

  if (brightness !== 100) {
    parts.push(`brightness(${brightness}%)`);
  }
  if (contrast !== 100) {
    parts.push(`contrast(${contrast}%)`);
  }
  if (saturate !== 100) {
    parts.push(`saturate(${saturate}%)`);
  }

  return parts.length > 0 ? parts.join(' ') : 'none';
}
