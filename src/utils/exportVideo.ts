import {
  CaptionChunk,
  CaptionPreset,
  CaptionHighlightStyle,
  CaptionFontFamily,
  CaptionTextCase,
  FramingMode,
  CaptionEntranceAnimation,
  CaptionExitAnimation,
} from '../types';
import { drawVerticalFrame } from './captionRenderer';

export interface VideoExportOptions {
  videoElement: HTMLVideoElement;
  startTime: number;
  endTime: number;
  resolution: '1080p' | '720p';
  framerate: 30 | 60;
  framingMode: FramingMode;
  panX: number;
  captionPreset: CaptionPreset;
  captionHighlightStyle?: CaptionHighlightStyle;
  captionPosition: 'top' | 'middle' | 'lower_third' | 'bottom';
  captionFontSize: number;
  captionColor: string;
  captionBaseColor?: string;
  captionFontFamily?: CaptionFontFamily;
  captionTextCase?: CaptionTextCase;
  captionOutlineWidth?: number;
  captionWordsPerLine?: 'single_line' | 'multi_line';
  captionDropShadow?: boolean;
  captionEntranceAnim?: CaptionEntranceAnimation;
  captionExitAnim?: CaptionExitAnimation;
  captions: CaptionChunk[];
  showHookBanner: boolean;
  hookBannerText: string;
  showProgressBar: boolean;
  progressBarColor: string;
  videoFilterCss?: string;
  playbackSpeed?: number;
  onProgress: (progress: number, statusText: string) => void;
}

