import { ClipHighlight, ExportSettings, SocialAccount, VideoSource } from '../types';
import { downloadBlob, generateSrtFile } from './exportVideo';
import { parseJsonResponse } from './safeFetchJson';

export type ExportPlatform = 'shorts' | 'tiktok';

export interface PlatformPresetConfig {
  id: ExportPlatform;
  label: string;
  shortLabel: string;
  tag: string;
  shortcut: string;
  recommendedResolution: '1080p' | '720p';
  recommendedFramerate: 30 | 60;
  filePrefix: string;
  uploadUrl: string;
  uploadCta: string;
  defaultTags: string[];
}

export const PLATFORM_PRESETS: Record<ExportPlatform, PlatformPresetConfig> = {
  shorts: {
    id: 'shorts',
    label: 'YouTube Shorts',
    shortLabel: 'Shorts',
    tag: '9:16 · 1080p 60fps',
    shortcut: 'Shift+Y',
    recommendedResolution: '1080p',
    recommendedFramerate: 60,
    filePrefix: 'youtube_shorts',
    uploadUrl: 'https://studio.youtube.com',
    uploadCta: 'Open YouTube Studio',
    defaultTags: ['#shorts', '#youtubeshorts', '#viral'],
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    shortLabel: 'TikTok',
    tag: '9:16 · 1080p 30fps',
    shortcut: 'Shift+T',
    recommendedResolution: '1080p',
    recommendedFramerate: 30,
    filePrefix: 'tiktok',
    uploadUrl: 'https://www.tiktok.com/tiktokstudio/upload',
    uploadCta: 'Open TikTok Studio',
    defaultTags: ['#fyp', '#tiktok', '#viral'],
  },
};

export function buildPlatformFilename(
  clip: ClipHighlight,
  platform: ExportPlatform,
  ext = 'mp4'
): string {
  const preset = PLATFORM_PRESETS[platform];
  const cleanTitle =
    clip.title
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()
      .slice(0, 32) || 'clip';
  return `clipforge_${preset.filePrefix}_${cleanTitle}.${ext}`;
}

export function buildPlatformSocialCopy(
  clip: ClipHighlight,
  platform: ExportPlatform,
  account?: Pick<SocialAccount, 'handle' | 'notes'> | null
): string {
  const preset = PLATFORM_PRESETS[platform];
  const existing = Array.isArray(clip.hashtags) ? clip.hashtags : [];
  const merged = Array.from(
    new Set(
      [...existing, ...preset.defaultTags].map((t) =>
        t.startsWith('#') ? t.trim() : `#${t.trim()}`
      )
    )
  ).slice(0, 8);

  const accountCta = account?.notes?.trim() ? `\n\n${account.notes.trim()}` : '';

  if (platform === 'shorts') {
    const cleanTitle = clip.title.slice(0, 85);
    return `${cleanTitle} #shorts\n\n"${clip.hook}"${accountCta}\n\n${merged.join(' ')}`;
  }

  return `${clip.title}\n\n"${clip.hook}"${accountCta}\n\n${merged.join(' ')}`;
}

export async function copyPlatformCaptionSilently(
  clip: ClipHighlight,
  platform: ExportPlatform,
  account?: Pick<SocialAccount, 'handle' | 'notes'> | null
): Promise<boolean> {
  try {
    const text = buildPlatformSocialCopy(clip, platform, account);
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function renderServerClipForPlatform(options: {
  clip: ClipHighlight;
  videoSource: VideoSource;
  settings: ExportSettings;
  platform: ExportPlatform;
  resolution?: '1080p' | '720p';
  burnCaptions?: boolean;
  account?: Pick<SocialAccount, 'handle' | 'notes'> | null;
  autoApplyAiFraming?: boolean;
}): Promise<{
  downloadUrl: string;
  filename: string;
  blob: Blob;
  captionCopied: boolean;
}> {
  const {
    clip,
    videoSource,
    settings,
    platform,
    resolution = PLATFORM_PRESETS[platform].recommendedResolution,
    burnCaptions = true,
    account,
    autoApplyAiFraming = true,
  } = options;

  const clipDur = Math.max(3, Math.round(clip.endTime - clip.startTime));
  const response = await fetch('/api/clip-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoUrl: videoSource.videoUrl,
      playableSourceUrl: videoSource.playableSourceUrl,
      youtubeUrl: videoSource.youtubeUrl,
      startTime: clip.startTime,
      duration: clipDur,
      resolution,
      framingMode: autoApplyAiFraming
        ? clip.framingSuggestion || settings.framingMode || 'smart_crop'
        : settings.framingMode || 'smart_crop',
      panX: autoApplyAiFraming && typeof clip.panX === 'number' ? clip.panX : settings.panX,
      title: clip.title,
      clipId: `${clip.id}_${platform}`,
      burnCaptions,
      captions: clip.captions,
      captionColor: settings.captionColor,
      captionBaseColor: settings.captionBaseColor,
      captionPosition: settings.captionPosition,
      captionFontSize: settings.captionFontSize,
      captionFontFamily: settings.captionFontFamily,
      captionTextCase: settings.captionTextCase,
      captionOutlineWidth: settings.captionOutlineWidth,
      captionDropShadow: settings.captionDropShadow,
    }),
  });

  const data = await parseJsonResponse(response, 'Export failed');
  if (!response.ok || !data.downloadUrl) {
    throw new Error(data.error || `Export failed (${response.status})`);
  }

  const fileRes = await fetch(data.downloadUrl);
  if (!fileRes.ok) {
    throw new Error('Could not download rendered MP4 clip.');
  }
  const blob = await fileRes.blob();
  const filename = buildPlatformFilename(clip, platform, 'mp4');
  downloadBlob(blob, filename);

  const captionCopied = await copyPlatformCaptionSilently(clip, platform, account);

  return {
    downloadUrl: data.downloadUrl,
    filename,
    blob,
    captionCopied,
  };
}

export async function exportSrtShortcutForPlatform(
  clip: ClipHighlight,
  platform: ExportPlatform,
  account?: Pick<SocialAccount, 'handle' | 'notes'> | null
): Promise<{ filename: string; captionCopied: boolean }> {
  const srtContent = generateSrtFile(clip.captions);
  const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
  const filename = buildPlatformFilename(clip, platform, 'srt');
  downloadBlob(blob, filename);
  const captionCopied = await copyPlatformCaptionSilently(clip, platform, account);
  return { filename, captionCopied };
}

export function canNativeShareFiles(blob?: Blob | null, filename = 'clip.mp4'): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    return false;
  }
  try {
    const sampleFile = new File(
      [blob || new Blob([''], { type: 'video/mp4' })],
      filename,
      { type: blob?.type || 'video/mp4' }
    );
    return navigator.canShare({ files: [sampleFile] });
  } catch {
    return false;
  }
}

export async function shareClipNatively(
  blob: Blob,
  filename: string,
  clip: ClipHighlight,
  platform: ExportPlatform,
  account?: Pick<SocialAccount, 'handle' | 'notes'> | null
): Promise<boolean> {
  if (!canNativeShareFiles(blob, filename)) return false;
  try {
    const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
    await navigator.share({
      title: clip.title,
      text: buildPlatformSocialCopy(clip, platform, account),
      files: [file],
    });
    return true;
  } catch {
    return false;
  }
}
