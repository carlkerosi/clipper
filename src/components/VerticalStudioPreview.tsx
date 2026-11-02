import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Eye,
  MoveHorizontal,
  Maximize2,
  Repeat,
} from 'lucide-react';
import { ClipHighlight, ExportSettings, FramingMode } from '../types';
import { drawVerticalFrame } from '../utils/captionRenderer';

interface VerticalStudioPreviewProps {
  videoUrl: string;
  youtubeUrl?: string;
  thumbnail?: string;
  activeClip: ClipHighlight;
  settings: ExportSettings;
  onUpdateSettings: (newSettings: Partial<ExportSettings>) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onTimeUpdate?: (currentTime: number) => void;
}

function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return match && match[2].length === 11 ? match[2] : null;
}

export const VerticalStudioPreview: React.FC<VerticalStudioPreviewProps> = ({
  videoUrl,
  youtubeUrl,
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

  const ytId = extractYouTubeId(youtubeUrl || videoUrl);
  const isYouTube = Boolean(ytId);

  const clipDuration = Math.max(1, activeClip.endTime - activeClip.startTime);

  // Sync video element time to clip start time reliably
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const seekToStart = () => {
      video.currentTime = activeClip.startTime;
      setCurrentTimeInClip(0);
    };

    if (video.readyState >= 1) {
      seekToStart();
    } else {
      video.addEventListener('loadedmetadata', seekToStart, { once: true });
      video.addEventListener('canplay', seekToStart, { once: true });
    }
  }, [activeClip.id, activeClip.startTime]);

  // Main Canvas Rendering animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      let relTime = 0;
      if (video) {
        relTime = Math.max(0, video.currentTime - activeClip.startTime);
        setCurrentTimeInClip(relTime);
        if (onTimeUpdate) {
          onTimeUpdate(video.currentTime);
        }

        // Loop clip if enabled
        if (video.currentTime >= activeClip.endTime) {
          if (isLooping) {
            video.currentTime = activeClip.startTime;
            video.play().catch(() => {});
          } else {
            video.pause();
            setIsPlaying(false);
          }
        }
      }

      drawVerticalFrame({
        ctx,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        videoElement: video,
        currentTimeInClip: relTime,
        clipDuration,
        captions: activeClip.captions,
        captionPreset: settings.captionPreset,
        captionPosition: settings.captionPosition,
        captionFontSize: settings.captionFontSize,
        captionColor: settings.captionColor,
        captionEntranceAnim: settings.captionEntranceAnim,
        captionExitAnim: settings.captionExitAnim,
        framingMode: settings.framingMode,
        panX: settings.panX,
        showHookBanner: settings.showHookBanner,
        hookBannerText: settings.hookBannerText || activeClip.hook,
        showProgressBar: settings.showProgressBar,
        progressBarColor: settings.progressBarColor,
        showSafeZones,
        overlayOnly: true,
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
    onTimeUpdate,
  ]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      if (video.currentTime >= activeClip.endTime || video.currentTime < activeClip.startTime) {
        video.currentTime = activeClip.startTime;
      }
      try {
        await video.play();
        setIsPlaying(true);
      } catch (err) {
        video.muted = true;
        setIsMuted(true);
        try {
          await video.play();
          setIsPlaying(true);
        } catch (err2) {
          console.error('Play error', err2);
        }
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const restartClip = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = activeClip.startTime;
    try {
      await video.play();
      setIsPlaying(true);
    } catch {
      video.muted = true;
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({ panX: Number(e.target.value) });
  };

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-between h-full bg-zinc-900/80 rounded-2xl border border-zinc-800 p-4 shadow-xl"
    >
      {/* Top Controls Toolbar */}
      <div className="w-full flex items-center justify-between gap-2 mb-2">
        {/* Framing mode buttons */}
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

        {/* Safe zone toggle */}
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

      {/* Center 9:16 Vertical Video Frame (Studio Phone Mockup) */}
      <div className="relative flex-1 flex items-center justify-center w-full min-h-0 py-1">
        <div className="relative h-full max-h-[540px] aspect-[9/16] rounded-[28px] overflow-hidden bg-black shadow-2xl border-4 border-zinc-800 ring-1 ring-zinc-700/60 flex items-center justify-center group">
          {/* Subtle phone notch */}
          <div className="absolute top-2 w-20 h-3.5 bg-zinc-900 rounded-full z-30 pointer-events-none opacity-80" />

          {/* Video or YouTube Layer */}
          {isYouTube && ytId ? (
            isPlaying ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${Math.floor(activeClip.startTime)}&end=${Math.ceil(activeClip.endTime)}&autoplay=1&mute=${isMuted ? 1 : 0}&controls=1&modestbranding=1&loop=1&playlist=${ytId}&enablejsapi=1`}
                title={activeClip.title}
                className="absolute inset-0 w-full h-full object-cover"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div
                onClick={() => setIsPlaying(true)}
                className="absolute inset-0 w-full h-full cursor-pointer flex items-center justify-center bg-black"
              >
                <img
                  src={thumbnail || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                  alt={activeClip.title}
                  className="w-full h-full object-cover opacity-85"
                />
              </div>
            )
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              playsInline
              preload="auto"
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="absolute inset-0 w-full h-full object-cover select-none cursor-pointer"
              style={{
                objectPosition: `${Math.max(0, Math.min(100, (settings.panX + 100) / 2))}% center`,
              }}
            />
          )}

          {/* Canvas Overlay for Animated Subtitles, Hook Banner & Progress Bar */}
          <canvas
            ref={canvasRef}
            width={720}
            height={1280}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
          />

          {/* Center Play Button Overlay */}
          {!isPlaying && (
            <div
              onClick={() => {
                if (isYouTube) {
                  setIsPlaying(true);
                } else {
                  togglePlay();
                }
              }}
              className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] cursor-pointer z-20"
            >
              <div className="w-14 h-14 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform">
                <Play className="w-6 h-6 ml-0.5 fill-zinc-950" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Speaker Pan Re-framer (when in Smart Crop mode) */}
      {settings.framingMode === 'smart_crop' && (
        <div className="w-full max-w-sm mt-2 px-3 py-1.5 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center gap-2.5">
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
            onClick={() => onUpdateSettings({ panX: 0 })}
            className="text-[10px] px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-medium transition-colors cursor-pointer"
          >
            Reset
          </button>
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
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-zinc-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          <div className="text-xs font-mono tabular-nums text-zinc-400 pl-1.5">
            <span className="text-zinc-100 font-semibold">{formatSec(currentTimeInClip)}</span>
            <span className="text-zinc-600"> / </span>
            <span>{formatSec(clipDuration)}</span>
          </div>
        </div>

        {/* Loop toggle */}
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
