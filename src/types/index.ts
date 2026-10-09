export type ClipCategory = 'funny' | 'highlight' | 'educational' | 'debate' | 'all';

export type CaptionPreset = 
  | 'hormozi'       // Bold yellow/white uppercase, black outline, bouncing active word
  | 'tiktok_neon'   // Clean modern font with cyan/lime glowing capsule
  | 'beast_flame'   // Orange/red fiery pop with intense emphasis
  | 'karaoke_fill'  // Word filling with gradient as spoken
  | 'minimal_cinema'; // Crisp film subtitle with frosted dark pill

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
  emojis: string[];
  hashtags: string[];
  recommendedMusicTempo?: string;
  captions: CaptionChunk[];
}

export interface VideoSource {
  id: string;
  title: string;
  creator: string;
  channelName: string;
  duration: number; // in seconds
  thumbnail: string;
  videoUrl: string;
  sourceType: 'youtube' | 'upload' | 'sample';
  youtubeUrl?: string;
  description: string;
  transcript: string;
  highlights: ClipHighlight[];
}

export interface ExportSettings {
  resolution: '1080p' | '720p';
  framerate: 30 | 60;
  framingMode: FramingMode;
  captionPreset: CaptionPreset;
  captionColor: string;
  captionPosition: 'top' | 'middle' | 'lower_third' | 'bottom';
  captionFontSize: number;
  showHookBanner: boolean;
  hookBannerText: string;
  showProgressBar: boolean;
  progressBarColor: string;
  panX: number; // -100 to 100 for framing speaker
  splitBottomType?: 'minecraft' | 'subway' | 'satisfying' | 'gameplay';
}
