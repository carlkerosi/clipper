import React, { useState, useRef, useEffect } from 'react';
import {
  Flame,
  Play,
  Pause,
  Download,
  Sliders,
  Copy,
  Check,
  Share2,
  FileText,
  Sparkles,
  Smile,
  Zap,
  BookOpen,
  Swords,
  Clock,
  CheckCircle2,
  TrendingUp,
  Tag,
  Volume2,
  VolumeX,
  Loader2,
  RotateCcw,
  ExternalLink,
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
      // Pause current
      if (!isYouTube) {
        const currentVid = videoRefMap.current[clip.id];
        if (currentVid) {
          currentVid.pause();
        }
      }
      setPlayingClipId(null);
    } else {
      // Pause any previous HTML5 video
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
        // Fallback to in-browser export modal
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
    const text = `${clip.title}\n\n"${clip.hook}"\n\n${clip.hashtags.join(' ')} #fyp #viral #trending #shorts`;
    navigator.clipboard.writeText(text);
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadSrt = (clip: ClipHighlight) => {
    const srt = generateSrtFile(clip.captions);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${clip.id}_captions.srt`);
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'funny':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
            <Smile className="w-3 h-3" />
            <span>Funny & Roast</span>
          </span>
        );
      case 'highlight':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">
            <Zap className="w-3 h-3" />
            <span>Viral Peak Climax</span>
          </span>
        );
      case 'educational':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
            <BookOpen className="w-3 h-3" />
            <span>Mind-Blowing Insight</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
            <Swords className="w-3 h-3" />
            <span>Debate & Hot Take</span>
          </span>
        );
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = Math.floor(sec % 60);
    return `${mins}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Generation Complete</span>
            </span>
            <span className="text-xs text-slate-400">· {highlights.length} Short Clips Created</span>
            {isYouTube && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 font-bold">
                YouTube Source
              </span>
            )}
          </div>
          <h2 className="text-base sm:text-lg font-black text-white line-clamp-1">
            {videoSource.title}
          </h2>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {topClip && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Top Virality Score: {topClip.viralityScore}/100</span>
            </div>
          )}

          <button
            onClick={onNewVideo}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
          >
            + Clip Another Video
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'all', label: `All Clips (${highlights.length})` },
          {
            id: 'funny',
            label: `😂 Funny (${highlights.filter((c) => c.category === 'funny').length})`,
          },
          {
            id: 'highlight',
            label: `⚡ Climax (${highlights.filter((c) => c.category === 'highlight').length})`,
          },
          {
            id: 'educational',
            label: `🧠 Insights (${highlights.filter((c) => c.category === 'educational').length})`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCategory === tab.id
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Clips Grid / Cards List with Real Playable Video Players */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((clip, index) => {
          const duration = Math.max(1, Math.round(clip.endTime - clip.startTime));
          const isPlaying = playingClipId === clip.id;
          const relSec = Math.max(0, clipPlayhead - clip.startTime);

          // Find current active caption chunk during playback
          const activeCaption =
            clip.captions.find((c) => relSec >= c.start && relSec <= c.end) ||
            clip.captions[0];

          return (
            <div
              key={clip.id}
              className="group relative rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/60 shadow-xl overflow-hidden flex flex-col justify-between transition-all duration-200 hover:shadow-2xl hover:shadow-black"
            >
              {/* Card Media: Live Playable 9:16 Video Player */}
              <div className="relative aspect-[9/13] bg-slate-950 overflow-hidden flex items-center justify-center select-none">
                {/* 1. YouTube Player Mode */}
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
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-95 transition-opacity"
                      />
                      {/* Dark gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-black/70" />
                    </div>
                  )
                ) : (
                  /* 2. Direct HTML5 Video Player Mode (for samples & local uploads) */
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
                        isPlaying ? 'opacity-100' : 'opacity-75 group-hover:opacity-90'
                      }`}
                    />
                  </div>
                )}

                {/* Vertical 9:16 Overlay with burned dynamic captions & hook banner */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/60 p-4 flex flex-col justify-between pointer-events-none z-10">
                  {/* Top Bar: Virality Score Badge & Duration */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/85 backdrop-blur-md border border-amber-500/60 text-amber-400 text-xs font-black shadow-lg">
                      <Flame className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{clip.viralityScore}</span>
                      <span className="text-[10px] text-slate-400 font-normal">/100</span>
                    </div>

                    <div className="px-2.5 py-1 rounded-xl bg-black/85 backdrop-blur-md border border-slate-700 text-[10px] font-mono text-slate-200">
                      {formatSeconds(clip.startTime)} - {formatSeconds(clip.endTime)} ({duration}s)
                    </div>
                  </div>

                  {/* Top Center: Hook Banner Sticker */}
                  <div className="p-2.5 rounded-xl bg-black/90 border border-amber-500/80 shadow-2xl text-center">
                    <div className="text-[9px] text-amber-400 font-black uppercase tracking-wider mb-0.5">
                      3-Sec Hook Sticker
                    </div>
                    <div className="text-xs font-black text-white line-clamp-2">
                      "{clip.hook}"
                    </div>
                  </div>

                  {/* Bottom: Animated Bouncing Caption Pill */}
                  <div className="text-center pb-2">
                    {activeCaption ? (
                      <div
                        key={`${clip.id}-${activeCaption.start}`}
                        className="inline-block px-3 py-1.5 rounded-xl bg-black/90 backdrop-blur-md border border-amber-500/40 text-xs font-black text-white shadow-xl tracking-wide max-w-[90%] anim-entrance-pop"
                      >
                        {activeCaption.emphasisWord && (
                          <span className="text-amber-400 font-black mr-1 animate-pulse">
                            {activeCaption.emphasisWord.toUpperCase()}
                          </span>
                        )}
                        <span>{activeCaption.text}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Big Center Play / Pause Icon Button when paused or hovered */}
                {!isPlaying && (
                  <div
                    onClick={() => handleTogglePlay(clip)}
                    className="absolute inset-0 flex items-center justify-center cursor-pointer z-20 bg-black/25 hover:bg-black/10 transition-colors"
                  >
                    <div className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl shadow-amber-500/50 transform hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 ml-1 fill-slate-950" />
                    </div>
                  </div>
                )}

                {/* Corner Controls (Mute / Stop) when playing */}
                {isPlaying && (
                  <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2 pointer-events-auto">
                    <button
                      onClick={() => handleTogglePlay(clip)}
                      className="p-2 rounded-lg bg-black/80 hover:bg-black text-white border border-slate-700 shadow-md cursor-pointer"
                      title="Pause Video"
                    >
                      <Pause className="w-4 h-4 fill-white" />
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
                        className="p-2 rounded-lg bg-black/80 hover:bg-black text-white border border-slate-700 shadow-md cursor-pointer"
                        title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                      >
                        {isMuted ? (
                          <VolumeX className="w-4 h-4 text-rose-400" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-emerald-400" />
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Card Body & Details */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    {getCategoryBadge(clip.category)}
                    <span className="text-[10px] text-slate-400 font-bold">
                      Clip #{index + 1}
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-black text-slate-100 group-hover:text-amber-300 transition-colors line-clamp-2">
                    {clip.title}
                  </h3>

                  {/* Why it will go viral breakdown */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                    <div className="font-bold text-slate-300 flex items-center gap-1 text-[10px] uppercase tracking-wide">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Why This Will Go Viral</span>
                    </div>
                    <p className="line-clamp-2">{clip.reason}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleDirectDownload(clip)}
                      disabled={downloadingClipId === clip.id}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
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

                    <button
                      onClick={() => onSelectClipToEdit(clip)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      <span>Studio Edit</span>
                    </button>
                  </div>

                  {/* Utility bar: Copy description & Download .srt */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <button
                      onClick={() => handleCopyCaption(clip)}
                      className="flex items-center gap-1 hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      {copiedId === clip.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Hook & Hashtags</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDownloadSrt(clip)}
                      className="flex items-center gap-1 hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>.SRT Subtitles</span>
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
