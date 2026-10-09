import { CaptionChunk, CaptionPreset, FramingMode } from '../types';
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
  captionPosition: 'top' | 'middle' | 'lower_third' | 'bottom';
  captionFontSize: number;
  captionColor: string;
  captions: CaptionChunk[];
  showHookBanner: boolean;
  hookBannerText: string;
  showProgressBar: boolean;
  progressBarColor: string;
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
    captionPosition,
    captionFontSize,
    captionColor,
    captions,
    showHookBanner,
    hookBannerText,
    showProgressBar,
    progressBarColor,
    onProgress,
  } = options;

  const duration = Math.max(1, endTime - startTime);
  const width = resolution === '1080p' ? 1080 : 720;
  const height = resolution === '1080p' ? 1920 : 1280;

  // Create offscreen canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create 2D canvas context for rendering.');
  }

  // Adjust font size scaling for resolution
  const scaledFontSize = resolution === '1080p' ? captionFontSize * 1.5 : captionFontSize;

  // Setup canvas stream
  const canvasStream = canvas.captureStream(framerate);

  // Capture audio from video element if possible
  let combinedStream: MediaStream = canvasStream;
  try {
    const audioStream = (videoElement as any).captureStream
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

  // Determine supported mime type
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  let selectedMimeType = '';
  for (const mime of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mime)) {
      selectedMimeType = mime;
      break;
    }
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
    recorder.onerror = (err) => reject(err);

    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: selectedMimeType || 'video/webm' });
      resolve(blob);
    };

    // Prepare video playback
    videoElement.currentTime = startTime;
    videoElement.muted = false; // keep audio playing for stream capture

    await new Promise<void>((res) => {
      const onSeeked = () => {
        videoElement.removeEventListener('seeked', onSeeked);
        res();
      };
      videoElement.addEventListener('seeked', onSeeked);
    });

    recorder.start(100);
    onProgress(0, 'Initializing vertical rendering pipeline...');

    try {
      await videoElement.play();
    } catch {
      // If play failed due to autoplay policy, mute and play
      videoElement.muted = true;
      await videoElement.play();
    }

    let isExporting = true;

    const renderLoop = () => {
      if (!isExporting) return;

      const currentSec = videoElement.currentTime;
      const relativeTime = currentSec - startTime;
      const progressPercent = Math.min(100, Math.max(0, (relativeTime / duration) * 100));

      onProgress(
        Math.round(progressPercent),
        `Burning 9:16 vertical captions... ${Math.round(progressPercent)}%`
      );

      // Draw frame onto canvas
      drawVerticalFrame({
        ctx,
        canvasWidth: width,
        canvasHeight: height,
        videoElement,
        currentTimeInClip: relativeTime,
        clipDuration: duration,
        captions,
        captionPreset,
        captionPosition,
        captionFontSize: scaledFontSize,
        captionColor,
        framingMode,
        panX,
        showHookBanner,
        hookBannerText,
        showProgressBar,
        progressBarColor,
        showSafeZones: false,
        overlayOnly: false,
      });

      if (currentSec >= endTime || videoElement.ended) {
        isExporting = false;
        videoElement.pause();
        onProgress(100, 'Encoding final vertical video package...');
        setTimeout(() => {
          recorder.stop();
        }, 300);
      } else {
        requestAnimationFrame(renderLoop);
      }
    };

    renderLoop();
  });
}

// Helper to generate and download standard .SRT subtitle file
export function generateSrtFile(captions: CaptionChunk[]): string {
  const formatSrtTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
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
