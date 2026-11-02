import React, { useState, useRef } from 'react';
import {
  Flame,
  Play,
  Pause,
  Download,
  Sliders,
  Copy,
  Check,
  FileText,
  Sparkles,
  Smile,
  Zap,
  BookOpen,
  Swords,
  Clock,
  TrendingUp,
  Volume2,
  VolumeX,
  Loader2,
  ChevronRight,
  Share2,
} from 'lucide-react';
import { ClipHighlight, VideoSource } from '../types';
import { generateSrtFile, downloadBlob } from '../utils/exportVideo';

interface OpusClipFeedProps {
  videoSource: VideoSource;
  highlights: ClipHighlight[];
  onSelectClipToEdit: (clip: ClipHighlight) => void;
  onOpenExportModal: (clip: ClipHighlight) => void;
  onNewVideo: () => void;
}

function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return match && match[2].length === 11 ? match[2] : null;
}

export const OpusClipFeed: React.FC<OpusClipFeedProps> = ({
  videoSource,
  highlights,
  onSelectClipToEdit,
  onOpenExportModal,
  onNewVideo,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [clipPlayhead, setClipPlayhead] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [downloadingClipId, setDownloadingClipId] = useState<string | null>(null);

  const videoRefMap = useRef<Record<string, HTMLVideoElement | null>>({});

  const ytId = extractYouTubeId(videoSource.youtubeUrl || videoSource.videoUrl);
  const isYouTube = videoSource.sourceType === 'youtube' || Boolean(ytId);

  const filtered = highlights.filter((c) => {
    if (selectedCategory === 'all') return true;
    return c.category === selectedCategory;
  });

  const topClip = highlights.reduce(
    (max, c) => (c.viralityScore > (max?.viralityScore || 0) ? c : max),
    highlights[0]
  );

  const handleTogglePlay = async (clip: ClipHighlight) => {
    if (playingClipId === clip.id) {
      if (!isYouTube) {
        const currentVid = videoRefMap.current[clip.id];
        if (currentVid) {
          currentVid.pause();
        }
      }
      setPlayingClipId(null);
    } else {
      if (!isYouTube && playingClipId && videoRefMap.current[playingClipId]) {
        videoRefMap.current[playingClipId]?.pause();
      }

      setPlayingClipId(clip.id);
      setClipPlayhead(clip.startTime);

      if (!isYouTube) {
        setTimeout(async () => {
          const vid = videoRefMap.current[clip.id];
          if (vid) {
            try {
              vid.currentTime = clip.startTime;
              await vid.play();
            } catch {
              vid.muted = true;
              setIsMuted(true);
              vid.play().catch(() => {});
            }
          }
        }, 50);
      }
    }
  };

  const handleDirectDownload = async (clip: ClipHighlight) => {
    setDownloadingClipId(clip.id);
    const clipDur = Math.max(5, Math.round(clip.endTime - clip.startTime));
    try {
      const res = await fetch('/api/clip-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoSource.videoUrl,
          youtubeUrl: videoSource.youtubeUrl,
          startTime: clip.startTime,
          duration: clipDur,
          resolution: '1080p',
          title: clip.title,
        }),
      });

      if (!res.ok) {
        throw new Error('Server clip render failed');
      }

      const data = await res.json();
      if (data.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.filename || `clipforge_${clip.id}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        onOpenExportModal(clip);
      }
    } catch (err) {
      console.warn('Direct clip fallback to export modal:', err);
      onOpenExportModal(clip);
    } finally {
      setDownloadingClipId(null);
    }
  };

  const handleCopyCaption = (clip: ClipHighlight) => {
    const text = `${clip.title}\n\n"${clip.hook}"\n\n${clip.hashtags.join(' ')} #shorts #viral #reels #tiktok`;
    navigator.clipboard.writeText(text);
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(null), 2000);
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
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Analysis Ready
            </span>
            <span>·</span>
            <span>{highlights.length} short clips extracted</span>
            <span>·</span>
            <span>Source: {formatSeconds(videoSource.duration)}</span>
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-zinc-100 truncate max-w-xl">
            {videoSource.title}
          </h2>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {topClip && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-zinc-400">Peak Virality:</span>
              <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                {topClip.viralityScore}/100
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
          {[
            { id: 'all', label: `All Moments (${highlights.length})` },
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
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === tab.id
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-zinc-500 hidden sm:inline font-mono">
          9:16 Vertical Export Ready
        </span>
      </div>

      {/* Grid of Clips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((clip, index) => {
          const duration = Math.max(1, Math.round(clip.endTime - clip.startTime));
          const isPlaying = playingClipId === clip.id;
          const relSec = Math.max(0, clipPlayhead - clip.startTime);

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
                {isYouTube && ytId ? (
                  isPlaying ? (
                    <div className="w-full h-full relative bg-black flex items-center justify-center">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${Math.floor(clip.startTime)}&end=${Math.ceil(clip.endTime)}&autoplay=1&mute=${isMuted ? 1 : 0}&controls=1&modestbranding=1&loop=1&playlist=${ytId}&enablejsapi=1`}
                        title={clip.title}
                        className="w-full h-full object-cover"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => handleTogglePlay(clip)}
                      className="relative w-full h-full cursor-pointer flex items-center justify-center"
                    >
                      <img
                        src={videoSource.thumbnail || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                        alt={clip.title}
                        className="w-full h-full object-cover opacity-85 group-hover:opacity-95 transition-opacity"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-black/60" />
                    </div>
                  )
                ) : (
                  <div
                    onClick={() => handleTogglePlay(clip)}
                    className="relative w-full h-full cursor-pointer flex items-center justify-center"
                  >
                    <video
                      ref={(el) => {
                        videoRefMap.current[clip.id] = el;
                      }}
                      src={videoSource.videoUrl}
                      playsInline
                      preload="metadata"
                      onTimeUpdate={(e) => {
                        const v = e.currentTarget;
                        setClipPlayhead(v.currentTime);
                        if (v.currentTime >= clip.endTime) {
                          v.currentTime = clip.startTime;
                          v.play().catch(() => {});
                        }
                      }}
                      className={`w-full h-full object-cover transition-opacity duration-300 ${
                        isPlaying ? 'opacity-100' : 'opacity-85 group-hover:opacity-95'
                      }`}
                    />
                  </div>
                )}

                {/* 9:16 In-Video Overlay with Viral Hook and Dynamic Subtitle Preview */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-black/60 p-3.5 flex flex-col justify-between pointer-events-none z-10">
                  {/* Top Bar Metadata */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm border border-zinc-700/80 text-xs font-mono tabular-nums text-zinc-200">
                      <span className="text-emerald-400 font-semibold">{clip.viralityScore}</span>
                      <span className="text-zinc-500">virality</span>
                    </div>

                    <div className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm border border-zinc-700/80 text-[11px] font-mono tabular-nums text-zinc-300">
                      {formatSeconds(clip.startTime)} - {formatSeconds(clip.endTime)} ({duration}s)
                    </div>
                  </div>

                  {/* Top Center: Viral Hook Sticker */}
                  <div className="p-2 rounded-lg bg-black/85 backdrop-blur-sm border border-violet-500/40 shadow-xl text-center">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-violet-400 block mb-0.5">
                      3-Second Viral Hook
                    </span>
                    <p className="text-xs font-medium text-white line-clamp-2">
                      "{clip.hook}"
                    </p>
                  </div>

                  {/* Bottom: Dynamic Kinetic Subtitle */}
                  <div className="text-center pb-1">
                    {activeCaption && (
                      <div
                        key={`${clip.id}-${activeCaption.start}`}
                        className="inline-block px-2.5 py-1 rounded-lg bg-black/90 backdrop-blur-sm border border-zinc-700 text-xs font-semibold text-white shadow-lg anim-entrance-pop max-w-[90%]"
                      >
                        {activeCaption.emphasisWord && (
                          <span className="text-violet-400 mr-1">
                            {activeCaption.emphasisWord}
                          </span>
                        )}
                        <span>{activeCaption.text}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Center Play Button */}
                {!isPlaying && (
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
                    {!isYouTube && (
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
                    )}
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
                    <span className="text-[11px] font-mono text-emerald-400 tabular-nums font-semibold">
                      {clip.viralityScore}% Retention Score
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 group-hover:text-violet-300 transition-colors line-clamp-2">
                    {clip.title}
                  </h3>

                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                    <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1 uppercase">
                      <Sparkles className="w-3 h-3 text-violet-400" />
                      <span>Virality Rationale</span>
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
                          <span>Download</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Secondary Quick Utilities */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
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
                          <span>Copy Hook & #Tags</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDownloadSrt(clip)}
                      className="flex items-center gap-1 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Download .SRT</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
