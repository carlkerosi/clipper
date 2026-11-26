import React, { useState } from 'react';
import { X, Upload, Film, Sparkles, ArrowRight, Loader2, Globe } from 'lucide-react';
import { SAMPLE_VIDEOS } from '../data/sampleVideos';
import { VideoSource } from '../types';
import thumbNeuro from '../assets/images/thumb_neuro_lab_1795100814397.jpg';
import { parseJsonResponse } from '../utils/safeFetchJson';

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

  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectSample = (sample: VideoSource) => {
    onSelectVideo({
      ...sample,
      playableSourceUrl: sample.videoUrl,
    });
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadedFile(file);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('video', file);

      const uploadRes = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      const data = await parseJsonResponse(uploadRes, 'Video upload failed');
      if (!uploadRes.ok || !data.playableSourceUrl) {
        throw new Error(data.error || 'Upload failed');
      }

      const newSource: VideoSource = {
        id: `upload-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        creator: 'User Upload',
        channelName: 'My Local Videos',
        duration: data.duration || 120,
        thumbnail: thumbNeuro,
        videoUrl: data.playableSourceUrl,
        playableSourceUrl: data.playableSourceUrl,
        sourceType: 'upload',
        description: `Uploaded video file: ${file.name}`,
        transcript: customTranscript || '',
        highlights: [],
      };

      onSelectVideo(newSource);
      onClose();
    } catch (err: any) {
      setUploadError(err.message || 'Could not upload video.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let rawUrl = youtubeUrl.trim();
    if (!rawUrl) return;
    if (!/^https?:\/\//i.test(rawUrl) && rawUrl.includes('.')) {
      rawUrl = `https://${rawUrl}`;
    }

    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = rawUrl.match(regExp);
    const isYoutube =
      (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be')) &&
      Boolean(match && match[2]?.length === 11);

    if (isYoutube && match) {
      const videoId = match[2];
      const newSource: VideoSource = {
        id: `yt-${videoId}-${Date.now()}`,
        title: customTitle || `YouTube Video: ${videoId}`,
        creator: 'YouTube Creator',
        channelName: 'YouTube Channel',
        duration: 300,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        videoUrl: rawUrl,
        sourceType: 'youtube',
        youtubeUrl: rawUrl,
        youtubeVideoId: videoId,
        description: `Imported YouTube video URL: ${rawUrl}`,
        transcript: customTranscript || '',
        highlights: [],
      };
      onSelectVideo(newSource);
      onClose();
      return;
    }

    const hostLabel = (() => {
      try {
        return new URL(rawUrl).hostname.replace(/^www\./, '');
      } catch {
        return 'External Video';
      }
    })();

    const newSource: VideoSource = {
      id: `url-${Date.now()}`,
      title: customTitle || `Video from ${hostLabel}`,
      creator: hostLabel,
      channelName: hostLabel,
      duration: 180,
      thumbnail: thumbNeuro,
      videoUrl: rawUrl,
      sourceType: 'url',
      description: `Imported video URL: ${rawUrl}`,
      transcript: customTranscript || '',
      highlights: [],
    };

    onSelectVideo(newSource);
    onClose();
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
            <Globe className="w-3.5 h-3.5 text-violet-400" />
            <span>Any Video URL</span>
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
                          referrerPolicy="no-referrer"
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
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Any Video Link (YouTube, TikTok, Vimeo, X, or Direct MP4)
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-zinc-500">
                    <Globe className="w-4 h-4 text-violet-400" />
                  </div>
                  <input
                    type="text"
                    inputMode="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://example.com/video.mp4"
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
              {uploadError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {uploadError}
                </div>
              )}
              <div className="border border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl p-8 text-center bg-zinc-950/40 cursor-pointer">
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={handleFileUpload}
                  id="modal-upload"
                  disabled={isLoading}
                  className="hidden"
                />
                <label htmlFor="modal-upload" className="cursor-pointer block space-y-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-8 h-8 mx-auto text-violet-400 animate-spin" />
                      <div className="text-xs font-medium text-violet-300">
                        Uploading {uploadedFile?.name || 'video'}...
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-zinc-500" />
                      <div className="text-xs font-medium text-zinc-300">
                        <span className="text-violet-400">Click to select video</span> or drag and drop
                      </div>
                      <p className="text-[11px] text-zinc-500">MP4, MOV, or WebM up to 1.5GB</p>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
