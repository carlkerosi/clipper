import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Eye,
  MoveHorizontal,
  Repeat,
  Sparkles,
  Loader2,
  ArrowRightToLine,
  ArrowLeftToLine,
} from 'lucide-react';
import { ClipHighlight, ExportSettings, FramingMode } from '../types';
import { drawVerticalFrame } from '../utils/captionRenderer';
import { getCssFilterString } from '../utils/videoFilters';
import { parseJsonResponse } from '../utils/safeFetchJson';

function extractYoutubeVideoId(url?: string): string {
  if (!url) return '';
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/|watch\?v=|&v=)([^#&?]*).*/);
  return match && match[2] && match[2].length === 11 ? match[2] : '';
}

export interface TrimMarkerFeedback {
  edge: 'in' | 'out';
  time: number;
  nonce: number;
  note?: string;
}

interface VerticalStudioPreviewProps {
  videoUrl: string;
  playableSourceUrl?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  youtubeDownloadBlocked?: boolean;
  thumbnail?: string;
  totalVideoDuration?: number;
  activeClip: ClipHighlight;
  settings: ExportSettings;
  onUpdateSettings: (newSettings: Partial<ExportSettings>) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onTimeUpdate?: (currentTime: number) => void;
  onSeekSourceTime?: (time: number) => void;
  onSetInPoint?: () => void;
  onSetOutPoint?: () => void;
  trimFeedback?: TrimMarkerFeedback | null;
  playToggleNonce?: number;
}

export const VerticalStudioPreview: React.FC<VerticalStudioPreviewProps> = ({
  videoUrl,
  playableSourceUrl,
  youtubeUrl,
  youtubeVideoId,
  thumbnail,
  totalVideoDuration = 300,
  activeClip,
  settings,
  onUpdateSettings,
  videoRef,
  onTimeUpdate,
  onSeekSourceTime,
  onSetInPoint,
  onSetOutPoint,
  trimFeedback,
  playToggleNonce = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeInClip, setCurrentTimeInClip] = useState(0);
  const [sourcePlayheadSec, setSourcePlayheadSec] = useState(activeClip.startTime);
  const [isMuted, setIsMuted] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [playbackScope, setPlaybackScope] = useState<'clip' | 'full'>('clip');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isAutoReframing, setIsAutoReframing] = useState(false);
  const [reframeNote, setReframeNote] = useState<string | null>(null);
  const [visibleTrimHud, setVisibleTrimHud] = useState<TrimMarkerFeedback | null>(null);
  const embedRelTimeRef = useRef(0);
  const prevClipIdRef = useRef<string>(activeClip.id);
  const prevSourceRef = useRef<string>('');
  const lastHandledPlayNonceRef = useRef<number>(playToggleNonce);

  const directFullSource =
    playableSourceUrl ||
    (videoUrl &&
    !videoUrl.includes('youtube.com') &&
    !videoUrl.includes('youtu.be')
      ? videoUrl
      : '');

  const ytId = youtubeVideoId || extractYoutubeVideoId(youtubeUrl || videoUrl);
  const isYoutubeEmbedMode = !directFullSource && !activeClip.clipVideoUrl && Boolean(ytId);

  // If full playable source exists, use it so TimelineTrimmer, panX, and all 4 framing modes work 1:1.
  // Otherwise play the pre-clipped 9:16 MP4 segment (0..clipDuration).
  const isClipOnlyMode = !directFullSource && Boolean(activeClip.clipVideoUrl);
  const activeVideoSource = isYoutubeEmbedMode
    ? ''
    : directFullSource || activeClip.clipVideoUrl || '/samples/podcast.mp4';

  const clipDuration = Math.max(1, activeClip.endTime - activeClip.startTime);
  const effectiveTotalDuration = Math.max(
    clipDuration,
    totalVideoDuration || 0,
    activeClip.endTime,
    videoRef.current && Number.isFinite(videoRef.current.duration) && !isClipOnlyMode
      ? videoRef.current.duration
      : 0
  );

  // Show transient HUD badge inside the player viewport whenever In/Out marker is set
  useEffect(() => {
    if (!trimFeedback) return;
    setVisibleTrimHud(trimFeedback);
    const timer = window.setTimeout(() => {
      setVisibleTrimHud((cur) => (cur?.nonce === trimFeedback.nonce ? null : cur));
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [trimFeedback]);

  // Sync video element time cleanly when clip ID or video source switches (without stuttering live trims)
  useEffect(() => {
    const clipSwitched = prevClipIdRef.current !== activeClip.id;
    const sourceSwitched = prevSourceRef.current !== activeVideoSource;
    prevClipIdRef.current = activeClip.id;
    prevSourceRef.current = activeVideoSource;

    if (!clipSwitched && !sourceSwitched) {
      return;
    }

    setVideoError(null);
    embedRelTimeRef.current = 0;
    setCurrentTimeInClip(0);
    setSourcePlayheadSec(activeClip.startTime);
    if (onTimeUpdate) {
      onTimeUpdate(activeClip.startTime);
    }

    if (isYoutubeEmbedMode) {
      setIsPlaying(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    const startPos = isClipOnlyMode ? 0 : activeClip.startTime;

    const seekToStart = () => {
      try {
        if (Math.abs(video.currentTime - startPos) > 0.25) {
          video.currentTime = startPos;
        }
      } catch {}
    };

    if (video.readyState >= 1) {
      seekToStart();
    } else {
      video.addEventListener('loadedmetadata', seekToStart, { once: true });
      video.addEventListener('canplay', seekToStart, { once: true });
    }
  }, [activeClip.id, activeClip.startTime, isClipOnlyMode, isYoutubeEmbedMode, activeVideoSource, onTimeUpdate, videoRef]);

  // Sync video playbackRate live
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const speed = Math.max(0.75, Math.min(1.5, Number(settings.playbackSpeed) || 1));
    if (video.playbackRate !== speed) {
      video.playbackRate = speed;
    }
  }, [settings.playbackSpeed, activeVideoSource, videoRef]);

  // Main Canvas Rendering animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTs = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - lastTs) / 1000));
      lastTs = now;
      const speed = Math.max(0.75, Math.min(1.5, Number(settings.playbackSpeed) || 1));

      let relTime = 0;
      if (isYoutubeEmbedMode) {
        if (isPlaying) {
          embedRelTimeRef.current += dt * speed;
          if (embedRelTimeRef.current >= clipDuration && playbackScope === 'clip') {
            if (isLooping) {
              embedRelTimeRef.current = 0;
            } else {
              embedRelTimeRef.current = clipDuration;
              setIsPlaying(false);
            }
          }
        }
        relTime = embedRelTimeRef.current;
        const absSource = activeClip.startTime + relTime;
        setCurrentTimeInClip(relTime);
        setSourcePlayheadSec(absSource);
        if (onTimeUpdate) {
          onTimeUpdate(absSource);
        }
      } else if (video && video.readyState >= 1) {
        if (video.playbackRate !== speed) {
          video.playbackRate = speed;
        }
        relTime = isClipOnlyMode
          ? video.currentTime
          : video.currentTime - activeClip.startTime;

        const absSource = isClipOnlyMode
          ? activeClip.startTime + video.currentTime
          : video.currentTime;

        setCurrentTimeInClip(relTime);
        setSourcePlayheadSec(absSource);
        if (onTimeUpdate) {
          onTimeUpdate(absSource);
        }

        if (playbackScope === 'clip') {
          const maxThreshold = isClipOnlyMode
            ? video.duration || clipDuration
            : activeClip.endTime;

          if (!video.paused && video.currentTime >= maxThreshold - 0.08) {
            if (isLooping) {
              video.currentTime = isClipOnlyMode ? 0 : activeClip.startTime;
              video.play().catch(() => {});
            } else {
              video.pause();
              setIsPlaying(false);
            }
          }
        } else if (!video.paused && video.duration && video.currentTime >= video.duration - 0.08) {
          if (isLooping) {
            video.currentTime = 0;
            video.play().catch(() => {});
          } else {
            video.pause();
            setIsPlaying(false);
          }
        }
      }

      const useFullCanvasComposite = !isYoutubeEmbedMode && settings.framingMode !== 'smart_crop';

      drawVerticalFrame({
        ctx,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        videoElement: isYoutubeEmbedMode ? null : video,
        currentTimeInClip: relTime,
        clipDuration,
        captions: activeClip.captions,
        captionPreset: settings.captionPreset,
        captionHighlightStyle: settings.captionHighlightStyle,
        captionPosition: settings.captionPosition,
        captionFontSize: settings.captionFontSize,
        captionColor: settings.captionColor,
        captionBaseColor: settings.captionBaseColor,
        captionFontFamily: settings.captionFontFamily,
        captionTextCase: settings.captionTextCase,
        captionOutlineWidth: settings.captionOutlineWidth,
        captionWordsPerLine: settings.captionWordsPerLine,
        captionDropShadow: settings.captionDropShadow,
        captionEntranceAnim: settings.captionEntranceAnim,
        captionExitAnim: settings.captionExitAnim,
        framingMode: settings.framingMode,
        panX: settings.panX,
        showHookBanner: settings.showHookBanner,
        hookBannerText: settings.hookBannerText || activeClip.hook,
        showProgressBar: settings.showProgressBar,
        progressBarColor: settings.progressBarColor,
        showSafeZones,
        overlayOnly: !useFullCanvasComposite,
        videoFilterCss: getCssFilterString(settings),
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    activeClip,
    settings,
    showSafeZones,
    isLooping,
    playbackScope,
    clipDuration,
    isClipOnlyMode,
    isYoutubeEmbedMode,
    isPlaying,
    onTimeUpdate,
  ]);

  const ensureLoadedAndPlay = async (startPos: number) => {
    const video = videoRef.current;
    if (!video) return;

    if (video.readyState === 0) {
      video.load();
      await new Promise<void>((resolve) => {
        const onReady = () => {
          video.removeEventListener('canplay', onReady);
          video.removeEventListener('loadedmetadata', onReady);
          resolve();
        };
        video.addEventListener('canplay', onReady);
        video.addEventListener('loadedmetadata', onReady);
        setTimeout(resolve, 2500);
      });
    }

    video.currentTime = startPos;
    try {
      video.muted = isMuted;
      await video.play();
      setIsPlaying(true);
    } catch {
      video.muted = true;
      setIsMuted(true);
      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        setVideoError('Unable to start playback for this video stream.');
      }
    }
  };

  const togglePlay = async () => {
    if (isYoutubeEmbedMode) {
      setIsPlaying((prev) => !prev);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const startPos = isClipOnlyMode ? 0 : activeClip.startTime;
    const endPos = isClipOnlyMode
      ? video.duration || clipDuration
      : activeClip.endTime;

    if (video.paused) {
      let targetPos = video.currentTime;
      if (playbackScope === 'clip') {
        if (video.currentTime >= endPos - 0.2 || (!isClipOnlyMode && video.currentTime < startPos)) {
          targetPos = startPos;
        }
      } else if (video.duration && video.currentTime >= video.duration - 0.2) {
        targetPos = 0;
      }
      await ensureLoadedAndPlay(targetPos);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;

  useEffect(() => {
    if (playToggleNonce === lastHandledPlayNonceRef.current) return;
    lastHandledPlayNonceRef.current = playToggleNonce;
    togglePlayRef.current();
  }, [playToggleNonce]);

  const handlePlayerScrubPointer = (clientX: number) => {
    if (!scrubRef.current) return;
    const rect = scrubRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const targetTime = Math.round(ratio * effectiveTotalDuration * 10) / 10;

    if (!isClipOnlyMode && (targetTime < activeClip.startTime || targetTime > activeClip.endTime)) {
      setPlaybackScope('full');
    }

    if (isYoutubeEmbedMode) {
      embedRelTimeRef.current = targetTime - activeClip.startTime;
    }

    setSourcePlayheadSec(targetTime);
    setCurrentTimeInClip(targetTime - activeClip.startTime);

    if (onSeekSourceTime) {
      onSeekSourceTime(targetTime);
    } else if (videoRef.current) {
      try {
        videoRef.current.currentTime = isClipOnlyMode
          ? Math.max(0, targetTime - activeClip.startTime)
          : targetTime;
      } catch {}
    }
  };

  const restartClip = async () => {
    if (isYoutubeEmbedMode) {
      embedRelTimeRef.current = 0;
      setCurrentTimeInClip(0);
      setIsPlaying(true);
      return;
    }
    const startPos = isClipOnlyMode ? 0 : activeClip.startTime;
    await ensureLoadedAndPlay(startPos);
  };

  const toggleMute = () => {
    if (isYoutubeEmbedMode) {
      setIsMuted((prev) => !prev);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({ panX: Number(e.target.value) });
  };

  const handleAiAutoReframe = async () => {
    if (isYoutubeEmbedMode) {
      setReframeNote('AI Vision Reframe requires an ingested or uploaded MP4 stream.');
      return;
    }
    setIsAutoReframing(true);
    setReframeNote(null);
    try {
      const targetTs = isClipOnlyMode
        ? currentTimeInClip
        : activeClip.startTime + currentTimeInClip;
      const res = await fetch('/api/ai-reframe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: isClipOnlyMode ? activeClip.clipVideoUrl : videoUrl,
          playableSourceUrl: isClipOnlyMode ? activeClip.clipVideoUrl : playableSourceUrl,
          timestamp: targetTs,
        }),
      });
      const data = await parseJsonResponse(res, 'AI Auto-Reframe failed');
      if (!res.ok) {
        throw new Error(data.error || 'AI Auto-Reframe failed');
      }
      onUpdateSettings({
        panX: typeof data.panX === 'number' ? data.panX : 0,
        framingMode: (data.recommendedFraming as FramingMode) || settings.framingMode,
      });
      if (data.subjectDescription) {
        setReframeNote(`Centered: ${data.subjectDescription} (pan ${data.panX > 0 ? `+${data.panX}` : data.panX}%)`);
      }
    } catch (err: any) {
      setReframeNote(err.message || 'Could not auto-reframe frame.');
    } finally {
      setIsAutoReframing(false);
    }
  };

  const formatSec = (s: number, tenths = false) => {
    const safe = Math.max(0, s);
    const m = Math.floor(safe / 60);
    const sec = Math.floor(safe % 60);
    if (!tenths) {
      return `${m}:${String(sec).padStart(2, '0')}`;
    }
    const ms = Math.floor((safe % 1) * 10);
    return `${m}:${String(sec).padStart(2, '0')}.${ms}`;
  };

  const useCanvasVideoComposite = settings.framingMode !== 'smart_crop';
  const videoCssFilter = getCssFilterString(settings);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-between h-full bg-zinc-900/80 rounded-2xl border border-zinc-800 p-4 shadow-xl"
    >
      {/* Top Controls Toolbar */}
      <div className="w-full flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1 p-0.5 bg-zinc-950 rounded-lg border border-zinc-800">
          {[
            { id: 'smart_crop', label: 'Smart Crop (9:16)' },
            { id: 'split_screen', label: 'Split' },
            { id: 'blur_fit', label: 'Ambient Blur' },
            { id: 'clean_box', label: 'Letterbox' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => onUpdateSettings({ framingMode: mode.id as FramingMode })}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                settings.framingMode === mode.id
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowSafeZones(!showSafeZones)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
            showSafeZones
              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
          }`}
          title="Toggle TikTok safe zones"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">TikTok Guides</span>
        </button>
      </div>

      {/* Center 9:16 Vertical Video Frame */}
      <div className="relative flex-1 flex items-center justify-center w-full min-h-0 py-1">
        <div className="relative h-full max-h-[540px] aspect-[9/16] rounded-[28px] overflow-hidden bg-black shadow-2xl border-4 border-zinc-800 ring-1 ring-zinc-700/60 flex items-center justify-center group">
          <div className="absolute top-2 w-20 h-3.5 bg-zinc-900 rounded-full z-30 pointer-events-none opacity-80" />

          {/* Embedded YouTube 9:16 Player OR Native HTML5 Video Element */}
          {isYoutubeEmbedMode && ytId ? (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black overflow-hidden">
              {isPlaying ? (
                <iframe
                  key={`${activeClip.id}-${Math.floor(activeClip.startTime)}-${isMuted ? 'm' : 'u'}`}
                  src={`https://www.youtube.com/embed/${ytId}?start=${Math.floor(activeClip.startTime)}&end=${Math.ceil(activeClip.endTime)}&autoplay=1&rel=0&modestbranding=1&playsinline=1&mute=${isMuted ? 1 : 0}`}
                  title={activeClip.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-[320%] max-w-none border-0"
                  style={{
                    transform: `translateX(${-(settings.panX || 0) * 0.2}%)`,
                    filter: videoCssFilter,
                  }}
                />
              ) : (
                <img
                  src={thumbnail || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                  alt={activeClip.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-85 transition-[filter] duration-150"
                  style={{ filter: videoCssFilter }}
                />
              )}
            </div>
          ) : (
            <video
              ref={videoRef}
              src={activeVideoSource}
              playsInline
              preload="auto"
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={() =>
                setVideoError('Stream failed to decode. Try re-exporting or picking another moment.')
              }
              className={`absolute inset-0 w-full h-full object-cover select-none cursor-pointer transition-[filter] duration-150 ${
                useCanvasVideoComposite ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
              style={{
                objectPosition: `${Math.max(0, Math.min(100, (settings.panX + 100) / 2))}% center`,
                filter: videoCssFilter,
              }}
            />
          )}

          {/* Canvas Layer: Composite video + Animated Subtitles + Hook Banner + Progress Bar */}
          <canvas
            ref={canvasRef}
            width={720}
            height={1280}
            onClick={togglePlay}
            className={`absolute inset-0 w-full h-full object-cover z-10 ${
              useCanvasVideoComposite ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'
            }`}
          />

          {videoError && (
            <div className="absolute inset-0 z-30 bg-black/85 flex items-center justify-center p-5 text-center">
              <p className="text-xs text-rose-300">{videoError}</p>
            </div>
          )}

          {visibleTrimHud && (
            <div
              key={visibleTrimHud.nonce}
              className={`absolute top-8 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-lg border backdrop-blur-md shadow-xl flex items-center gap-2 pointer-events-none whitespace-nowrap transition-opacity duration-150 ${
                visibleTrimHud.edge === 'in'
                  ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-200'
                  : 'bg-violet-950/90 border-violet-400/60 text-violet-200'
              }`}
            >
              {visibleTrimHud.edge === 'in' ? (
                <ArrowRightToLine className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <ArrowLeftToLine className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              )}
              <span className="text-[11px] font-mono font-bold tabular-nums">
                {visibleTrimHud.edge === 'in' ? 'IN' : 'OUT'} {formatSec(visibleTrimHud.time, true)}
              </span>
              {visibleTrimHud.note && (
                <span className="text-[10px] text-zinc-300">{visibleTrimHud.note}</span>
              )}
            </div>
          )}

          {!isPlaying && !videoError && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] cursor-pointer z-20"
            >
              <div className="w-14 h-14 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform">
                <Play className="w-6 h-6 ml-0.5 fill-zinc-950" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Speaker Pan Re-framer + AI Vision Auto-Reframe */}
      {settings.framingMode === 'smart_crop' && (
        <div className="w-full max-w-sm mt-2 space-y-1">
          <div className="px-3 py-1.5 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center gap-2.5">
            <MoveHorizontal className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium mb-0.5">
                <span>Speaker Pan</span>
                <span className="font-mono tabular-nums text-zinc-300">
                  {settings.panX > 0 ? `+${settings.panX}%` : `${settings.panX}%`}
                </span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                value={settings.panX}
                onChange={handlePanChange}
                className="w-full accent-violet-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>
            <button
              onClick={handleAiAutoReframe}
              disabled={isAutoReframing || isYoutubeEmbedMode}
              title={
                isYoutubeEmbedMode
                  ? 'Upload or ingest direct video for Vision auto-reframe'
                  : 'Center speaker using Gemini Vision'
              }
              className="text-[10px] px-2 py-1 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 rounded font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isAutoReframing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              <span>{isAutoReframing ? 'Framing' : 'AI Frame'}</span>
            </button>
            <button
              onClick={() => {
                onUpdateSettings({ panX: 0 });
                setReframeNote(null);
              }}
              className="text-[10px] px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-medium transition-colors cursor-pointer shrink-0"
            >
              Reset
            </button>
          </div>
          {reframeNote && (
            <p className="text-[10px] text-violet-300/90 text-center line-clamp-1 px-2">
              {reframeNote}
            </p>
          )}
        </div>
      )}

      {/* Player Interactive Source Scrub Bar + In/Out Markers */}
      <div className="w-full mt-2 space-y-1.5">
        <div
          ref={scrubRef}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handlePlayerScrubPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) {
              handlePlayerScrubPointer(e.clientX);
            }
          }}
          className="relative h-3 w-full rounded-full bg-zinc-950 border border-zinc-800 cursor-pointer select-none overflow-hidden group"
          title="Scrub video timeline — click outside clip bounds to preview full source"
        >
          {/* Active Clip Window */}
          <div
            className="absolute top-0 bottom-0 bg-violet-500/35 border-x-2 border-emerald-400"
            style={{
              left: `${Math.max(0, Math.min(100, (activeClip.startTime / effectiveTotalDuration) * 100))}%`,
              width: `${Math.max(
                1.5,
                Math.min(
                  100,
                  ((activeClip.endTime - activeClip.startTime) / effectiveTotalDuration) * 100
                )
              )}%`,
              borderLeftColor: '#34D399',
              borderRightColor: '#A78BFA',
            }}
          />
          {/* Playhead Position */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] pointer-events-none"
            style={{
              left: `${Math.max(0, Math.min(100, (sourcePlayheadSec / effectiveTotalDuration) * 100))}%`,
            }}
          />
        </div>

        {/* Bottom Playback & Direct Trim Marker Bar */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-zinc-800">
          <div className="flex items-center gap-1.5">
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-semibold transition-colors cursor-pointer shrink-0"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>

            <button
              onClick={restartClip}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer shrink-0"
              title="Jump to Clip Start ([)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={toggleMute}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer shrink-0"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>

            <div className="text-xs font-mono tabular-nums text-zinc-400 pl-1 whitespace-nowrap">
              <span className="text-zinc-100 font-semibold">{formatSec(sourcePlayheadSec, true)}</span>
              <span className="text-zinc-600"> · </span>
              <span className="text-violet-300">{formatSec(clipDuration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onSetInPoint && (
              <button
                type="button"
                onClick={onSetInPoint}
                title="Set Start (In) trim marker at current playhead (Ctrl+[)"
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <ArrowRightToLine className="w-3 h-3" />
                <span>In</span>
                <kbd className="hidden xl:inline text-[9px] font-mono text-emerald-200/80 bg-emerald-950/80 px-1 rounded">
                  Ctrl+[
                </kbd>
              </button>
            )}

            {onSetOutPoint && (
              <button
                type="button"
                onClick={onSetOutPoint}
                title="Set End (Out) trim marker at current playhead (Ctrl+])"
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/35 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <ArrowLeftToLine className="w-3 h-3" />
                <span>Out</span>
                <kbd className="hidden xl:inline text-[9px] font-mono text-violet-200/80 bg-violet-950/80 px-1 rounded">
                  Ctrl+]
                </kbd>
              </button>
            )}

            <button
              type="button"
              onClick={() => setPlaybackScope((prev) => (prev === 'clip' ? 'full' : 'clip'))}
              title={
                playbackScope === 'clip'
                  ? 'Currently locked to clip bounds — switch to Full Source to scrub/play beyond clip boundaries'
                  : 'Currently playing Full Source freely — switch to Clip Loop to preview only the trimmed range'
              }
              className={`px-2 py-1 text-[11px] font-medium rounded-md border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                playbackScope === 'full'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {playbackScope === 'full' ? 'Full Source' : 'Clip Bounds'}
            </button>

            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isLooping
                  ? 'bg-zinc-800 text-white border-zinc-700'
                  : 'bg-zinc-950 text-zinc-500 border-zinc-800'
              }`}
            >
              <Repeat className="w-3 h-3" />
              <span className="hidden sm:inline">Loop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
