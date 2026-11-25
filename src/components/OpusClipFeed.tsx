import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Download,
  Sliders,
  Copy,
  Check,
  FileText,
  Sparkles,
  Volume2,
  VolumeX,
  Loader2,
  RefreshCw,
  Share2,
  X,
  Youtube,
  Music2,
  ExternalLink,
  ArrowUpDown,
  Highlighter,
  Hash,
  Zap,
} from 'lucide-react';
import {
  ClipHighlight,
  VideoSource,
  ExportSettings,
  CaptionHighlightStyle,
  CaptionTextCase,
} from '../types';
import { generateSrtFile, downloadBlob } from '../utils/exportVideo';
import { formatCaptionCase } from '../utils/captionRenderer';
import { getCssFilterString } from '../utils/videoFilters';
import {
  ExportPlatform,
  PLATFORM_PRESETS,
  buildPlatformSocialCopy,
  renderServerClipForPlatform,
} from '../utils/platformExport';
import { useFirebase } from '../contexts/FirebaseContext';
import { parseJsonResponse } from '../utils/safeFetchJson';

function extractYoutubeVideoId(url?: string): string {
  if (!url) return '';
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/);
  return match && match[2] && match[2].length === 11 ? match[2] : '';
}

interface OpusClipFeedProps {
  videoSource: VideoSource;
  highlights: ClipHighlight[];
  settings: ExportSettings;
  onUpdateSettings: (newSettings: Partial<ExportSettings>) => void;
  onSelectClipToEdit: (clip: ClipHighlight) => void;
  onOpenExportModal: (clip: ClipHighlight, platform?: ExportPlatform) => void;
  onNewVideo: () => void;
  onOpenDashboard?: () => void;
  onClipUpdated?: (updatedClip: ClipHighlight) => void;
  isAiGenerating?: boolean;
  onGenerateMoreClips?: (customPrompt: string, clipCount: number) => void;
}

interface SocialPack {
  coverText: string;
  pinnedComment: string;
  tiktokCaption: string;
  shortsTitle: string;
}

