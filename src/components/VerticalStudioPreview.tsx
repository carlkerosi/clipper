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
} from 'lucide-react';
import { ClipHighlight, ExportSettings, FramingMode } from '../types';
import { drawVerticalFrame } from '../utils/captionRenderer';
import { getCssFilterString } from '../utils/videoFilters';
import { parseJsonResponse } from '../utils/safeFetchJson';

function extractYoutubeVideoId(url?: string): string {
  if (!url) return '';
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/);
  return match && match[2] && match[2].length === 11 ? match[2] : '';
}

interface VerticalStudioPreviewProps {
  videoUrl: string;
  playableSourceUrl?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  youtubeDownloadBlocked?: boolean;
  thumbnail?: string;
  activeClip: ClipHighlight;
  settings: ExportSettings;
  onUpdateSettings: (newSettings: Partial<ExportSettings>) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onTimeUpdate?: (currentTime: number) => void;
}

export const VerticalStudioPreview: React.FC<VerticalStudioPreviewProps> = ({
  videoUrl,
  playableSourceUrl,
  youtubeUrl,
  youtubeVideoId,
  thumbnail,
  activeClip,
  settings,
  onUpdateSettings,
  videoRef,
  onTimeUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeInClip, setCurrentTimeInClip] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isAutoReframing, setIsAutoReframing] = useState(false);
  const [reframeNote, setReframeNote] = useState<string | null>(null);
  const embedRelTimeRef = useRef(0);

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

  // Sync video element time to clip start time cleanly whenever clip or source switches
  useEffect(() => {
    setVideoError(null);
    embedRelTimeRef.current = 0;
    setCurrentTimeInClip(0);
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
        video.currentTime = startPos;
      } catch {}
    };

    if (video.readyState >= 1) {
      seekToStart();
    } else {
      video.addEventListener('loadedmetadata', seekToStart, { once: true });
      video.addEventListener('canplay', seekToStart, { once: true });
    }
  }, [activeClip.id, activeClip.startTime, isClipOnlyMode, isYoutubeEmbedMode, activeVideoSource]);

  // Sync video playbackRate live
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const speed = Math.max(0.75, Math.min(1.5, Number(settings.playbackSpeed) || 1));
    if (video.playbackRate !== speed) {
      video.playbackRate = speed;
    }
  }, [settings.playbackSpeed, activeVideoSource]);

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
          if (embedRelTimeRef.current >= clipDuration) {
            if (isLooping) {
              embedRelTimeRef.current = 0;
            } else {
              embedRelTimeRef.current = clipDuration;
              setIsPlaying(false);
            }
          }
        }
        relTime = embedRelTimeRef.current;
        setCurrentTimeInClip(relTime);
        if (onTimeUpdate) {
          onTimeUpdate(activeClip.startTime + relTime);
        }
      } else if (video && video.readyState >= 1) {
        if (video.playbackRate !== speed) {
          video.playbackRate = speed;
        }
        relTime = isClipOnlyMode
          ? video.currentTime
          : Math.max(0, video.currentTime - activeClip.startTime);

        setCurrentTimeInClip(relTime);
        if (onTimeUpdate) {
          onTimeUpdate(
            isClipOnlyMode
              ? activeClip.startTime + video.currentTime
              : video.currentTime
          );
        }

        const maxThreshold = isClipOnlyMode
          ? video.duration || clipDuration
          : activeClip.endTime;

        if (!video.paused && video.currentTime >= maxThreshold - 0.1) {
          if (isLooping) {
            video.currentTime = isClipOnlyMode ? 0 : activeClip.startTime;
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
      const targetPos =
        video.currentTime >= endPos - 0.2 ||
        (!isClipOnlyMode && video.currentTime < startPos)
          ? startPos
          : video.currentTime;
      await ensureLoadedAndPlay(targetPos);
    } else {
      video.pause();
      setIsPlaying(false);
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

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
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

      {/* Bottom Playback Bar */}
      <div className="w-full flex items-center justify-between gap-3 mt-2 pt-2.5 border-t border-zinc-800">
        <div className="flex items-center gap-1.5">
          <button
            onClick={togglePlay}
            className="p-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-semibold transition-colors cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </button>

          <button
            onClick={restartClip}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
            title="Restart"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleMute}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </button>

          <div className="text-xs font-mono tabular-nums text-zinc-400 pl-1.5">
            <span className="text-zinc-100 font-semibold">{formatSec(currentTimeInClip)}</span>
            <span className="text-zinc-600"> / </span>
            <span>{formatSec(clipDuration)}</span>
          </div>
        </div>

        <button
          onClick={() => setIsLooping(!isLooping)}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
            isLooping
              ? 'bg-zinc-800 text-white border-zinc-700'
              : 'bg-zinc-950 text-zinc-500 border-zinc-800'
          }`}
        >
          <Repeat className="w-3 h-3" />
          <span>Loop</span>
        </button>
      </div>
    </div>
  );
};
