export type ClipCategory = 'funny' | 'highlight' | 'educational' | 'debate' | 'all';

export type CaptionPreset =
  | 'opus_box'       // OpusClip signature dark green/vibrant active word highlight box
  | 'opus_classic'   // OpusClip crisp white bold text with #22C55E green active word pop
  | 'hormozi'        // Bold yellow/white uppercase, heavy black outline, bouncing active word
  | 'tiktok_neon'    // Clean modern font with cyan/lime glowing capsule
  | 'beast_flame'    // Orange/red fiery pop with intense emphasis
  | 'karaoke_fill'   // Word filling with accent color as spoken
  | 'minimal_cinema'; // Crisp film subtitle with frosted dark pill

export type CaptionHighlightStyle =
  | 'active_box'     // Colored rounded pill behind currently spoken word
  | 'text_color'     // Pop scale + color fill on currently spoken word
  | 'underline_glow' // Illuminated accent bar beneath active word
  | 'dual_tone'      // Progressive word-by-word spoken fill
  | 'none';          // Uniform styling without active word highlight

export type CaptionTextCase = 'uppercase' | 'titlecase' | 'original';

export type CaptionFontFamily = 'Montserrat' | 'Plus Jakarta Sans' | 'Rubik Mono One';

export type FramingMode =
  | 'smart_crop'    // 9:16 crop focused on speaker with pan control
  | 'split_screen'  // Main video on top, satisfying video/gameplay bottom
  | 'blur_fit'      // 16:9 in center with blurred video fill
  | 'clean_box';    // Centered with dark cinematic borders

export interface WordToken {
  w: string;
  start: number; // relative to clip start
  end: number;
}

export interface CaptionChunk {
  start: number; // relative to clip start
  end: number;
  text: string;
  emphasisWord?: string;
  words?: WordToken[];
}

export interface ClipHighlight {
  id: string;
  title: string;
  hook: string;
  reason: string;
  category: 'funny' | 'highlight' | 'educational' | 'debate';
  startTime: number; // seconds in source video
  endTime: number;   // seconds in source video
  viralityScore: number; // 0-100
  hookScore?: number;
  flowScore?: number;
  emotionScore?: number;
  framingSuggestion?: FramingMode;
  emojis: string[];
  hashtags: string[];
  recommendedMusicTempo?: string;
  captions: CaptionChunk[];
  panX?: number;
  visualContext?: string;
  clipVideoUrl?: string; // Direct path to pre-clipped 9:16 vertical MP4
  downloadUrl?: string;
}

export interface VideoSource {
  id: string;
  title: string;
  creator: string;
  channelName: string;
  duration: number; // in seconds
  thumbnail: string;
  videoUrl: string;
  playableSourceUrl?: string; // Server-hosted playable MP4/WebM path (for uploads, samples, cached URLs)
  sourceType: 'youtube' | 'upload' | 'sample' | 'url';
  youtubeUrl?: string;
  youtubeVideoId?: string;
  youtubeDownloadBlocked?: boolean;
  description: string;
  transcript: string;
  visualSummary?: string;
  aiSummary?: string;
  highlights: ClipHighlight[];
}

export interface ClipGenerationOptions {
  videoSource: VideoSource;
  focusCategory: string;
  targetLength: string;
  customPrompt?: string;
  clipCount?: number;
  minDurationSec?: number;
  maxDurationSec?: number;
  appendExisting?: boolean;
}

export type CaptionEntranceAnimation =
  | 'pop'         // Energetic spring pop with scale overshoot
  | 'slide_up'    // Smooth upward slide with motion flare
  | 'slide_down'  // Punchy drop from above
  | 'fade'        // Cinematic smooth opacity fade
  | 'bounce'      // Playful double-bounce impact
  | 'zoom_in'     // Deep punch zoom from 0.4 to 1.0
  | 'glow_burst'; // Neon flare and flash into place

export type CaptionExitAnimation =
  | 'fade'        // Clean fade out
  | 'slide_down'  // Smooth drop off screen
  | 'slide_up'    // Float up and disappear
  | 'shrink'      // Scale down to zero
  | 'pop_out'     // Snappy outward blast
  | 'none';       // Instant cut

export type VideoFilterPreset =
  | 'none'
  | 'grayscale'
  | 'sepia'
  | 'high_contrast'
  | 'vivid'
  | 'noir'
  | 'warm'
  | 'cool'
  | 'vintage';

export interface ExportSettings {
  resolution: '1080p' | '720p';
  framerate: 30 | 60;
  framingMode: FramingMode;
  captionPreset: CaptionPreset;
  captionHighlightStyle?: CaptionHighlightStyle;
  captionColor: string;
  captionBaseColor?: string;
  captionFontFamily?: CaptionFontFamily;
  captionTextCase?: CaptionTextCase;
  captionOutlineWidth?: number;
  captionWordsPerLine?: 'single_line' | 'multi_line';
  captionDropShadow?: boolean;
  captionPosition: 'top' | 'middle' | 'lower_third' | 'bottom';
  captionFontSize: number;
  captionEntranceAnim?: CaptionEntranceAnimation;
  captionExitAnim?: CaptionExitAnimation;
  showHookBanner: boolean;
  hookBannerText: string;
  showProgressBar: boolean;
  progressBarColor: string;
  panX: number; // -100 to 100 for framing speaker
  splitBottomType?: 'minecraft' | 'subway' | 'satisfying' | 'gameplay';
  videoFilter?: VideoFilterPreset;
  filterBrightness?: number;
  filterContrast?: number;
  filterSaturate?: number;
}
