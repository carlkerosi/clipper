import React, { useState } from 'react';
import {
  X,
  Download,
  CheckCircle2,
  Share2,
  FileText,
  Copy,
  Sparkles,
  Smartphone,
  Check,
  Video,
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
      // Fallback to studio export
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
      // Use existing video element or create standalone element
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

  const socialCaptionText = `${activeClip.title}\n\n"${activeClip.hook}"\n\n${activeClip.hashtags.join(' ')} #fyp #viral #trending #shorts`;

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(socialCaptionText);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Export 9:16 Vertical Video</h3>
              <p className="text-xs text-slate-400">Directly optimized for TikTok, Reels, and YouTube Shorts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Platform Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Destination Platform
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'tiktok', name: 'TikTok', icon: '🎵', tag: '9:16 · High Virality' },
                { id: 'reels', name: 'Instagram Reels', icon: '📸', tag: '9:16 · Safe Margins' },
                { id: 'shorts', name: 'YouTube Shorts', icon: '🔴', tag: '9:16 · HD 60fps' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedPlatform === p.id
                      ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/30 text-white'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <div className="text-base mb-1">{p.icon}</div>
                  <div className="text-xs font-bold text-slate-200">{p.name}</div>
                  <div className="text-[10px] text-slate-400">{p.tag}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Export Resolution & Framerate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Resolution
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="1080p">1080 x 1920 (Full HD 9:16)</option>
                <option value="720p">720 x 1280 (Fast HD 9:16)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Framerate
              </label>
              <select
                value={framerate}
                onChange={(e) => setFramerate(Number(e.target.value) as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value={30}>30 FPS (Standard)</option>
                <option value={60}>60 FPS (Ultra Smooth)</option>
              </select>
            </div>
          </div>

          {/* Clip Summary Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Target Clip:</span>
              <span className="font-mono text-amber-400 font-bold">{clipDuration}s duration</span>
            </div>
            <p className="text-xs font-bold text-slate-200 line-clamp-1">{activeClip.title}</p>
            <p className="text-[11px] text-slate-400 line-clamp-1">Hook: "{activeClip.hook}"</p>
          </div>

          {/* Live Export Progress or Actions */}
          {isExporting ? (
            <div className="p-5 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>{exportStatusText}</span>
                </span>
                <span className="font-mono text-amber-400 font-black">{exportProgress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-200 shadow-md shadow-amber-500/50"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Rendering 9:16 vertical frames and burning animated subtitles with synchronized audio...
              </p>
            </div>
          ) : downloadUrl ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Export Complete! Your TikTok video is ready.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleDownloadVideo}
                  className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Download 9:16 Video</span>
                </button>

                <button
                  onClick={handleDownloadSrt}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 cursor-pointer transition-all"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Download .SRT Captions</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <button
                onClick={handleFastClipExport}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:opacity-95 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 cursor-pointer transition-all"
              >
                <Smartphone className="w-4 h-4 stroke-[2.5]" />
                <span>⚡ Instant Clip 9:16 Video (Fast MP4 Download)</span>
              </button>

              <button
                onClick={handleStudioExport}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 cursor-pointer transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>🎨 Burn Animated Subtitles & Export (Studio Render)</span>
              </button>
            </div>
          )}

          {/* Social Copy Section */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                TikTok Title, Description & Hashtags
              </label>
              <button
                onClick={handleCopyCaption}
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                {copiedCaption ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCaption ? 'Copied to Clipboard!' : 'Copy All'}</span>
              </button>
            </div>
            <textarea
              readOnly
              value={socialCaptionText}
              rows={3}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 resize-none font-sans"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
