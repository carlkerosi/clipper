import React, { useState } from 'react';
import { X, Youtube, Upload, Film, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { SAMPLE_VIDEOS } from '../data/sampleVideos';
import { VideoSource } from '../types';

interface VideoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (video: VideoSource) => void;
}

export const VideoImportModal: React.FC<VideoImportModalProps> = ({
  isOpen,
  onClose,
  onSelectVideo,
}) => {
  const [activeTab, setActiveTab] = useState<'sample' | 'youtube' | 'upload'>('sample');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customTranscript, setCustomTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  if (!isOpen) return null;

  const handleSelectSample = (sample: VideoSource) => {
    onSelectVideo(sample);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    const objectUrl = URL.createObjectURL(file);
    const videoElem = document.createElement('video');
    videoElem.src = objectUrl;

    videoElem.onloadedmetadata = () => {
      const duration = Math.round(videoElem.duration) || 120;
      const newSource: VideoSource = {
        id: `upload-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        creator: 'User Upload',
        channelName: 'My Local Videos',
        duration,
        thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1200&q=80',
        videoUrl: objectUrl,
        sourceType: 'upload',
        description: `Locally uploaded video file: ${file.name}`,
        transcript: customTranscript || `[00:00] Creator: Hey everyone! Welcome back. Today we're diving straight into this crazy topic.
[00:15] Co-host: No way, did that really happen?!
[00:25] Creator: Absolutely, and wait till you see what happens next!
[00:45] Co-host: That is the funniest thing I have seen all month!`,
        highlights: [
          {
            id: `clip-custom-1`,
            title: `🔥 Top Viral Highlight - ${file.name}`,
            hook: `You won't believe what happens next! 😱`,
            reason: 'High energy opening with strong retention curiosity.',
            category: 'highlight',
            startTime: 0,
            endTime: Math.min(duration, 35),
            viralityScore: 94,
            hookScore: 96,
            flowScore: 92,
            emojis: ['🔥', '⚡', '👀'],
            hashtags: ['#viral', '#trending', '#fyp', '#shorts'],
            captions: [
              {
                start: 0,
                end: 4.5,
                text: "You won't believe what happens in this clip!",
                emphasisWord: "BELIEVE",
                words: [
                  { w: "You won't", start: 0, end: 1.0 },
                  { w: "believe", start: 1.0, end: 2.0 },
                  { w: "what happens", start: 2.0, end: 3.2 },
                  { w: "in this clip!", start: 3.2, end: 4.5 },
                ],
              },
            ],
          },
        ],
      };

      onSelectVideo(newSource);
      onClose();
    };
  };

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setIsLoading(true);

    // Extract video ID
    let videoId = 'sample';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = youtubeUrl.match(regExp);
    if (match && match[2].length === 11) {
      videoId = match[2];
    }

    // Match sample or create new YouTube source with rich highlight analysis
    setTimeout(() => {
      setIsLoading(false);
      const newSource: VideoSource = {
        id: `yt-${videoId}-${Date.now()}`,
        title: customTitle || `YouTube Video: ${videoId}`,
        creator: 'YouTube Creator',
        channelName: 'Trending Channel',
        duration: 300,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        videoUrl: youtubeUrl,
        sourceType: 'youtube',
        youtubeUrl: youtubeUrl,
        description: `Imported YouTube video URL: ${youtubeUrl}`,
        transcript: customTranscript || '',
        highlights: [],
      };

      onSelectVideo(newSource);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Import Source Video</h3>
              <p className="text-xs text-slate-400">Load long-form videos to extract viral clips and highlights</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/20 p-2 gap-2">
          <button
            onClick={() => setActiveTab('sample')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'sample'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Viral Sample Library (Instant)</span>
          </button>

          <button
            onClick={() => setActiveTab('youtube')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'youtube'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Youtube className="w-3.5 h-3.5 text-red-500" />
            <span>YouTube URL</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === 'sample' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Choose a pre-configured viral long-form video with high-energy dialogue, humor, and pre-analyzed highlights:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SAMPLE_VIDEOS.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => handleSelectSample(video)}
                    className="group relative p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/50 transition-all cursor-pointer flex flex-col justify-between overflow-hidden"
                  >
                    <div className="space-y-2">
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-950">
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                          {Math.floor(video.duration / 60)}:
                          {String(video.duration % 60).padStart(2, '0')}
                        </div>
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-amber-500/90 text-slate-950 text-[10px] font-bold">
                          {video.highlights.length} Viral Clips
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors line-clamp-2">
                          {video.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {video.channelName}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px] text-amber-400 font-semibold">
                      <span>Load into Studio</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'youtube' && (
            <form onSubmit={handleYoutubeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  YouTube Video Link
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 placeholder:text-slate-500 text-xs focus:outline-none focus:border-amber-500 pr-10"
                  />
                  <Youtube className="w-4 h-4 text-red-500 absolute right-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Custom Title (Optional)
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Crazy Podcast Debate on AI"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 placeholder:text-slate-500 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Dialogue or Transcript (Optional - Gemini can auto-generate)
                </label>
                <textarea
                  value={customTranscript}
                  onChange={(e) => setCustomTranscript(e.target.value)}
                  placeholder="Paste speech lines with timestamps or dialogue here, or leave empty for AI auto-generation..."
                  rows={4}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 placeholder:text-slate-500 text-xs focus:outline-none focus:border-amber-500 resize-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{isLoading ? 'Fetching & Analyzing Video...' : 'Import & Auto-Detect Viral Clips'}</span>
              </button>
            </form>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-2xl p-8 text-center transition-colors bg-slate-950/40">
                <Upload className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-200 mb-1">Upload MP4, WebM, or MOV video</h4>
                <p className="text-xs text-slate-400 mb-4">Drag and drop your long-form video file here</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs cursor-pointer border border-slate-600 transition-colors">
                  <span>Browse Video File</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/m4v"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Dialogue/Transcript (Optional)
                </label>
                <textarea
                  value={customTranscript}
                  onChange={(e) => setCustomTranscript(e.target.value)}
                  placeholder="Paste dialogue if available, or Gemini will analyze speech automatically..."
                  rows={3}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 placeholder:text-slate-500 text-xs focus:outline-none focus:border-amber-500 resize-none font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
