import React, { useState } from 'react';
import {
  Sparkles,
  Youtube,
  Upload,
  ArrowRight,
  Clock,
  Play,
  Film,
  Flame,
  Zap,
  Smile,
  BookOpen,
  CheckCircle2,
  Sliders,
  ChevronRight,
  Layers,
  FileVideo,
} from 'lucide-react';
import { SAMPLE_VIDEOS } from '../data/sampleVideos';
import { VideoSource } from '../types';

interface OpusClipHeroProps {
  onGenerateClips: (options: {
    videoSource: VideoSource;
    focusCategory: string;
    targetLength: string;
  }) => void;
  isProcessing: boolean;
  processingStep: string;
  processingProgress: number;
}

export const OpusClipHero: React.FC<OpusClipHeroProps> = ({
  onGenerateClips,
  isProcessing,
  processingStep,
  processingProgress,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [selectedFocus, setSelectedFocus] = useState<string>('all');
  const [targetLength, setTargetLength] = useState<string>('auto');
  const [selectedSample, setSelectedSample] = useState<VideoSource | null>(SAMPLE_VIDEOS[0]);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleSampleClick = (sample: VideoSource) => {
    setSelectedSample(sample);
    setUrlInput(sample.youtubeUrl || '');
  };

  const handleFileUpload = (file?: File) => {
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const videoElem = document.createElement('video');
    videoElem.src = objectUrl;

    videoElem.onloadedmetadata = () => {
      const duration = Math.round(videoElem.duration) || 180;
      const uploadedSource: VideoSource = {
        id: `upload-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        creator: 'User Upload',
        channelName: 'Local Video',
        duration,
        thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1200&q=80',
        videoUrl: objectUrl,
        sourceType: 'upload',
        description: `Uploaded file: ${file.name}`,
        transcript: `[00:00] Creator: Welcome back everyone. Let's break down this insane breakthrough today.
[00:15] Guest: You will not believe what happened right before we started recording!
[00:30] Creator: It was the funniest and most shocking moment of the entire week!`,
        highlights: [],
      };

      onGenerateClips({
        videoSource: uploadedSource,
        focusCategory: selectedFocus,
        targetLength,
      });
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let targetVideo: VideoSource;

    const matchedSample = SAMPLE_VIDEOS.find(
      (s) => s.youtubeUrl === urlInput || (urlInput && s.id.includes(urlInput.toLowerCase()))
    );

    if (matchedSample) {
      targetVideo = matchedSample;
    } else if (urlInput.trim()) {
      let videoId = 'custom';
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = urlInput.match(regExp);
      if (match && match[2].length === 11) {
        videoId = match[2];
      }

      targetVideo = {
        id: `yt-${videoId}-${Date.now()}`,
        title: `YouTube Video: ${videoId}`,
        creator: 'YouTube Creator',
        channelName: 'Viral Channel',
        duration: 300,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        videoUrl: urlInput,
        sourceType: 'youtube',
        youtubeUrl: urlInput,
        description: `YouTube URL: ${urlInput}`,
        transcript: '',
        highlights: [],
      };
    } else if (selectedSample) {
      targetVideo = selectedSample;
    } else {
      targetVideo = SAMPLE_VIDEOS[0];
    }

    onGenerateClips({
      videoSource: targetVideo,
      focusCategory: selectedFocus,
      targetLength,
    });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text);
      }
    } catch {
      // ignore clipboard permission error
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${String(rem).padStart(2, '0')}`;
  };

  if (isProcessing) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 px-6">
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-8 sm:p-10 shadow-2xl space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>AI Video Analysis Engine</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-100">
              Generating High-Retention Clips
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
              Scanning dialogue cadence, emotional hooks, and reframing to 9:16 vertical format.
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-zinc-400 truncate max-w-sm">{processingStep}</span>
              <span className="text-violet-400 font-semibold tabular-nums">{processingProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${processingProgress}%` }}
              />
            </div>
          </div>

          {/* Steps checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {[
              { label: 'Transcript & Audio Cadence', done: processingProgress >= 30 },
              { label: 'Gemini Viral Hook Detection', done: processingProgress >= 60 },
              { label: 'Auto 9:16 Vertical Cropping', done: processingProgress >= 85 },
              { label: 'Kinetic Subtitle Synchronization', done: processingProgress >= 95 },
            ].map((step, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2.5 p-3 rounded-lg border text-xs transition-colors ${
                  step.done
                    ? 'bg-zinc-800/70 border-zinc-700/80 text-zinc-200'
                    : 'bg-zinc-950/40 border-zinc-800/60 text-zinc-500'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                    step.done ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  )}
                </div>
                <span className="truncate">{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 py-4 sm:py-6">
      {/* Hero Headline */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span>Automated 9:16 Video Repurposing</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-100">
          Turn long videos into <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-zinc-200">
            viral short clips
          </span>
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
          AI detects punchlines, emotional hooks, and top moments. Automatically crops to 9:16 with animated kinetic captions for TikTok, Reels & Shorts.
        </p>
      </div>

      {/* Main Ingest Deck */}
      <div className="max-w-3xl mx-auto bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
              <span>YouTube Video URL</span>
              <button
                type="button"
                onClick={handlePaste}
                className="text-[11px] text-violet-400 hover:text-violet-300 cursor-pointer transition-colors"
              >
                Paste from clipboard
              </button>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-zinc-500">
                <Youtube className="w-5 h-5 text-red-500" />
              </div>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full pl-11 pr-32 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-violet-500 transition-colors"
              />
              <button
                type="submit"
                className="absolute right-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Clip Video</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Secondary Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className={`border border-dashed rounded-xl p-4 sm:p-5 text-center transition-colors cursor-pointer ${
              isDragOver
                ? 'border-violet-500 bg-violet-500/5'
                : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40'
            }`}
          >
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              id="file-upload-input"
              className="hidden"
            />
            <label htmlFor="file-upload-input" className="cursor-pointer block space-y-1">
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-300">
                <Upload className="w-4 h-4 text-zinc-400" />
                <span className="font-medium text-violet-400 hover:underline">Upload a local video file</span>
                <span className="text-zinc-500">or drag and drop</span>
              </div>
              <p className="text-[11px] text-zinc-500">MP4, MOV, or WebM up to 2GB</p>
            </label>
          </div>
        </form>

        {/* AI Extraction Preferences */}
        <div className="pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">
          {/* Focus mode */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium">Moment Focus:</span>
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              {[
                { id: 'all', label: 'All Viral' },
                { id: 'funny', label: 'Humor & Banter' },
                { id: 'highlight', label: 'Climax' },
                { id: 'educational', label: 'Insights' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedFocus(opt.id)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                    selectedFocus === opt.id
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Length mode */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium">Clip Target:</span>
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              {[
                { id: 'auto', label: 'Auto (15-60s)' },
                { id: '<30s', label: '< 30s' },
                { id: '30-60s', label: '30-60s' },
              ].map((len) => (
                <button
                  key={len.id}
                  onClick={() => setTargetLength(len.id)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                    targetLength === len.id
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {len.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Benchmark Demo Library */}
      <div className="max-w-4xl mx-auto space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Or try with sample episodes
          </h3>
          <span className="text-xs text-zinc-500">Ready to clip instantly</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {SAMPLE_VIDEOS.map((sample) => {
            const isSelected = selectedSample?.id === sample.id;
            return (
              <div
                key={sample.id}
                onClick={() => handleSampleClick(sample)}
                className={`group text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-zinc-800/90 border-violet-500/50 shadow-md ring-1 ring-violet-500/30'
                    : 'bg-zinc-900/60 hover:bg-zinc-800/60 border-zinc-800/80'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-950">
                    <img
                      src={sample.thumbnail}
                      alt={sample.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <span className="absolute bottom-2 right-2 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-black/80 text-zinc-200">
                      {formatDuration(sample.duration)}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-zinc-200 line-clamp-2 group-hover:text-violet-300 transition-colors">
                      {sample.title}
                    </h4>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {sample.channelName}
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-zinc-400">
                    {sample.highlights.length} viral hooks detected
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateClips({
                        videoSource: sample,
                        focusCategory: selectedFocus,
                        targetLength,
                      });
                    }}
                    className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Clip this</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
