import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Smartphone,
  Eye,
  Sliders,
  Sparkles,
  MoveHorizontal,
  Maximize2,
  Minimize2,
  Layers,
} from 'lucide-react';
import { ClipHighlight, ExportSettings, FramingMode, CaptionChunk } from '../types';
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
        // Fallback: Muted playback if browser blocked unmuted autoplay
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
      className="flex flex-col items-center justify-between h-full bg-slate-900/60 rounded-2xl border border-slate-800 p-4 shadow-xl"
    >
      {/* Top Controls Toolbar */}
      <div className="w-full flex items-center justify-between gap-2 mb-3">
        {/* Framing mode buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-950/60 border border-slate-800 rounded-xl">
          {[
            { id: 'smart_crop', label: 'Smart Crop (9:16)' },
            { id: 'split_screen', label: 'Split Screen' },
            { id: 'blur_fit', label: 'Ambient Blur' },
            { id: 'clean_box', label: 'Letterbox' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => onUpdateSettings({ framingMode: mode.id as FramingMode })}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                settings.framingMode === mode.id
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Safe zone toggle & loop */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSafeZones(!showSafeZones)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              showSafeZones
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle TikTok / Instagram UI overlay safe margins"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Safe Zone</span>
          </button>
        </div>
      </div>

      {/* Center 9:16 Vertical Video Frame */}
      <div className="relative flex-1 flex items-center justify-center w-full min-h-0 py-2">
        <div className="relative h-full max-h-[560px] aspect-[9/16] rounded-[28px] overflow-hidden bg-black shadow-2xl shadow-black/90 border-4 border-slate-800 ring-1 ring-slate-700/50 flex items-center justify-center group">
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

          {/* Quick Play Overlay Button when paused */}
          {!isPlaying && (
            <div
              onClick={() => {
                if (isYouTube) {
                  setIsPlaying(true);
                } else {
                  togglePlay();
                }
              }}
              className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px] cursor-pointer z-20"
            >
              <div className="w-16 h-16 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-2xl shadow-amber-500/40 transform transition-transform hover:scale-110">
                <Play className="w-8 h-8 ml-1 fill-slate-950" />
              </div>
            </div>
          )}

          {/* Floating Hook Editor Pill on Hover */}
          <div className="absolute top-4 inset-x-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
            <div className="bg-black/80 backdrop-blur-md rounded-xl p-2 border border-slate-700 flex items-center justify-between text-xs text-white">
              <span className="truncate pr-2 font-medium">Hook: {settings.hookBannerText || activeClip.hook}</span>
              <span className="text-[10px] text-amber-400 font-bold shrink-0">9:16 TikTok Mode</span>
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal Speaker Pan Re-framer (when in Smart Crop mode) */}
      {settings.framingMode === 'smart_crop' && (
        <div className="w-full max-w-sm mt-2 px-3 py-2 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center gap-3">
          <MoveHorizontal className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-1">
              <span>Speaker Pan Re-frame</span>
              <span className="font-mono text-amber-400">
                {settings.panX > 0 ? `+${settings.panX}%` : `${settings.panX}%`}
              </span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              value={settings.panX}
              onChange={handlePanChange}
              className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
          <button
            onClick={() => onUpdateSettings({ panX: 0 })}
            className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold transition-colors cursor-pointer"
            title="Reset speaker focus to dead center"
          >
            Center
          </button>
        </div>
      )}

      {/* Bottom Playback Bar */}
      <div className="w-full flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={restartClip}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Restart Clip"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleMute}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Time display */}
          <div className="text-xs font-mono text-slate-400 pl-1">
            <span className="text-white font-bold">{formatSec(currentTimeInClip)}</span>
            <span className="text-slate-600"> / </span>
            <span>{formatSec(clipDuration)}</span>
          </div>
        </div>

        {/* Loop toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              isLooping
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
          >
            Loop {isLooping ? 'On' : 'Off'}
          </button>
        </div>
      </div>
    </div>
  );
};
