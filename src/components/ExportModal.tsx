import React, { useState } from 'react';
import {
  X,
  Download,
  CheckCircle2,
  FileText,
  Copy,
  Sparkles,
  Smartphone,
  Check,
  Film,
} from 'lucide-react';
import { ClipHighlight, ExportSettings, VideoSource } from '../types';
import { exportVerticalVideo, generateSrtFile, downloadBlob } from '../utils/exportVideo';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeClip: ClipHighlight;
  videoSource: VideoSource;
  settings: ExportSettings;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  activeClip,
  videoSource,
  settings,
  videoRef,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'tiktok' | 'reels' | 'shorts'>('tiktok');
  const [resolution, setResolution] = useState<'1080p' | '720p'>('1080p');
  const [framerate, setFramerate] = useState<30 | 60>(30);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusText, setExportStatusText] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);

  if (!isOpen) return null;

  const clipDuration = Math.round(activeClip.endTime - activeClip.startTime);

  // Fast FFmpeg 9:16 Clipping
  const handleFastClipExport = async () => {
    setIsExporting(true);
    setExportProgress(25);
    setExportStatusText('Clipping 9:16 vertical video with FFmpeg...');
    setDownloadUrl(null);

    try {
      const response = await fetch('/api/clip-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoSource.videoUrl,
          youtubeUrl: videoSource.youtubeUrl,
          startTime: activeClip.startTime,
          duration: clipDuration,
          resolution,
          title: activeClip.title,
        }),
      });

      if (!response.ok) {
        throw new Error('Server clipping service returned ' + response.status);
      }

      const data = await response.json();
      if (!data.downloadUrl) {
        throw new Error(data.error || 'Server did not return download URL');
      }

      setExportProgress(90);
      setExportStatusText('Preparing download package...');

      const clipFileRes = await fetch(data.downloadUrl);
      const blob = await clipFileRes.blob();
      setExportedBlob(blob);
      setDownloadUrl(data.downloadUrl);
      setExportProgress(100);
      setIsExporting(false);

      // Auto trigger download
      downloadBlob(blob, data.filename || `clipforge_${activeClip.id}.mp4`);
    } catch (err: any) {
      console.warn('Fast export fallback to canvas render:', err);
      handleStudioExport();
    }
  };

  // Studio Export with Burned-in Animated Captions
  const handleStudioExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportStatusText('Initializing vertical 9:16 render pipeline...');
    setDownloadUrl(null);

    try {
      let videoToUse = videoRef.current;
      if (!videoToUse || videoToUse.readyState < 2) {
        videoToUse = document.createElement('video');
        videoToUse.src = videoSource.videoUrl;
        videoToUse.crossOrigin = 'anonymous';
        videoToUse.playsInline = true;
        videoToUse.muted = true;
        await new Promise<void>((resolve) => {
          videoToUse!.onloadedmetadata = () => resolve();
          videoToUse!.onerror = () => resolve();
          setTimeout(resolve, 3000);
        });
      }

      const blob = await exportVerticalVideo({
        videoElement: videoToUse,
        startTime: activeClip.startTime,
        endTime: activeClip.endTime,
        resolution,
        framerate,
        framingMode: settings.framingMode,
        panX: settings.panX,
        captionPreset: settings.captionPreset,
        captionPosition: settings.captionPosition,
        captionFontSize: settings.captionFontSize,
        captionColor: settings.captionColor,
        captionEntranceAnim: settings.captionEntranceAnim,
        captionExitAnim: settings.captionExitAnim,
        captions: activeClip.captions,
        showHookBanner: settings.showHookBanner,
        hookBannerText: settings.hookBannerText || activeClip.hook,
        showProgressBar: settings.showProgressBar,
        progressBarColor: settings.progressBarColor,
        onProgress: (prog, text) => {
          setExportProgress(prog);
          setExportStatusText(text);
        },
      });

      setExportedBlob(blob);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setIsExporting(false);
    } catch (err: any) {
      console.error('Export error:', err);
      setIsExporting(false);
      setExportStatusText(`Export error: ${err.message || 'Render failed'}`);
    }
  };

  const handleDownloadVideo = () => {
    if (!exportedBlob) return;
    const cleanTitle = activeClip.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 30);
    downloadBlob(exportedBlob, `clipforge_${selectedPlatform}_${cleanTitle}.mp4`);
  };

  const handleDownloadSrt = () => {
    const srtContent = generateSrtFile(activeClip.captions);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${activeClip.id}_captions.srt`);
  };

  const socialCaptionText = `${activeClip.title}\n\n"${activeClip.hook}"\n\n${activeClip.hashtags.join(' ')} #shorts #viral #reels #tiktok`;

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(socialCaptionText);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-violet-400" />
            <div>
              <h3 className="font-semibold text-zinc-100 text-sm">Export 9:16 Vertical Video</h3>
              <p className="text-xs text-zinc-500">Optimized for TikTok, Reels & Shorts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Platform Presets */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-300">
              Platform Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'tiktok', name: 'TikTok', tag: '9:16 · High Virality' },
                { id: 'reels', name: 'Instagram', tag: '9:16 · Reels Format' },
                { id: 'shorts', name: 'Shorts', tag: '9:16 · 60fps HD' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id as any)}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    selectedPlatform === p.id
                      ? 'bg-zinc-800 border-violet-500 text-white ring-1 ring-violet-500/30'
                      : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                  }`}
                >
                  <div className="text-xs font-semibold text-zinc-200">{p.name}</div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{p.tag}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Resolution & Framerate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Resolution
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer"
              >
                <option value="1080p">1080 x 1920 (Full HD)</option>
                <option value="720p">720 x 1280 (Fast 720p)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Framerate
              </label>
              <select
                value={framerate}
                onChange={(e) => setFramerate(Number(e.target.value) as any)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer"
              >
                <option value={30}>30 FPS (Standard)</option>
                <option value={60}>60 FPS (Smooth)</option>
              </select>
            </div>
          </div>

          {/* Clip Summary */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
              <span>{clipDuration}s duration</span>
              <span className="text-emerald-400">{activeClip.viralityScore}% score</span>
            </div>
            <p className="text-xs font-medium text-zinc-200 line-clamp-1">{activeClip.title}</p>
          </div>

          {/* Export Action / Progress */}
          {isExporting ? (
            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                  <span>{exportStatusText}</span>
                </span>
                <span className="font-mono text-violet-400 font-semibold tabular-nums">{exportProgress}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-600 rounded-full transition-all duration-200"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          ) : downloadUrl ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-medium text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Export ready for download</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDownloadVideo}
                  className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MP4</span>
                </button>

                <button
                  onClick={handleDownloadSrt}
                  className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 border border-zinc-700 cursor-pointer transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>.SRT Captions</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={handleFastClipExport}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Instant 9:16 Video Export (MP4)</span>
              </button>

              <button
                onClick={handleStudioExport}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg text-xs flex items-center justify-center gap-2 border border-zinc-700 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span>Burn Kinetic Subtitles (Studio Render)</span>
              </button>
            </div>
          )}

          {/* Social Caption Copy */}
          <div className="pt-3 border-t border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                Caption & Hashtags
              </label>
              <button
                onClick={handleCopyCaption}
                className="flex items-center gap-1 text-[11px] font-medium text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
              >
                {copiedCaption ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCaption ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <textarea
              readOnly
              value={socialCaptionText}
              rows={2}
              className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 resize-none font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