export const OpusClipFeed: React.FC<OpusClipFeedProps> = ({
  videoSource,
  highlights,
  settings,
  onUpdateSettings,
  onSelectClipToEdit,
  onOpenExportModal,
  onNewVideo,
  onOpenDashboard,
  onClipUpdated,
  isAiGenerating = false,
  onGenerateMoreClips,
}) => {
  const { getDefaultAccountForPlatform, logClipExport, workspacePrefs } = useFirebase();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'timeline'>('score');
  const [morePrompt, setMorePrompt] = useState('');
  const [moreCount, setMoreCount] = useState<number>(3);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedHashtag, setCopiedHashtag] = useState<string | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [playheadMap, setPlayheadMap] = useState<Record<string, number>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [downloadingClipId, setDownloadingClipId] = useState<string | null>(null);
  const [quickExporting, setQuickExporting] = useState<{
    clipId: string;
    platform: ExportPlatform;
  } | null>(null);
  const [quickExportDone, setQuickExportDone] = useState<
    Record<string, { platform: ExportPlatform; filename: string; captionCopied: boolean }>
  >({});
  const [reclippingId, setReclippingId] = useState<string | null>(null);
  const [aiBoostingId, setAiBoostingId] = useState<string | null>(null);
  const [boostNotes, setBoostNotes] = useState<Record<string, string>>({});
  const [videoErrors, setVideoErrors] = useState<Record<string, string>>({});

  // Gemini AI Social Pack modal state
  const [socialModalClip, setSocialModalClip] = useState<ClipHighlight | null>(null);
  const [socialPack, setSocialPack] = useState<SocialPack | null>(null);
  const [isGeneratingSocial, setIsGeneratingSocial] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [copiedSocialField, setCopiedSocialField] = useState<string | null>(null);

  const videoRefMap = useRef<Record<string, HTMLVideoElement | null>>({});

  const filtered = highlights
    .filter((c) => {
      if (selectedCategory === 'all') return true;
      return c.category === selectedCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'score') return b.viralityScore - a.viralityScore;
      return a.startTime - b.startTime;
    });

  const topClip = highlights.reduce(
    (max, c) => (c.viralityScore > (max?.viralityScore || 0) ? c : max),
    highlights[0]
  );

  const ytId =
    videoSource.youtubeVideoId ||
    extractYoutubeVideoId(videoSource.youtubeUrl || videoSource.videoUrl);

  const getClipVideoSource = (clip: ClipHighlight): string => {
    if (clip.clipVideoUrl) return clip.clipVideoUrl;
    if (videoSource.playableSourceUrl) return videoSource.playableSourceUrl;
    if (
      videoSource.videoUrl &&
      !videoSource.videoUrl.includes('youtube.com') &&
      !videoSource.videoUrl.includes('youtu.be')
    ) {
      return videoSource.videoUrl;
    }
    return '';
  };

  // Synced timer loop for embedded YouTube 9:16 playback so word-highlighted subtitles animate live
  useEffect(() => {
    if (!playingClipId) return;
    const playingClip = highlights.find((c) => c.id === playingClipId);
    if (!playingClip) return;
    const hasMp4 = Boolean(getClipVideoSource(playingClip));
    if (hasMp4) return;

    const startT = playingClip.startTime;
    const endT = playingClip.endTime;
    const interval = setInterval(() => {
      setPlayheadMap((prev) => {
        const cur = prev[playingClipId] ?? startT;
        const next = cur + 0.15;
        return {
          ...prev,
          [playingClipId]: next >= endT ? startT : next,
        };
      });
    }, 150);

    return () => clearInterval(interval);
  }, [playingClipId, highlights, videoSource]);

  const handleSeekClipToRelativeSec = async (clip: ClipHighlight, relSec: number) => {
    const isPreClipped = Boolean(clip.clipVideoUrl);
    const targetSec = isPreClipped
      ? Math.max(0, relSec)
      : Math.max(clip.startTime, Math.min(clip.endTime - 0.3, clip.startTime + relSec));

    setPlayheadMap((prev) => ({ ...prev, [clip.id]: targetSec }));
    const v = videoRefMap.current[clip.id];
    if (v) {
      try {
        v.currentTime = targetSec;
      } catch {}
    }
    if (playingClipId !== clip.id) {
      await handleTogglePlay(clip, targetSec);
    }
  };

  const handleTogglePlay = async (clip: ClipHighlight, explicitTarget?: number) => {
    const isCurrentPlaying = playingClipId === clip.id && explicitTarget === undefined;
    const currentVid = videoRefMap.current[clip.id];
    const src = getClipVideoSource(clip);

    if (!src && ytId) {
      if (playingClipId && videoRefMap.current[playingClipId]) {
        videoRefMap.current[playingClipId]?.pause();
      }
      if (isCurrentPlaying) {
        setPlayingClipId(null);
      } else {
        setPlayheadMap((prev) => ({ ...prev, [clip.id]: explicitTarget ?? clip.startTime }));
        setPlayingClipId(clip.id);
      }
      return;
    }

    if (!src) {
      setVideoErrors((prev) => ({
        ...prev,
        [clip.id]: 'Clip file not yet rendered. Click Re-clip 9:16 below.',
      }));
      return;
    }

    if (isCurrentPlaying) {
      currentVid?.pause();
      setPlayingClipId(null);
      return;
    }

    if (playingClipId && playingClipId !== clip.id && videoRefMap.current[playingClipId]) {
      videoRefMap.current[playingClipId]?.pause();
    }

    setVideoErrors((prev) => {
      const copy = { ...prev };
      delete copy[clip.id];
      return copy;
    });
    setPlayingClipId(clip.id);

    if (!currentVid) return;

    const isPreClipped = Boolean(clip.clipVideoUrl);
    const clipStart = isPreClipped ? 0 : clip.startTime;
    const clipEnd = isPreClipped
      ? currentVid.duration || Math.max(5, clip.endTime - clip.startTime)
      : clip.endTime;

    try {
      if (currentVid.readyState === 0) {
        currentVid.load();
        await new Promise<void>((resolve) => {
          const onReady = () => {
            currentVid.removeEventListener('canplay', onReady);
            currentVid.removeEventListener('loadedmetadata', onReady);
            resolve();
          };
          currentVid.addEventListener('canplay', onReady);
          currentVid.addEventListener('loadedmetadata', onReady);
          setTimeout(resolve, 2500);
        });
      }

      if (explicitTarget !== undefined) {
        currentVid.currentTime = explicitTarget;
      } else if (currentVid.currentTime < clipStart || currentVid.currentTime >= clipEnd - 0.2) {
        currentVid.currentTime = clipStart;
      }

      setPlayheadMap((prev) => ({ ...prev, [clip.id]: currentVid.currentTime }));
      currentVid.muted = isMuted;
      await currentVid.play();
    } catch {
      try {
        currentVid.muted = true;
        setIsMuted(true);
        await currentVid.play();
      } catch {
        setPlayingClipId(null);
        setVideoErrors((prev) => ({
          ...prev,
          [clip.id]: 'Unable to decode this clip stream. Click Re-clip 9:16 to repair.',
        }));
      }
    }
  };

  const handleReclip = async (clip: ClipHighlight) => {
    setReclippingId(clip.id);
    setVideoErrors((prev) => {
      const copy = { ...prev };
      delete copy[clip.id];
      return copy;
    });

    try {
      const clipDur = Math.max(5, Math.round(clip.endTime - clip.startTime));
      const res = await fetch('/api/clip-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoSource.videoUrl,
          playableSourceUrl: videoSource.playableSourceUrl,
          youtubeUrl: videoSource.youtubeUrl,
          startTime: clip.startTime,
          duration: clipDur,
          resolution: '720p',
          framingMode: clip.framingSuggestion || settings.framingMode || 'smart_crop',
          panX: typeof clip.panX === 'number' ? clip.panX : settings.panX,
          title: clip.title,
          clipId: `${clip.id}_${Date.now()}`,
        }),
      });
      const data = await parseJsonResponse(res, 'Clip render failed');
      if (!res.ok || !data.downloadUrl) {
        throw new Error(data.error || 'Clip render failed');
      }
      const updated: ClipHighlight = {
        ...clip,
        clipVideoUrl: data.downloadUrl,
        downloadUrl: data.downloadUrl,
      };
      if (onClipUpdated) onClipUpdated(updated);
    } catch (err: any) {
      setVideoErrors((prev) => ({
        ...prev,
        [clip.id]: err.message || 'Clip render failed',
      }));
    } finally {
      setReclippingId(null);
    }
  };

  const handleDirectDownload = async (clip: ClipHighlight) => {
    if (!getClipVideoSource(clip) && ytId) {
      onOpenExportModal(clip);
      return;
    }

    setDownloadingClipId(clip.id);

    const clipDur = Math.max(5, Math.round(clip.endTime - clip.startTime));
    try {
      const res = await fetch('/api/clip-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoSource.videoUrl,
          playableSourceUrl: videoSource.playableSourceUrl,
          youtubeUrl: videoSource.youtubeUrl,
          startTime: clip.startTime,
          duration: clipDur,
          resolution: '720p',
          framingMode: clip.framingSuggestion || settings.framingMode || 'smart_crop',
          panX: typeof clip.panX === 'number' ? clip.panX : settings.panX,
          title: clip.title,
          clipId: `${clip.id}_opus`,
          burnCaptions: true,
          captions: clip.captions,
          captionColor: settings.captionColor,
          captionBaseColor: settings.captionBaseColor,
          captionPosition: settings.captionPosition,
          captionFontSize: settings.captionFontSize,
          captionFontFamily: settings.captionFontFamily,
          captionTextCase: settings.captionTextCase,
          captionOutlineWidth: settings.captionOutlineWidth,
          captionDropShadow: settings.captionDropShadow,
          videoFilter: settings.videoFilter || 'none',
          filterBrightness: settings.filterBrightness ?? 100,
          filterContrast: settings.filterContrast ?? 100,
          filterSaturate: settings.filterSaturate ?? 100,
          playbackSpeed: settings.playbackSpeed ?? 1,
          normalizeAudio: Boolean(settings.normalizeAudio),
          showHookBanner: Boolean(settings.showHookBanner),
          hookBannerText: settings.hookBannerText || clip.hook,
        }),
      });

      const data = await parseJsonResponse(res, 'Server clip render failed');
      if (!res.ok || !data.downloadUrl) {
        throw new Error(data.error || 'Server clip render failed');
      }

      if (onClipUpdated) {
        onClipUpdated({
          ...clip,
          clipVideoUrl: data.downloadUrl,
          downloadUrl: data.downloadUrl,
        });
      }

      const clipFileRes = await fetch(data.downloadUrl);
      const blob = await clipFileRes.blob();
      downloadBlob(blob, data.filename || `clipforge_${clip.id}.mp4`);
    } catch (err) {
      console.warn('Direct clip fallback to export modal:', err);
      onOpenExportModal(clip);
    } finally {
      setDownloadingClipId(null);
    }
  };

  const handleQuickExportPlatform = async (clip: ClipHighlight, platform: ExportPlatform) => {
    if (!getClipVideoSource(clip) && ytId) {
      onOpenExportModal(clip, platform);
      return;
    }

    const targetAccount = workspacePrefs.autoApplyAccounts
      ? getDefaultAccountForPlatform(platform)
      : undefined;

    setQuickExporting({ clipId: clip.id, platform });
    try {
      const result = await renderServerClipForPlatform({
        clip,
        videoSource,
        settings,
        platform,
        account: targetAccount,
        autoApplyAiFraming: workspacePrefs.autoApplyAiFraming,
      });

      if (onClipUpdated) {
        onClipUpdated({
          ...clip,
          clipVideoUrl: result.downloadUrl,
          downloadUrl: result.downloadUrl,
        });
      }

      setQuickExportDone((prev) => ({
        ...prev,
        [clip.id]: {
          platform,
          filename: result.filename,
          captionCopied: result.captionCopied,
        },
      }));

      logClipExport({
        platform,
        clipId: clip.id,
        clipTitle: clip.title,
        sourceVideoTitle: videoSource.title,
        filename: result.filename,
        captionCopy: buildPlatformSocialCopy(clip, platform, targetAccount),
        durationSec: Math.max(1, Math.round(clip.endTime - clip.startTime)),
        viralityScore: clip.viralityScore,
        status: 'exported',
        accountId: targetAccount?.id,
        accountHandle: targetAccount?.handle,
      }).catch(() => {});
    } catch (err) {
      console.warn('Quick platform export fallback to modal:', err);
      onOpenExportModal(clip, platform);
    } finally {
      setQuickExporting(null);
    }
  };

  const handleOpenSocialPack = async (clip: ClipHighlight) => {
    setSocialModalClip(clip);
    setSocialPack(null);
    setSocialError(null);
    setIsGeneratingSocial(true);

    try {
      const dialogue = clip.captions.map((c) => c.text).join(' ');
      const res = await fetch('/api/ai-social-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: clip.title,
          hook: clip.hook,
          reason: clip.reason,
          dialogue,
          hashtags: clip.hashtags,
        }),
      });
      const data = await parseJsonResponse(res, 'Failed to generate AI social copy');
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate AI social copy');
      }
      setSocialPack(data);
    } catch (err: any) {
      setSocialError(err.message || 'Could not generate AI social pack');
    } finally {
      setIsGeneratingSocial(false);
    }
  };

  const handleAiBoostClip = async (clip: ClipHighlight) => {
    if (aiBoostingId) return;
    setAiBoostingId(clip.id);
    try {
      const res = await fetch('/api/ai-optimize-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip,
          videoTitle: videoSource.title,
          fullDuration: videoSource.duration,
          transcript: videoSource.transcript,
        }),
      });
      const data = await parseJsonResponse(res, 'AI retention boost failed');
      if (!res.ok) {
        throw new Error(data.error || 'AI retention boost failed');
      }
      const updatedClip: ClipHighlight = {
        ...clip,
        title: data.improvedTitle || clip.title,
        hook: data.improvedHook || clip.hook,
        reason: data.improvedReason || clip.reason,
        startTime:
          typeof data.recommendedStartTime === 'number'
            ? data.recommendedStartTime
            : clip.startTime,
        endTime:
          typeof data.recommendedEndTime === 'number'
            ? data.recommendedEndTime
            : clip.endTime,
        viralityScore: data.boostedViralityScore || clip.viralityScore,
        hookScore: data.boostedHookScore || clip.hookScore,
        flowScore: data.boostedFlowScore || clip.flowScore,
        framingSuggestion: data.recommendedFraming || clip.framingSuggestion,
        hashtags: Array.isArray(data.hashtags) ? data.hashtags : clip.hashtags,
        captions: Array.isArray(data.captions) && data.captions.length > 0 ? data.captions : clip.captions,
      };
      if (onClipUpdated) {
        onClipUpdated(updatedClip);
      }
      if (data.retentionCritique) {
        setBoostNotes((prev) => ({
          ...prev,
          [clip.id]: `${data.retentionCritique} (Recommended: ${data.recommendedCaptionPreset}, ${data.recommendedSpeed}x speed, ${data.recommendedFilter} grade)`,
        }));
      }
    } catch (err: any) {
      setVideoErrors((prev) => ({
        ...prev,
        [clip.id]: err?.message || 'AI Boost failed',
      }));
    } finally {
      setAiBoostingId(null);
    }
  };

  const handleCopyDescription = (clip: ClipHighlight) => {
    const text = `${clip.title}\n\n${clip.reason}\n\n"${clip.hook}"\n\n${clip.hashtags.join(' ')} #shorts #tiktok`;
    navigator.clipboard.writeText(text);
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyHashtag = (key: string, tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedHashtag(key);
    setTimeout(() => setCopiedHashtag(null), 1400);
  };

  const handleCopySocialField = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedSocialField(key);
    setTimeout(() => setCopiedSocialField(null), 1800);
  };

  const handleDownloadSrt = (clip: ClipHighlight) => {
    const srt = generateSrtFile(clip.captions);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${clip.id}_captions.srt`);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = Math.floor(sec % 60);
    return `${mins}:${String(rem).padStart(2, '0')}`;
  };

  // Current Opus custom subtitle settings
  const highlightStyle: CaptionHighlightStyle = settings.captionHighlightStyle || 'active_box';
  const accentColor = settings.captionColor || '#22C55E';
  const baseColor = settings.captionBaseColor || '#FFFFFF';
  const fontFamily = settings.captionFontFamily || 'Montserrat';
  const textCase: CaptionTextCase = settings.captionTextCase || 'uppercase';

  return (
    <div className="space-y-5">
      {/* Top Opus-Style Project Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="font-semibold text-emerald-400">Opus Results</span>
            <span className="text-zinc-600">·</span>
            <span className="tabular-nums font-medium text-zinc-200">{highlights.length} viral shorts</span>
            <span className="text-zinc-600">·</span>
            <span className="font-mono tabular-nums">Source {formatSeconds(videoSource.duration)}</span>
            {topClip && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="font-mono tabular-nums text-emerald-400">
                  Peak {topClip.viralityScore}/100
                </span>
              </>
            )}
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-zinc-100 truncate">
            {videoSource.title}
          </h2>
          {(videoSource.aiSummary || videoSource.description) && (
            <p className="text-xs text-zinc-400 line-clamp-2 max-w-3xl leading-relaxed">
              {videoSource.aiSummary || videoSource.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setSortBy(sortBy === 'score' ? 'timeline' : 'score')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors cursor-pointer"
            title="Sort clips"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>{sortBy === 'score' ? 'Score: High to Low' : 'Order: Timeline'}</span>
          </button>

          <button
            onClick={onNewVideo}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            + Ingest New Video
          </button>
        </div>
      </div>

      {/* Live Subtitle Style & Highlight Quick Form (applies live across all Feed cards & Studio) */}
      <div className="p-3.5 rounded-xl bg-zinc-900/75 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
          <Highlighter className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Subtitle Highlight:</span>
          <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
            {(
              [
                { id: 'active_box', label: 'Active Box' },
                { id: 'text_color', label: 'Word Pop' },
                { id: 'underline_glow', label: 'Underline' },
                { id: 'dual_tone', label: 'Karaoke' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => onUpdateSettings({ captionHighlightStyle: opt.id })}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  highlightStyle === opt.id
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-400">Highlight Color:</span>
            {['#22C55E', '#FACC15', '#8B5CF6', '#06B6D4', '#F97316', '#F43F5E'].map((hex) => (
              <button
                key={hex}
                onClick={() => onUpdateSettings({ captionColor: hex })}
                className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                  accentColor.toUpperCase() === hex ? 'scale-125 border-white' : 'border-zinc-700'
                }`}
                style={{ backgroundColor: hex }}
                title={`Set highlight ${hex}`}
              />
            ))}
          </div>

          <select
            value={textCase}
            onChange={(e) => onUpdateSettings({ captionTextCase: e.target.value as CaptionTextCase })}
            aria-label="Subtitle Text Case"
            className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="uppercase">ALL CAPS</option>
            <option value="titlecase">Title Case</option>
            <option value="original">As Spoken</option>
          </select>
        </div>
      </div>

      {/* Live YouTube Vertical Player Info Strip */}
      {videoSource.youtubeDownloadBlocked && ytId && !videoSource.playableSourceUrl && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
          <div className="flex items-center gap-2">
            <Youtube className="w-4 h-4 text-red-500 shrink-0" />
            <span>
              Live YouTube 9:16 Vertical Player active with Gemini AI hooks & synced word-highlighted captions. Upload a local MP4 anytime for direct MP4 exports.
            </span>
          </div>
          <button
            onClick={onNewVideo}
            className="text-emerald-400 hover:text-emerald-300 font-medium shrink-0 cursor-pointer"
          >
            Upload Local MP4 →
          </button>
        </div>
      )}

      {/* Ask Gemini AI to Clip More */}
      {onGenerateMoreClips && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isAiGenerating) return;
            onGenerateMoreClips(morePrompt.trim(), moreCount);
            setMorePrompt('');
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800"
        >
          <div className="relative flex-1 flex items-center">
            <Sparkles className="w-3.5 h-3.5 text-violet-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={morePrompt}
              onChange={(e) => setMorePrompt(e.target.value)}
              disabled={isAiGenerating}
              placeholder="Extract custom clips with Gemini AI (e.g. '3 fast 15s reactions' or 'key debate clash')..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 disabled:opacity-60"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={moreCount}
              onChange={(e) => setMoreCount(Number(e.target.value))}
              disabled={isAiGenerating}
              aria-label="Number of additional clips"
              className="px-2.5 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              <option value={1}>+1 Clip</option>
              <option value={3}>+3 Clips</option>
              <option value={5}>+5 Clips</option>
              <option value={8}>+8 Clips</option>
            </select>

            <button
              type="submit"
              disabled={isAiGenerating}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isAiGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Clipping...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Clip More</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
          {[
            { id: 'all', label: `All Clips (${highlights.length})` },
            { id: 'funny', label: `Humor (${highlights.filter((c) => c.category === 'funny').length})` },
            { id: 'highlight', label: `Climax (${highlights.filter((c) => c.category === 'highlight').length})` },
            { id: 'educational', label: `Insights (${highlights.filter((c) => c.category === 'educational').length})` },
            { id: 'debate', label: `Debate (${highlights.filter((c) => c.category === 'debate').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === tab.id
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-zinc-500 font-mono">
          Ranked Opus Split View · Click transcript words to seek
        </span>
      </div>

      {/* OpusClip Signature Ranked Horizontal Split Rows */}
      <div className="space-y-5">
        {filtered.map((clip, index) => {
          const duration = Math.max(1, Math.round(clip.endTime - clip.startTime));
          const isPlaying = playingClipId === clip.id;
          const isPreClipped = Boolean(clip.clipVideoUrl);
          const videoSrc = getClipVideoSource(clip);
          const clipError = videoErrors[clip.id];

          const rawPlayhead = playheadMap[clip.id] ?? (isPreClipped ? 0 : clip.startTime);
          const relSec = isPreClipped ? rawPlayhead : Math.max(0, rawPlayhead - clip.startTime);
          const progressPct = Math.max(0, Math.min(100, (relSec / duration) * 100));

          const activeCaption =
            clip.captions.find((c) => relSec >= c.start && relSec <= c.end) || clip.captions[0];

          const activeTokens = activeCaption
            ? activeCaption.words && activeCaption.words.length > 0
              ? activeCaption.words
              : activeCaption.text
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((w, wi, arr) => {
                    const seg = (activeCaption.end - activeCaption.start) / Math.max(1, arr.length);
                    return {
                      w,
                      start: activeCaption.start + wi * seg,
                      end: activeCaption.start + (wi + 1) * seg,
                    };
                  })
            : [];

          const hookMetric = clip.hookScore ?? Math.min(100, clip.viralityScore + 1);
          const flowMetric = clip.flowScore ?? Math.max(82, clip.viralityScore - 2);
          const emotionMetric = clip.emotionScore ?? Math.max(80, clip.viralityScore - 3);
          const trendMetric = Math.max(84, Math.min(99, Math.round((hookMetric + clip.viralityScore) / 2)));

          return (
            <article
              key={clip.id}
              className="rounded-2xl bg-zinc-900/75 border border-zinc-800 hover:border-zinc-700 transition-colors overflow-hidden flex flex-col md:flex-row"
            >
              {/* LEFT: Clean Uncluttered 9:16 Vertical Player with Live Word-Highlighted Subtitles */}
              <div className="relative w-full md:w-[255px] lg:w-[275px] aspect-[9/16] shrink-0 bg-black border-b md:border-b-0 md:border-r border-zinc-800 overflow-hidden select-none group">
                {videoSrc ? (
                  <div
                    onClick={() => handleTogglePlay(clip)}
                    className="relative w-full h-full cursor-pointer"
                  >
                    <video
                      ref={(el) => {
                        videoRefMap.current[clip.id] = el;
                      }}
                      src={videoSrc}
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget;
                        v.playbackRate = Math.max(0.75, Math.min(1.5, Number(settings.playbackSpeed) || 1));
                        if (!isPreClipped && clip.startTime > 0 && v.currentTime < clip.startTime) {
                          try {
                            v.currentTime = clip.startTime;
                          } catch {}
                        }
                      }}
                      onError={() => {
                        setPlayingClipId((prev) => (prev === clip.id ? null : prev));
                        setVideoErrors((prev) => ({
                          ...prev,
                          [clip.id]: 'Video source failed to load. Click Re-clip 9:16.',
                        }));
                      }}
                      onTimeUpdate={(e) => {
                        const v = e.currentTarget;
                        const targetSpeed = Math.max(0.75, Math.min(1.5, Number(settings.playbackSpeed) || 1));
                        if (v.playbackRate !== targetSpeed) {
                          v.playbackRate = targetSpeed;
                        }
                        setPlayheadMap((prev) => ({ ...prev, [clip.id]: v.currentTime }));
                        if (isPreClipped) {
                          if (v.duration && v.currentTime >= v.duration - 0.15) {
                            v.currentTime = 0;
                            v.play().catch(() => {});
                          }
                        } else if (v.currentTime >= clip.endTime - 0.1) {
                          v.currentTime = clip.startTime;
                          v.play().catch(() => {});
                        }
                      }}
                      className="w-full h-full object-cover"
                      style={{ filter: getCssFilterString(settings) }}
                    />
                  </div>
                ) : ytId ? (
                  <div
                    onClick={() => !isPlaying && handleTogglePlay(clip)}
                    className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden cursor-pointer"
                  >
                    {isPlaying ? (
                      <iframe
                        key={`${clip.id}-${isMuted ? 'm' : 'u'}`}
                        src={`https://www.youtube.com/embed/${ytId}?start=${Math.floor(clip.startTime)}&end=${Math.ceil(clip.endTime)}&autoplay=1&rel=0&modestbranding=1&playsinline=1&mute=${isMuted ? 1 : 0}`}
                        title={clip.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="h-full w-[320%] max-w-none border-0 pointer-events-auto"
                      />
                    ) : (
                      <img
                        src={videoSource.thumbnail || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                        alt={clip.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-5 text-center space-y-3">
                    <p className="text-xs text-zinc-400">Preview requires 9:16 render</p>
                    <button
                      onClick={() => handleReclip(clip)}
                      disabled={reclippingId === clip.id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                    >
                      {reclippingId === clip.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Render 9:16</span>
                    </button>
                  </div>
                )}

                {clipError && (
                  <div className="absolute inset-0 z-30 bg-zinc-950/90 p-4 flex flex-col items-center justify-center text-center space-y-3">
                    <p className="text-xs text-rose-300">{clipError}</p>
                    <button
                      onClick={() => handleReclip(clip)}
                      disabled={reclippingId === clip.id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      {reclippingId === clip.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Re-clip 9:16</span>
                    </button>
                  </div>
                )}

                {/* Top corner duration pill */}
                <div className="absolute top-3 right-3 z-20 px-2 py-0.5 rounded bg-black/75 text-[11px] font-mono tabular-nums text-zinc-200 pointer-events-none">
                  {formatSeconds(duration)}
                </div>

                {/* Live Opus Word-Highlighted Subtitle Overlay at Lower Third (Clean, zero face-blocking sticker) */}
                {activeCaption && (
                  <div className="absolute bottom-7 left-3 right-3 z-20 flex justify-center pointer-events-none">
                    <div
                      key={`${clip.id}-${activeCaption.start}`}
                      className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded-lg text-center ${
                        settings.captionPreset === 'minimal_cinema' ? 'bg-black/75' : ''
                      }`}
                      style={{ fontFamily: `"${fontFamily}", "Montserrat", sans-serif` }}
                    >
                      {activeTokens.map((tok, wi) => {
                        const isWordActive = relSec >= tok.start && relSec <= tok.end;
                        const isWordSpoken = relSec >= tok.start;
                        const label = formatCaptionCase(tok.w, textCase);
                        const boxContrast =
                          accentColor.toUpperCase() === '#FACC15' ||
                          accentColor.toUpperCase() === '#FFFFFF'
                            ? '#09090B'
                            : '#FFFFFF';

                        return (
                          <span
                            key={wi}
                            className="text-sm font-black leading-tight tracking-wide transition-all duration-100 inline-block"
                            style={{
                              color:
                                highlightStyle === 'active_box' && isWordActive
                                  ? boxContrast
                                  : highlightStyle === 'dual_tone'
                                  ? isWordSpoken
                                    ? accentColor
                                    : baseColor
                                  : isWordActive && highlightStyle !== 'none'
                                  ? accentColor
                                  : baseColor,
                              backgroundColor:
                                highlightStyle === 'active_box' && isWordActive
                                  ? accentColor
                                  : 'transparent',
                              padding:
                                highlightStyle === 'active_box' && isWordActive ? '1px 6px' : '1px 1px',
                              borderRadius:
                                highlightStyle === 'active_box' && isWordActive ? '5px' : undefined,
                              borderBottom:
                                highlightStyle === 'underline_glow' && isWordActive
                                  ? `2.5px solid ${accentColor}`
                                  : '2.5px solid transparent',
                              textShadow:
                                highlightStyle === 'active_box' && isWordActive
                                  ? 'none'
                                  : '0 2px 5px rgba(0,0,0,0.95), 0 0 2px #000',
                            }}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Scrubber Bar */}
                {(videoSrc || ytId) && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      const v = videoRefMap.current[clip.id];
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      const target = isPreClipped
                        ? ratio * (v?.duration || duration)
                        : clip.startTime + ratio * duration;
                      if (v) v.currentTime = target;
                      setPlayheadMap((prev) => ({ ...prev, [clip.id]: target }));
                    }}
                    className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-800/80 z-30 cursor-pointer"
                    title="Scrub video"
                  >
                    <div
                      className="h-full transition-[width] duration-75"
                      style={{ width: `${progressPct}%`, backgroundColor: accentColor }}
                    />
                  </div>
                )}

                {/* Center Play Trigger */}
                {!isPlaying && !clipError && (videoSrc || ytId) && (
                  <div
                    onClick={() => handleTogglePlay(clip)}
                    className="absolute inset-0 flex items-center justify-center cursor-pointer z-20 bg-black/15 hover:bg-black/5 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/95 text-zinc-950 flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform">
                      <Play className="w-5 h-5 ml-0.5 fill-zinc-950" />
                    </div>
                  </div>
                )}

                {/* Active Playback Controls */}
                {isPlaying && (
                  <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5">
                    <button
                      onClick={() => handleTogglePlay(clip)}
                      className="p-1.5 rounded-md bg-black/80 hover:bg-black text-white border border-zinc-700 cursor-pointer"
                      title="Pause"
                    >
                      <Pause className="w-3.5 h-3.5 fill-white" />
                    </button>
                    <button
                      onClick={() => {
                        const v = videoRefMap.current[clip.id];
                        if (v) {
                          v.muted = !v.muted;
                          setIsMuted(v.muted);
                        } else {
                          setIsMuted((prev) => !prev);
                        }
                      }}
                      className="p-1.5 rounded-md bg-black/80 hover:bg-black text-white border border-zinc-700 cursor-pointer"
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? (
                        <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* RIGHT: OpusClip Editorial Video Description, Score Breakdown & Word-Highlighted Transcript */}
              <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between gap-4 min-w-0">
                <div className="space-y-4">
                  {/* Top Row: Rank, Time Metadata & Opus Virality Score */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                          #{index + 1}
                        </span>
                        <span className="text-zinc-600">·</span>
                        <span className="font-mono tabular-nums">
                          {formatSeconds(clip.startTime)} – {formatSeconds(clip.endTime)} ({duration}s)
                        </span>
                        <span className="text-zinc-600">·</span>
                        <span className="capitalize">{clip.category}</span>
                        <span className="text-zinc-600">·</span>
                        <span className="font-mono text-[11px] text-zinc-500">
                          {clip.framingSuggestion || 'smart_crop'}
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-semibold text-zinc-100 leading-snug">
                        {clip.title}
                      </h3>
                    </div>

                    {/* Virality Score Metric */}
                    <div className="text-right shrink-0 pl-3 border-l border-zinc-800">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                        Virality Score
                      </div>
                      <div className="flex items-baseline justify-end gap-0.5 tabular-nums">
                        <span
                          className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                            clip.viralityScore >= 90 ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {clip.viralityScore}
                        </span>
                        <span className="text-xs font-mono text-zinc-500">/100</span>
                      </div>
                    </div>
                  </div>

                  {/* 4-Metric Opus Virality Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    {[
                      { label: 'Hook', val: hookMetric },
                      { label: 'Flow', val: flowMetric },
                      { label: 'Engagement', val: emotionMetric },
                      { label: 'Trend', val: trendMetric },
                    ].map((m) => (
                      <div key={m.label} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400">{m.label}</span>
                          <span className="font-mono font-semibold text-zinc-200 tabular-nums">
                            {m.val}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${m.val}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Structured Video Description + Opening Hook + Copyable Hashtags */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Video Description & Viral Rationale
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      {clip.reason}
                    </p>
                    <div className="text-xs text-zinc-400">
                      <span className="text-zinc-500 font-medium">Opening Hook: </span>
                      <span className="text-zinc-200 italic">"{clip.hook}"</span>
                    </div>

                    {clip.hashtags && clip.hashtags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5 text-[11px] font-mono text-emerald-400/90">
                        <Hash className="w-3 h-3 text-zinc-500 shrink-0" />
                        {clip.hashtags.map((tag, ti) => {
                          const key = `${clip.id}-${ti}`;
                          return (
                            <button
                              key={key}
                              onClick={() => handleCopyHashtag(key, tag)}
                              className="hover:text-emerald-300 transition-colors cursor-pointer"
                              title="Click to copy hashtag"
                            >
                              {copiedHashtag === key ? `${tag} ✓` : tag}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Interactive Word-Highlighted Transcript */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold uppercase tracking-wider text-zinc-400">
                        Transcript & Active Highlights
                      </span>
                      <span className="text-zinc-500">Click any line to seek</span>
                    </div>

                    <div className="max-h-36 overflow-y-auto pr-1 space-y-1.5 text-xs leading-relaxed">
                      {clip.captions.map((chunk, ci) => {
                        const tokens =
                          chunk.words && chunk.words.length > 0
                            ? chunk.words
                            : chunk.text
                                .split(/\s+/)
                                .filter(Boolean)
                                .map((w, wi, arr) => {
                                  const seg = (chunk.end - chunk.start) / Math.max(1, arr.length);
                                  return {
                                    w,
                                    start: chunk.start + wi * seg,
                                    end: chunk.start + (wi + 1) * seg,
                                  };
                                });

                        return (
                          <div
                            key={ci}
                            onClick={() => handleSeekClipToRelativeSec(clip, chunk.start)}
                            className="flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer"
                          >
                            <span className="font-mono text-[10px] text-zinc-500 tabular-nums pt-0.5 shrink-0">
                              {formatSeconds(clip.startTime + chunk.start)}
                            </span>
                            <p className="flex-1 flex flex-wrap gap-x-1 gap-y-0.5 text-zinc-300">
                              {tokens.map((tok, wi) => {
                                const isActiveWord =
                                  isPlaying && relSec >= tok.start && relSec <= tok.end;
                                const isEmphasis =
                                  chunk.emphasisWord &&
                                  tok.w.toUpperCase().includes(chunk.emphasisWord.toUpperCase());

                                return (
                                  <span
                                    key={wi}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSeekClipToRelativeSec(clip, tok.start);
                                    }}
                                    className={`rounded px-0.5 transition-colors ${
                                      isActiveWord
                                        ? 'font-semibold text-zinc-950'
                                        : isEmphasis
                                        ? 'text-emerald-300 font-medium underline decoration-emerald-500/50 underline-offset-2'
                                        : 'hover:text-white'
                                    }`}
                                    style={
                                      isActiveWord
                                        ? { backgroundColor: accentColor }
                                        : undefined
                                    }
                                  >
                                    {tok.w}
                                  </span>
                                );
                              })}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="pt-3 border-t border-zinc-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => onSelectClipToEdit(clip)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Edit in Studio</span>
                      </button>

                      <button
                        onClick={() => handleDirectDownload(clip)}
                        disabled={downloadingClipId === clip.id || quickExporting?.clipId === clip.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {downloadingClipId === clip.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Exporting...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Download MP4</span>
                          </>
                        )}
                      </button>

                      {/* 1-Click Platform Export Shortcuts */}
                      <div className="flex items-center gap-1 pl-1 border-l border-zinc-800">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mr-0.5 hidden sm:inline">
                          Quick:
                        </span>
                        {(
                          [
                            { id: 'shorts', Icon: Youtube, color: 'text-red-400' },
                            { id: 'tiktok', Icon: Music2, color: 'text-cyan-400' },
                          ] as const
                        ).map(({ id, Icon, color }) => {
                          const preset = PLATFORM_PRESETS[id];
                          const isThisExporting =
                            quickExporting?.clipId === clip.id && quickExporting.platform === id;
                          return (
                            <button
                              key={id}
                              onClick={() => handleQuickExportPlatform(clip, id)}
                              disabled={
                                downloadingClipId === clip.id || quickExporting?.clipId === clip.id
                              }
                              title={`Quick export for ${preset.label} (${preset.tag}) & copy caption`}
                              className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-zinc-200 text-[11px] font-medium border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isThisExporting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                              ) : (
                                <Icon className={`w-3.5 h-3.5 ${color}`} />
                              )}
                              <span>{preset.shortLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <button
                        onClick={() => handleAiBoostClip(clip)}
                        disabled={aiBoostingId === clip.id}
                        className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium transition-colors cursor-pointer disabled:opacity-50"
                        title="Optimize hook, trim, score & captions with Gemini AI"
                      >
                        {aiBoostingId === clip.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5" />
                        )}
                        <span>{aiBoostingId === clip.id ? 'Boosting...' : 'AI Boost'}</span>
                      </button>

                      <button
                        onClick={() => handleOpenSocialPack(clip)}
                        className="flex items-center gap-1 text-violet-400 hover:text-violet-300 font-medium transition-colors cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Social Copy</span>
                      </button>

                      <button
                        onClick={() => handleCopyDescription(clip)}
                        className="flex items-center gap-1 hover:text-zinc-200 transition-colors cursor-pointer"
                      >
                        {copiedId === clip.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDownloadSrt(clip)}
                        className="flex items-center gap-1 hover:text-zinc-200 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>.SRT</span>
                      </button>
                    </div>
                  </div>

                  {boostNotes[clip.id] && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{boostNotes[clip.id]}</span>
                    </div>
                  )}

                  {quickExportDone[clip.id] && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[11px]">
                      <div className="flex items-center gap-1.5 text-emerald-300 min-w-0">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          Exported{' '}
                          <span className="font-mono text-emerald-200">
                            {quickExportDone[clip.id].filename}
                          </span>
                          {workspacePrefs.autoApplyAccounts &&
                          getDefaultAccountForPlatform(quickExportDone[clip.id].platform)
                            ? ` for ${getDefaultAccountForPlatform(quickExportDone[clip.id].platform)?.handle}`
                            : ''}
                          {quickExportDone[clip.id].captionCopied ? ' · Caption & hashtags copied' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {onOpenDashboard && (
                          <button
                            type="button"
                            onClick={onOpenDashboard}
                            className="text-zinc-300 hover:text-white underline underline-offset-2 cursor-pointer"
                          >
                            Monitor in Dashboard
                          </button>
                        )}
                        <a
                          href={PLATFORM_PRESETS[quickExportDone[clip.id].platform].uploadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 font-semibold text-emerald-300 hover:text-emerald-200 underline underline-offset-2 shrink-0"
                        >
                          <span>{PLATFORM_PRESETS[quickExportDone[clip.id].platform].uploadCta}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Gemini AI Social Copy Modal */}
      {socialModalClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/60">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">AI Viral Publishing Pack</h3>
                  <p className="text-[11px] text-zinc-500 line-clamp-1">{socialModalClip.title}</p>
                </div>
              </div>
              <button
                onClick={() => setSocialModalClip(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {isGeneratingSocial ? (
                <div className="py-10 flex flex-col items-center justify-center gap-3 text-xs text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                  <span>Gemini writing TikTok & Shorts copy...</span>
                </div>
              ) : socialError ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-2">
                  <p>{socialError}</p>
                  <button
                    onClick={() => handleOpenSocialPack(socialModalClip)}
                    className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : socialPack ? (
                <div className="space-y-3.5">
                  {[
                    { key: 'cover', label: 'Thumbnail Cover Text', val: socialPack.coverText },
                    { key: 'shorts', label: 'YouTube Shorts Title', val: socialPack.shortsTitle },
                    { key: 'tiktok', label: 'TikTok Post Caption', val: socialPack.tiktokCaption },
                    { key: 'comment', label: 'Engagement Pinned Comment', val: socialPack.pinnedComment },
                  ].map((item) => (
                    <div key={item.key} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-zinc-300">{item.label}</span>
                        <button
                          onClick={() => handleCopySocialField(item.key, item.val)}
                          className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        >
                          {copiedSocialField === item.key ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">{item.val}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
