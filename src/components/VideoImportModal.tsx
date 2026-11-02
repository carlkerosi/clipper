import React, { useState } from 'react';
import { X, Youtube, Upload, Film, Sparkles, ArrowRight } from 'lucide-react';
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
        transcript: customTranscript || `[00:00] Creator: Welcome back everyone. Let's break down this crazy event today.
[00:15] Co-host: No way, did that really happen?!
[00:25] Creator: Absolutely, and wait till you see what happens next!
[00:45] Co-host: That is the funniest thing I have seen all month!`,
        highlights: [
          {
            id: `clip-custom-1`,
            title: `Viral Highlight - ${file.name}`,
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

    let videoId = 'sample';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = youtubeUrl.match(regExp);
    if (match && match[2].length === 11) {
      videoId = match[2];
    }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <Film className="w-5 h-5 text-violet-400" />
            <div>
              <h3 className="font-semibold text-zinc-100 text-sm">Import Source Video</h3>
              <p className="text-xs text-zinc-500">Load long-form videos to extract viral clips</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('sample')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'sample'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>Sample Library</span>
          </button>

          <button
            onClick={() => setActiveTab('youtube')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'youtube'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Youtube className="w-3.5 h-3.5 text-red-500" />
            <span>YouTube URL</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
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
              <p className="text-xs text-zinc-400">
                Choose a pre-configured viral episode with high-energy dialogue and pre-analyzed highlights:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SAMPLE_VIDEOS.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => handleSelectSample(video)}
                    className="p-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/60 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-950">
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono tabular-nums text-zinc-300">
                          {Math.floor(video.duration / 60)}:
                          {String(video.duration % 60).padStart(2, '0')}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-200 line-clamp-1">
                          {video.title}
                        </h4>
                        <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                          {video.channelName} · {video.highlights.length} viral clips
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'youtube' && (
            <form onSubmit={handleYoutubeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">YouTube Video URL</label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-zinc-500">
                    <Youtube className="w-4 h-4 text-red-500" />
                  </div>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span>{isLoading ? 'Importing Video...' : 'Load & Analyze with Gemini'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="border border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl p-8 text-center bg-zinc-950/40 cursor-pointer">
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={handleFileUpload}
                  id="modal-upload"
                  className="hidden"
                />
                <label htmlFor="modal-upload" className="cursor-pointer block space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-zinc-500" />
                  <div className="text-xs font-medium text-zinc-300">
                    <span className="text-violet-400">Click to select video</span> or drag and drop
                  </div>
                  <p className="text-[11px] text-zinc-500">MP4, MOV, or WebM up to 2GB</p>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
