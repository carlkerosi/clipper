import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  Download,
  Sliders,
  Copy,
  Check,
  FileText,
  Sparkles,
  TrendingUp,
  Volume2,
  VolumeX,
  Loader2,
  RefreshCw,
  Share2,
  X,
} from 'lucide-react';
import { ClipHighlight, VideoSource } from '../types';
import { generateSrtFile, downloadBlob } from '../utils/exportVideo';

interface OpusClipFeedProps {
  videoSource: VideoSource;
  highlights: ClipHighlight[];
  onSelectClipToEdit: (clip: ClipHighlight) => void;
  onOpenExportModal: (clip: ClipHighlight) => void;
  onNewVideo: () => void;
  onClipUpdated?: (updatedClip: ClipHighlight) => void;
}

interface SocialPack {
  coverText: string;
  pinnedComment: string;
  tiktokCaption: string;
  reelsCaption: string;
  shortsTitle: string;
}

export const OpusClipFeed: React.FC<OpusClipFeedProps> = ({
  videoSource,
  highlights,
  onSelectClipToEdit,
  onOpenExportModal,
  onNewVideo,
  onClipUpdated,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [playheadMap, setPlayheadMap] = useState<Record<string, number>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [downloadingClipId, setDownloadingClipId] = useState<string | null>(null);
  const [reclippingId, setReclippingId] = useState<string | null>(null);
  const [videoErrors, setVideoErrors] = useState<Record<string, string>>({});

  // Gemini AI Social Pack modal state
  const [socialModalClip, setSocialModalClip] = useState<ClipHighlight | null>(null);
  const [socialPack, setSocialPack] = useState<SocialPack | null>(null);
  const [isGeneratingSocial, setIsGeneratingSocial] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [copiedSocialField, setCopiedSocialField] = useState<string | null>(null);

  const videoRefMap = useRef<Record<string, HTMLVideoElement | null>>({});

  const filtered = highlights.filter((c) => {
    if (selectedCategory === 'all') return true;
    return c.category === selectedCategory;
  });

  const topClip = highlights.reduce(
    (max, c) => (c.viralityScore > (max?.viralityScore || 0) ? c : max),
    highlights[0]
  );

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

  const handleTogglePlay = async (clip: ClipHighlight) => {
    const isCurrentPlaying = playingClipId === clip.id;
    const currentVid = videoRefMap.current[clip.id];
    const src = getClipVideoSource(clip);

    if (!src) {
      setVideoErrors((prev) => ({
        ...prev,
        [clip.id]: 'Clip file not yet rendered. Click Re-clip 9:16 to render it.',
      }));
      return;
    }

    if (isCurrentPlaying) {
      currentVid?.pause();
      setPlayingClipId(null);
      return;
    }

    // Pause any other currently playing video
    if (playingClipId && videoRefMap.current[playingClipId]) {
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

      if (
        currentVid.currentTime < clipStart ||
        currentVid.currentTime >= clipEnd - 0.2
      ) {
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
          framingMode: clip.framingSuggestion || 'smart_crop',
          title: clip.title,
          clipId: `${clip.id}_${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.downloadUrl) {
        throw new Error(data.error || 'Clip render failed');
      }
      const updated: ClipHighlight = {
        ...clip,
        clipVideoUrl: data.downloadUrl,
        downloadUrl: data.downloadUrl,
      };
      if (onClipUpdated) {
        onClipUpdated(updated);
      }
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
    setDownloadingClipId(clip.id);

    if (clip.clipVideoUrl || clip.downloadUrl) {
      const url = clip.clipVideoUrl || clip.downloadUrl!;
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        downloadBlob(blob, `clipforge_${clip.id}.mp4`);
      } catch {
        const link = document.createElement('a');
        link.href = url;
        link.download = `clipforge_${clip.id}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setDownloadingClipId(null);
      return;
    }

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
          framingMode: clip.framingSuggestion || 'smart_crop',
          title: clip.title,
          clipId: clip.id,
        }),
      });

      const data = await res.json();
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
      const data = await res.json();
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

  const handleCopyCaption = (clip: ClipHighlight) => {
    const text = `${clip.title}\n\n"${clip.hook}"\n\n${clip.hashtags.join(' ')} #shorts #viral #reels #tiktok`;
    navigator.clipboard.writeText(text);
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(null), 2000);
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

  return (
    <div className="space-y-6">
      {/* Top Studio Asset Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-lg">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Gemini AI Clips Ready
            </span>
            <span>·</span>
            <span>{highlights.length} vertical 9:16 shorts</span>
            <span>·</span>
            <span className="font-mono tabular-nums">Source: {formatSeconds(videoSource.duration)}</span>
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-zinc-100 truncate max-w-xl">
            {videoSource.title}
          </h2>
          {videoSource.aiSummary && (
            <p className="text-xs text-zinc-400 line-clamp-1">{videoSource.aiSummary}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {topClip && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-zinc-400">Top Virality:</span>
              <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                {topClip.viralityScore}%
              </span>
            </div>
          )}

          <button
            onClick={onNewVideo}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 text-xs font-medium border border-zinc-700/80 transition-colors cursor-pointer"
          >
            + Ingest New Video
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
          {[
            { id: 'all', label: `All Clips (${highlights.length})` },
            {
              id: 'funny',
              label: `Humor (${highlights.filter((c) => c.category === 'funny').length})`,
            },
            {
              id: 'highlight',
              label: `Climax (${highlights.filter((c) => c.category === 'highlight').length})`,
            },
            {
              id: 'educational',
              label: `Insights (${highlights.filter((c) => c.category === 'educational').length})`,
            },
            {
              id: 'debate',
              label: `Debate (${highlights.filter((c) => c.category === 'debate').length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === tab.id
                  ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-zinc-500 hidden sm:inline font-mono">
          9:16 Vertical TikTok / Shorts Format
        </span>
      </div>

      {/* Grid of Clips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((clip, index) => {
          const duration = Math.max(1, Math.round(clip.endTime - clip.startTime));
          const isPlaying = playingClipId === clip.id;
          const isPreClipped = Boolean(clip.clipVideoUrl);
          const videoSrc = getClipVideoSource(clip);
          const clipError = videoErrors[clip.id];

          const rawPlayhead =
            playheadMap[clip.id] ?? (isPreClipped ? 0 : clip.startTime);
          const relSec = isPreClipped
            ? rawPlayhead
            : Math.max(0, rawPlayhead - clip.startTime);
          const progressPct = Math.max(
            0,
            Math.min(100, (relSec / duration) * 100)
          );

          const activeCaption =
            clip.captions.find((c) => relSec >= c.start && relSec <= c.end) ||
            clip.captions[0];

          return (
            <div
              key={clip.id}
              className="group rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700/90 shadow-lg overflow-hidden flex flex-col justify-between transition-all duration-200"
            >
              {/* Vertical 9:16 Video Player Container */}
              <div className="relative aspect-[9/13] bg-zinc-950 overflow-hidden flex items-center justify-center select-none">
                {videoSrc ? (
                  <div
                    onClick={() => handleTogglePlay(clip)}
                    className="relative w-full h-full cursor-pointer flex items-center justify-center"
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
                          [clip.id]: 'Video source failed to load. Click Re-clip 9:16 below.',
                        }));
                      }}
                      onTimeUpdate={(e) => {
                        const v = e.currentTarget;
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
                      className={`w-full h-full object-cover transition-opacity duration-300 ${
                        isPlaying ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'
                      }`}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <p className="text-xs text-zinc-400">Preview segment requires 9:16 render</p>
                    <button
                      onClick={() => handleReclip(clip)}
                      disabled={reclippingId === clip.id}
                      className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer flex items-center gap-1.5"
                    >
                      {reclippingId === clip.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Render 9:16 Clip</span>
                    </button>
                  </div>
                )}

                {/* Video Error Overlay */}
                {clipError && (
                  <div className="absolute inset-0 z-30 bg-zinc-950/90 p-5 flex flex-col items-center justify-center text-center space-y-3">
                    <p className="text-xs text-rose-300">{clipError}</p>
                    <button
                      onClick={() => handleReclip(clip)}
                      disabled={reclippingId === clip.id}
                      className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
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

                {/* 9:16 In-Video Overlay with Viral Hook & Dynamic Subtitle Preview */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-black/60 p-3.5 flex flex-col justify-between pointer-events-none z-10">
                  {/* Top Bar Metadata */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm border border-zinc-700/80 text-xs font-mono tabular-nums text-zinc-200">
                      <span className="text-emerald-400 font-semibold">{clip.viralityScore}%</span>
                      <span className="text-zinc-500">score</span>
                    </div>

                    <div className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm border border-zinc-700/80 text-[11px] font-mono tabular-nums text-zinc-300">
                      {formatSeconds(clip.startTime)}–{formatSeconds(clip.endTime)} ({duration}s)
                    </div>
                  </div>

                  {/* Top Center: Viral Hook Sticker */}
                  <div className="p-2 rounded-lg bg-black/85 backdrop-blur-sm border border-violet-500/40 shadow-xl text-center">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-violet-400 block mb-0.5">
                      Viral Hook Line
                    </span>
                    <p className="text-xs font-medium text-white line-clamp-2">
                      "{clip.hook}"
                    </p>
                  </div>

                  {/* Bottom: Dynamic Kinetic Subtitle */}
                  <div className="text-center pb-2">
                    {activeCaption && (
                      <div
                        key={`${clip.id}-${activeCaption.start}`}
                        className="inline-block px-2.5 py-1 rounded-lg bg-black/90 backdrop-blur-sm border border-zinc-700 text-xs font-semibold text-white shadow-lg anim-entrance-pop max-w-[92%]"
                      >
                        {activeCaption.emphasisWord && (
                          <span className="text-amber-300 mr-1 font-bold">
                            {activeCaption.emphasisWord}
                          </span>
                        )}
                        <span>{activeCaption.text}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive Bottom Progress Scrubber Bar */}
                {videoSrc && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      const v = videoRefMap.current[clip.id];
                      if (!v) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      const target = isPreClipped
                        ? ratio * (v.duration || duration)
                        : clip.startTime + ratio * duration;
                      v.currentTime = target;
                      setPlayheadMap((prev) => ({ ...prev, [clip.id]: target }));
                    }}
                    className="absolute bottom-0 left-0 right-0 h-2 bg-zinc-800/80 z-30 cursor-pointer group/bar"
                    title="Click to scrub"
                  >
                    <div
                      className="h-full bg-violet-500 transition-[width] duration-75"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                )}

                {/* Center Play Button */}
                {!isPlaying && !clipError && videoSrc && (
                  <div
                    onClick={() => handleTogglePlay(clip)}
                    className="absolute inset-0 flex items-center justify-center cursor-pointer z-20 bg-black/20 hover:bg-black/10 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform">
                      <Play className="w-5 h-5 ml-0.5 fill-zinc-950" />
                    </div>
                  </div>
                )}

                {/* Active Playing Controls */}
                {isPlaying && (
                  <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1.5 pointer-events-auto">
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

              {/* Card Body & Details */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                      Clip #{index + 1} · {clip.category}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                      Hook {clip.hookScore || 94}% · Flow {clip.flowScore || 91}%
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 group-hover:text-violet-300 transition-colors line-clamp-2">
                    {clip.title}
                  </h3>

                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                    <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1 uppercase">
                      <Sparkles className="w-3 h-3 text-violet-400" />
                      <span>Why Gemini Picked This</span>
                    </div>
                    <p className="line-clamp-2">{clip.reason}</p>
                  </div>
                </div>

                {/* Primary Actions */}
                <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onSelectClipToEdit(clip)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Studio 9:16</span>
                    </button>

                    <button
                      onClick={() => handleDirectDownload(clip)}
                      disabled={downloadingClipId === clip.id}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/80 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {downloadingClipId === clip.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Clipping...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Download MP4</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Secondary Quick Utilities */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                    <button
                      onClick={() => handleOpenSocialPack(clip)}
                      className="flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors cursor-pointer font-medium"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>AI Social Copy</span>
                    </button>

                    <button
                      onClick={() => handleCopyCaption(clip)}
                      className="flex items-center gap-1 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      {copiedId === clip.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Tags</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDownloadSrt(clip)}
                      className="flex items-center gap-1 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>.SRT</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
                  <span>Gemini writing TikTok, Reels & Shorts copy...</span>
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
                    { key: 'reels', label: 'Instagram Reels Caption', val: socialPack.reelsCaption },
                    { key: 'comment', label: 'Engagement Pinned Comment', val: socialPack.pinnedComment },
                  ].map((item) => (
                    <div key={item.key} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-zinc-300">{item.label}</span>
                        <button
                          onClick={() => handleCopySocialField(item.key, item.val)}
                          className="flex items-center gap-1 text-violet-400 hover:text-violet-300 cursor-pointer"
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