export async function exportVerticalVideo(options: VideoExportOptions): Promise<Blob> {
  const {
    videoElement,
    startTime,
    endTime,
    resolution,
    framerate,
    framingMode,
    panX,
    captionPreset,
    captionHighlightStyle,
    captionPosition,
    captionFontSize,
    captionColor,
    captionBaseColor,
    captionFontFamily,
    captionTextCase,
    captionOutlineWidth,
    captionWordsPerLine,
    captionDropShadow,
    captionEntranceAnim,
    captionExitAnim,
    captions,
    showHookBanner,
    hookBannerText,
    showProgressBar,
    progressBarColor,
    videoFilterCss = 'none',
    playbackSpeed = 1,
    onProgress,
  } = options;

  if (!videoElement || (!videoElement.src && !videoElement.currentSrc)) {
    throw new Error('No playable video source available for Studio Canvas export.');
  }
  if (videoElement.error) {
    throw new Error('Source video failed to decode in browser.');
  }

  // Ensure metadata & first frame are ready before seeking or capturing stream
  if (videoElement.readyState < 2) {
    await new Promise<void>((res, rej) => {
      let settled = false;
      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        videoElement.removeEventListener('canplay', onReady);
        videoElement.removeEventListener('loadeddata', onReady);
        videoElement.removeEventListener('error', onErr);
        if (err) rej(err);
        else res();
      };
      const onReady = () => done();
      const onErr = () => done(new Error('Source video could not load in browser for export.'));
      const timer = setTimeout(() => {
        if (videoElement.readyState >= 1) {
          done();
        } else {
          done(new Error('Timed out waiting for video stream to buffer before export.'));
        }
      }, 10000);
      videoElement.addEventListener('canplay', onReady);
      videoElement.addEventListener('loadeddata', onReady);
      videoElement.addEventListener('error', onErr);
      try {
        videoElement.load();
      } catch {}
    });
  }

  const safeStart = Math.max(0, Number(startTime) || 0);
  const effectiveDuration =
    Number.isFinite(videoElement.duration) && videoElement.duration > 0
      ? Math.min(Math.max(1, endTime - safeStart), Math.max(1, videoElement.duration - safeStart))
      : Math.max(1, endTime - safeStart);
  const safeEnd = safeStart + effectiveDuration;

  const width = resolution === '1080p' ? 1080 : 720;
  const height = resolution === '1080p' ? 1920 : 1280;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create 2D canvas context for rendering.');
  }

  const scaledFontSize = resolution === '1080p' ? captionFontSize * 1.5 : captionFontSize;

  // Draw initial frame before starting MediaRecorder so stream has valid dimensions immediately
  drawVerticalFrame({
    ctx,
    canvasWidth: width,
    canvasHeight: height,
    videoElement,
    currentTimeInClip: 0,
    clipDuration: effectiveDuration,
    captions,
    captionPreset,
    captionHighlightStyle,
    captionPosition,
    captionFontSize: scaledFontSize,
    captionColor,
    captionBaseColor,
    captionFontFamily,
    captionTextCase,
    captionOutlineWidth,
    captionWordsPerLine,
    captionDropShadow,
    captionEntranceAnim,
    captionExitAnim,
    framingMode,
    panX,
    showHookBanner,
    hookBannerText,
    showProgressBar,
    progressBarColor,
    showSafeZones: false,
    overlayOnly: false,
    videoFilterCss,
  });

  const canvasStream = canvas.captureStream(framerate);
  let audioStream: MediaStream | null = null;
  let combinedStream: MediaStream = canvasStream;
  try {
    audioStream = (videoElement as any).captureStream
      ? (videoElement as any).captureStream()
      : (videoElement as any).mozCaptureStream
      ? (videoElement as any).mozCaptureStream()
      : null;

    if (audioStream) {
      const audioTracks = audioStream.getAudioTracks();
      if (audioTracks.length > 0) {
        combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          audioTracks[0],
        ]);
      }
    }
  } catch (err) {
    console.warn('Audio capture stream fallback to video tracks only', err);
  }

  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  let selectedMimeType = '';
  for (const mime of mimeTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      selectedMimeType = mime;
      break;
    }
  }

  if (typeof MediaRecorder === 'undefined') {
    canvasStream.getTracks().forEach((t) => t.stop());
    throw new Error('MediaRecorder is not supported in this browser. Use Quick Export instead.');
  }

  const recordedChunks: Blob[] = [];
  const recorder = new MediaRecorder(combinedStream, {
    mimeType: selectedMimeType || undefined,
    videoBitsPerSecond: resolution === '1080p' ? 8_000_000 : 4_000_000,
  });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  return new Promise(async (resolve, reject) => {
    let isExporting = true;
    let rafId = 0;
    let checkInterval: ReturnType<typeof setInterval> | null = null;
    let maxWallTimer: ReturnType<typeof setTimeout> | null = null;
    const prevRate = videoElement.playbackRate;

    const cleanup = () => {
      isExporting = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (checkInterval) clearInterval(checkInterval);
      if (maxWallTimer) clearTimeout(maxWallTimer);
      try {
        videoElement.pause();
        videoElement.playbackRate = prevRate || 1;
      } catch {}
      canvasStream.getTracks().forEach((t) => t.stop());
      if (audioStream) {
        audioStream.getTracks().forEach((t) => t.stop());
      }
    };

    recorder.onerror = (err: any) => {
      cleanup();
      reject(new Error(err?.error?.message || 'Browser video recorder error during Studio export.'));
    };

    recorder.onstop = () => {
      cleanup();
      const blob = new Blob(recordedChunks, { type: selectedMimeType || 'video/webm' });
      if (blob.size < 500) {
        reject(new Error('Studio Canvas export produced an empty recording. Use Quick Export instead.'));
      } else {
        resolve(blob);
      }
    };

    try {
      const safeSpeed = Math.max(0.75, Math.min(1.5, Number(playbackSpeed) || 1));
      videoElement.playbackRate = safeSpeed;
      videoElement.muted = false;

      // Never deadlock on 'seeked' if currentTime is already at safeStart or seek finishes fast
      if (Math.abs(videoElement.currentTime - safeStart) >= 0.08) {
        await new Promise<void>((res) => {
          let settled = false;
          const finishSeek = () => {
            if (settled) return;
            settled = true;
            clearTimeout(seekTimer);
            videoElement.removeEventListener('seeked', finishSeek);
            res();
          };
          const seekTimer = setTimeout(finishSeek, 2500);
          videoElement.addEventListener('seeked', finishSeek);
          try {
            videoElement.currentTime = safeStart;
          } catch {
            finishSeek();
          }
        });
      }

      onProgress(2, 'Initializing vertical rendering pipeline...');
      recorder.start(150);

      try {
        await videoElement.play();
      } catch {
        videoElement.muted = true;
        await videoElement.play();
      }

      const finishRecording = () => {
        if (!isExporting) return;
        isExporting = false;
        try {
          videoElement.pause();
          videoElement.playbackRate = prevRate || 1;
        } catch {}
        onProgress(100, 'Encoding final vertical video package...');
        setTimeout(() => {
          try {
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
          } catch (stopErr) {
            cleanup();
            reject(stopErr);
          }
        }, 220);
      };

      // Safety cap so a stalled video playback can never hang forever
      const maxExpectedMs = Math.ceil((effectiveDuration / safeSpeed) * 1000) + 12000;
      maxWallTimer = setTimeout(finishRecording, maxExpectedMs);

      const renderFrame = () => {
        if (!isExporting) return;
        const currentSec = videoElement.currentTime;
        const relativeTime = Math.max(0, currentSec - safeStart);
        const progressPercent = Math.min(99, Math.max(0, (relativeTime / effectiveDuration) * 100));

        onProgress(
          Math.round(progressPercent),
          `Burning 9:16 vertical captions... ${Math.round(progressPercent)}%`
        );

        drawVerticalFrame({
          ctx,
          canvasWidth: width,
          canvasHeight: height,
          videoElement,
          currentTimeInClip: relativeTime,
          clipDuration: effectiveDuration,
          captions,
          captionPreset,
          captionHighlightStyle,
          captionPosition,
          captionFontSize: scaledFontSize,
          captionColor,
          captionBaseColor,
          captionFontFamily,
          captionTextCase,
          captionOutlineWidth,
          captionWordsPerLine,
          captionDropShadow,
          captionEntranceAnim,
          captionExitAnim,
          framingMode,
          panX,
          showHookBanner,
          hookBannerText,
          showProgressBar,
          progressBarColor,
          showSafeZones: false,
          overlayOnly: false,
          videoFilterCss,
        });

        if (currentSec >= safeEnd - 0.05 || videoElement.ended) {
          finishRecording();
        } else {
          rafId = requestAnimationFrame(renderFrame);
        }
      };

      // Poll alongside rAF in case the browser tab throttles animation frames
      checkInterval = setInterval(() => {
        if (!isExporting) return;
        if (videoElement.currentTime >= safeEnd - 0.05 || videoElement.ended) {
          finishRecording();
        }
      }, 200);

      renderFrame();
    } catch (err: any) {
      cleanup();
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {}
      reject(err instanceof Error ? err : new Error(String(err || 'Studio render failed')));
    }
  });
}

