import React, { useState } from 'react';
import {
  Sparkles,
  Youtube,
  Upload,
  Flame,
  Zap,
  Smile,
  BookOpen,
  ArrowRight,
  Clock,
  Play,
  CheckCircle2,
  Sliders,
  Film,
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

  const handleSampleClick = (sample: VideoSource) => {
    setSelectedSample(sample);
    setUrlInput(sample.youtubeUrl || '');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
        transcript: `[00:00] Creator: Hey everyone! Welcome to today's crazy episode.
[00:15] Guest: You will not believe what just happened backstage!
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

    // Check if input matches one of our samples
    const matchedSample = SAMPLE_VIDEOS.find(
      (s) => s.youtubeUrl === urlInput || (urlInput && s.id.includes(urlInput.toLowerCase()))
    );

    if (matchedSample) {
      targetVideo = matchedSample;
    } else if (urlInput.trim()) {
      // Custom YouTube link
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

  return (
    <div className="relative w-full rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-8 lg:p-10 shadow-2xl shadow-black overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 translate-y-1/2 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

      {isProcessing ? (
        /* Opus Clip Style AI Processing Radar Pipeline */
        <div className="max-w-xl mx-auto py-8 text-center space-y-6 animate-in fade-in duration-300">
          <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
            {/* Spinning radar rings */}
            <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping" />
            <div className="absolute inset-1 rounded-full border-2 border-dashed border-amber-500/60 animate-spin" />
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Generating Viral Clips with Gemini AI...
            </h3>
            <p className="text-sm font-semibold text-amber-400">
              {processingStep}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 max-w-md mx-auto">
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 rounded-full transition-all duration-300 shadow-md shadow-amber-500/50"
                style={{ width: `${processingProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>Opus Virality Engine</span>
              <span className="text-amber-400 font-bold">{processingProgress}% Complete</span>
            </div>
          </div>

          {/* 4 Pipeline Steps */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left pt-4 max-w-lg mx-auto">
            {[
              { label: 'Audio Extract', done: processingProgress >= 25 },
              { label: 'Dialogue Transcript', done: processingProgress >= 50 },
              { label: 'Virality Scoring', done: processingProgress >= 75 },
              { label: '9:16 Vertical Crop', done: processingProgress >= 95 },
            ].map((step, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  step.done
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${step.done ? 'text-emerald-400' : 'text-slate-400'}`}
                />
                <span className="truncate">{step.label}</span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-400 max-w-md mx-auto">
            💡 <span className="text-slate-300 font-medium">Opus Clip Pro-Tip:</span> Clips with bouncy Hormozi captions and strong 3-second opening hooks achieve up to 300% higher completion rate on TikTok and Shorts.
          </div>
        </div>
      ) : (
        /* Main Hero Generator Form */
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>OPUSCLIP & KLAP.AI CLIPPING ENGINE</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Turn 1 Long Video Into{' '}
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
                Viral Shorts
              </span>{' '}
              in 1 Click
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
              AI detects funny & peak moments, auto-generates animated TikTok/Hormozi captions, calculates virality scores, and reframes speakers to vertical 9:16 video.
            </p>
          </div>

          {/* Primary Input Box (Opus Clip Style) */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-slate-950 border-2 border-slate-800 focus-within:border-amber-500/70 shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2 transition-all">
              <div className="flex-1 flex items-center px-3 gap-3">
                <Youtube className="w-5 h-5 text-red-500 shrink-0" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste YouTube link or click a sample video below..."
                  className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 text-xs sm:text-sm font-medium focus:outline-none py-2"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer border border-slate-700 transition-colors shrink-0">
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Upload File</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:opacity-95 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer transition-all shrink-0"
                >
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>Get Clips in 1 Click</span>
                </button>
              </div>
            </div>

            {/* Quick 1-Click Popular Creator Samples */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Or try instant viral creator samples:</span>
                <span className="text-[11px] text-amber-400 font-medium">1-Click instant test</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SAMPLE_VIDEOS.map((sample) => {
                  const isSelected = selectedSample?.id === sample.id;
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleSampleClick(sample)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500 text-white ring-1 ring-amber-500/30'
                          : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-[11px] font-bold text-slate-200 truncate">
                          {sample.channelName}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 line-clamp-1 font-medium">
                        {sample.title}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{sample.highlights.length} clips ready</span>
                        <span className="text-amber-400 font-bold">Try →</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Opus Clip Preferences Bar */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80">
              {/* Highlight Focus Filter */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold">Highlight Filter:</span>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'all', label: '🔥 All Peaks' },
                    { id: 'funny', label: '😂 Funny & Roast' },
                    { id: 'highlight', label: '⚡ Climax' },
                    { id: 'educational', label: '🧠 Knowledge' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedFocus(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        selectedFocus === cat.id
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target duration */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold">Clip Length:</span>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'auto', label: 'Auto (Best)' },
                    { id: 'short', label: '< 30s' },
                    { id: 'medium', label: '30s - 60s' },
                  ].map((dur) => (
                    <button
                      key={dur.id}
                      type="button"
                      onClick={() => setTargetLength(dur.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        targetLength === dur.id
                          ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