// Helper to generate and download standard .SRT subtitle file
export function generateSrtFile(captions: CaptionChunk[]): string {
  const formatSrtTime = (seconds: number) => {
    const safe = Math.max(0, seconds);
    const hrs = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = Math.floor(safe % 60);
    const ms = Math.floor((safe % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
      secs
    ).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };

  return captions
    .map((chunk, index) => {
      const idx = index + 1;
      const start = formatSrtTime(chunk.start);
      const end = formatSrtTime(chunk.end);
      const text = chunk.text;
      return `${idx}\n${start} --> ${end}\n${text}\n`;
    })
    .join('\n');
}

// Helper to generate a single cumulative .SRT subtitle file for a consolidated highlight reel
export function generateConsolidatedSrtFile(
  clips: Array<{ startTime: number; endTime: number; captions: CaptionChunk[] }>
): string {
  let offsetSec = 0;
  const combinedCaptions: CaptionChunk[] = [];
  clips.forEach((clip) => {
    const clipDur = Math.max(1, Math.round(clip.endTime - clip.startTime));
    (clip.captions || []).forEach((chunk) => {
      const relStart = Math.max(0, Number(chunk.start) || 0);
      const relEnd = Math.max(relStart + 0.4, Number(chunk.end) || relStart + 2.5);
      combinedCaptions.push({
        ...chunk,
        start: offsetSec + relStart,
        end: offsetSec + Math.min(clipDur, relEnd),
      });
    });
    offsetSec += clipDur;
  });
  return generateSrtFile(combinedCaptions);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
