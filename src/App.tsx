import React, { useState, useRef } from 'react';
import { SAMPLE_VIDEOS } from './data/sampleVideos';
import { VideoSource, ClipHighlight, ExportSettings } from './types';
import { Header } from './components/Header';
import { OpusClipHero } from './components/OpusClipHero';
import { OpusClipFeed } from './components/OpusClipFeed';
import { HighlightList } from './components/HighlightList';
import { VerticalStudioPreview } from './components/VerticalStudioPreview';
import { CaptionStyleCustomizer } from './components/CaptionStyleCustomizer';
import { TimelineTrimmer } from './components/TimelineTrimmer';
import { TranscriptEditor } from './components/TranscriptEditor';
import { VideoImportModal } from './components/VideoImportModal';
import { ExportModal } from './components/ExportModal';
import { Sparkles, Sliders, FileText, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';

export default function App() {
  const [appMode, setAppMode] = useState<'generator' | 'feed' | 'studio'>('generator');
  const [currentVideo, setCurrentVideo] = useState<VideoSource>({
    ...SAMPLE_VIDEOS[0],
    playableSourceUrl: SAMPLE_VIDEOS[0].videoUrl,
  });
  const [activeClip, setActiveClip] = useState<ClipHighlight>(SAMPLE_VIDEOS[0].highlights[0]);
  const [currentTime, setCurrentTime] = useState<number>(SAMPLE_VIDEOS[0].highlights[0].startTime);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const [settings, setSettings] = useState<ExportSettings>({
    resolution: '1080p',
    framerate: 30,
    framingMode: 'smart_crop',
    captionPreset: 'hormozi',
    captionColor: '#FACC15',
    captionPosition: 'lower_third',
    captionFontSize: 32,
    captionEntranceAnim: 'pop',
    captionExitAnim: 'fade',
    showHookBanner: true,
    hookBannerText: SAMPLE_VIDEOS[0].highlights[0].hook,
    showProgressBar: true,
    progressBarColor: '#EF4444',
    panX: 0,
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [isReclippingStudio, setIsReclippingStudio] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'style' | 'transcript'>('style');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSelectClip = (clip: ClipHighlight) => {
    setActiveClip(clip);
    setSettings((prev) => ({
      ...prev,
      hookBannerText: clip.hook,
      framingMode: clip.framingSuggestion || prev.framingMode,
    }));
    setCurrentTime(clip.startTime);

    const hasFullSource = Boolean(
      currentVideo.playableSourceUrl ||
        (currentVideo.videoUrl &&
          !currentVideo.videoUrl.includes('youtube.com') &&
          !currentVideo.videoUrl.includes('youtu.be'))
    );
    if (videoRef.current) {
      try {
        videoRef.current.currentTime = !hasFullSource && clip.clipVideoUrl ? 0 : clip.startTime;
      } catch {}
    }
  };

  const handleSelectClipToEdit = (clip: ClipHighlight) => {
    handleSelectClip(clip);
    setAppMode('studio');
  };

  const handleUpdateSettings = (newSettings: Partial<ExportSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleUpdateClipTime = (newStart: number, newEnd: number) => {
    const roundedStart = Math.round(newStart * 10) / 10;
    const roundedEnd = Math.round(newEnd * 10) / 10;
    setActiveClip((prev) => {
      const updated = { ...prev, startTime: roundedStart, endTime: roundedEnd };
      setCurrentVideo((v) => ({
        ...v,
        highlights: v.highlights.map((h) => (h.id === updated.id ? updated : h)),
      }));
      return updated;
    });
  };

  const handleClipUpdated = (updatedClip: ClipHighlight) => {
    setCurrentVideo((prev) => ({
      ...prev,
      highlights: prev.highlights.map((h) => (h.id === updatedClip.id ? updatedClip : h)),
    }));
    if (activeClip.id === updatedClip.id) {
      setActiveClip(updatedClip);
    }
  };

  const handleReclipInStudio = async () => {
    setIsReclippingStudio(true);
    try {
      const clipDur = Math.max(5, Math.round(activeClip.endTime - activeClip.startTime));
      const res = await fetch('/api/clip-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: currentVideo.videoUrl,
          playableSourceUrl: currentVideo.playableSourceUrl,
          youtubeUrl: currentVideo.youtubeUrl,
          startTime: activeClip.startTime,
          duration: clipDur,
          resolution: settings.resolution === '1080p' ? '1080p' : '720p',
          framingMode: settings.framingMode,
          panX: settings.panX,
          title: activeClip.title,
          clipId: `${activeClip.id}_trim_${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.downloadUrl) {
        throw new Error(data.error || 'Failed to re-clip segment');
      }
      handleClipUpdated({
        ...activeClip,
        clipVideoUrl: data.downloadUrl,
        downloadUrl: data.downloadUrl,
      });
      showToast('Re-rendered 9:16 clip with updated trim and framing.');
    } catch (err: any) {
      showToast(err.message || 'Could not re-clip segment.');
    } finally {
      setIsReclippingStudio(false);
    }
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    const hasFullSource = Boolean(
      currentVideo.playableSourceUrl ||
        (currentVideo.videoUrl &&
          !currentVideo.videoUrl.includes('youtube.com') &&
          !currentVideo.videoUrl.includes('youtu.be'))
    );
    if (videoRef.current) {
      videoRef.current.currentTime =
        !hasFullSource && activeClip.clipVideoUrl
          ? Math.max(0, time - activeClip.startTime)
          : time;
    }
  };

  const handleGenerateClips = async (options: {
    videoSource: VideoSource;
    focusCategory: string;
    targetLength: string;
  }) => {
    let video: VideoSource = { ...options.videoSource };
    let chapters: any[] = [];

    setPipelineError(null);
    setCurrentVideo(video);
    setIsProcessing(true);
    setIsAiScanning(true);
    setProcessingProgress(12);
    setProcessingStep('1/4: Ingesting source video metadata & stream...');

    try {
      // Step 1: Fetch real metadata, subtitles, and cached MP4 for YouTube videos
      if (video.sourceType === 'youtube' && video.youtubeUrl) {
        setProcessingStep('1/4: Extracting YouTube video, captions & stream via yt-dlp...');
        const ytRes = await fetch('/api/youtube-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: video.youtubeUrl }),
        });

        const ytData = await ytRes.json();
        if (!ytRes.ok) {
          throw new Error(ytData.error || 'Could not retrieve YouTube video info.');
        }

        chapters = ytData.chapters || [];
        video = {
          ...video,
          title: ytData.title || video.title,
          thumbnail: ytData.thumbnail || video.thumbnail,
          duration: ytData.duration || video.duration,
          channelName: ytData.channelName || video.channelName,
          description: ytData.description || video.description,
          transcript: video.transcript || ytData.transcript || '',
          playableSourceUrl: ytData.playableSourceUrl || video.playableSourceUrl,
        };
        setCurrentVideo(video);
      } else if (!video.playableSourceUrl && video.videoUrl.startsWith('/')) {
        video.playableSourceUrl = video.videoUrl;
      }

      // Step 2: If transcript is missing/short, run real Gemini 3.5 Audio Transcription
      setProcessingProgress(36);
      if (!video.transcript || video.transcript.trim().length < 40) {
        if (video.playableSourceUrl || video.youtubeUrl) {
          setProcessingStep('2/4: Gemini 3.5 Transcribe listening to audio & building timestamps...');
          const trRes = await fetch('/api/transcribe-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoUrl: video.videoUrl,
              playableSourceUrl: video.playableSourceUrl,
              youtubeUrl: video.youtubeUrl,
            }),
          });
          const trData = await trRes.json();
          if (!trRes.ok) {
            if (trData.code === 'MISSING_API_KEY' || trData.code === 'API_KEY_INVALID' || trData.code === 'PERMISSION_DENIED') {
              throw new Error(trData.error);
            }
            console.warn('Transcription step notice:', trData.error);
          } else if (trData.transcript) {
            video = {
              ...video,
              transcript: trData.transcript,
              duration: trData.duration || video.duration,
            };
            setCurrentVideo(video);
          }
        }
      }

      // Step 3: Gemini 4 Hydrogen Viral Highlight Detection & Kinetic Captions
      setProcessingProgress(64);
      setProcessingStep('3/4: Gemini 4 Hydrogen detecting viral hooks, humor & pacing arcs...');

      const response = await fetch('/api/analyze-highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: video.title,
          description: video.description,
          transcript: video.transcript,
          fullDuration: video.duration,
          filter: options.focusCategory,
          targetLength: options.targetLength,
          chapters,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gemini highlight detection failed.');
      }

      if (!data.clips || data.clips.length === 0) {
        throw new Error('Gemini did not return any highlight clips for this video.');
      }

      let finalClips: ClipHighlight[] = data.clips.map((c: any, idx: number) => ({
        id: c.id || `clip-${Date.now()}-${idx}`,
        title: c.title || `Viral Short #${idx + 1}`,
        hook: c.hook || 'Wait till you see this!',
        reason: c.reason || 'High retention hook and emotional climax.',
        category: c.category || 'highlight',
        startTime: Math.max(0, Math.min(Number(c.startTime) || 0, Math.max(0, video.duration - 8))),
        endTime: Math.min(Number(c.endTime) || Math.min(35, video.duration), video.duration),
        viralityScore: c.viralityScore || 92,
        hookScore: c.hookScore || 94,
        flowScore: c.flowScore || 91,
        emotionScore: c.emotionScore || 90,
        framingSuggestion: c.framingSuggestion || 'smart_crop',
        emojis: c.emojis || ['🔥', '👀'],
        hashtags: c.hashtags || ['#shorts', '#viral', '#fyp'],
        recommendedMusicTempo: c.recommendedMusicTempo || 'upbeat',
        captions: c.captions || [
          { start: 0, end: 4, text: c.hook || c.title, emphasisWord: 'VIRAL' },
        ],
      }));

      // Step 4: FFmpeg 9:16 Vertical Video Clipping
      setProcessingProgress(84);
      setProcessingStep(`4/4: Rendering ${finalClips.length} real 9:16 vertical MP4 clips with FFmpeg...`);

      const autoRes = await fetch('/api/auto-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: video.videoUrl,
          playableSourceUrl: video.playableSourceUrl,
          youtubeUrl: video.youtubeUrl,
          clips: finalClips,
        }),
      });

      const autoData = await autoRes.json();
      if (autoRes.ok && Array.isArray(autoData.clips)) {
        finalClips = finalClips.map((c) => {
          const matched = autoData.clips.find((m: any) => m.id === c.id);
          return matched && matched.clipVideoUrl
            ? { ...c, clipVideoUrl: matched.clipVideoUrl, downloadUrl: matched.downloadUrl }
            : c;
        });
      } else if (!video.playableSourceUrl) {
        throw new Error(autoData.error || 'Server could not render 9:16 MP4 clips from this video URL.');
      }

      if (video.sourceType === 'youtube' && !video.playableSourceUrl && finalClips[0]?.clipVideoUrl) {
        video.videoUrl = finalClips[0].clipVideoUrl;
      }

      video = {
        ...video,
        aiSummary: data.summary || '',
        highlights: finalClips,
      };

      setProcessingProgress(100);
      setProcessingStep('Done! Opening Clips Feed...');

      setTimeout(() => {
        setCurrentVideo(video);
        if (finalClips.length > 0) {
          setActiveClip(finalClips[0]);
          setSettings((prev) => ({
            ...prev,
            hookBannerText: finalClips[0].hook,
            framingMode: finalClips[0].framingSuggestion || prev.framingMode,
          }));
          setCurrentTime(finalClips[0].startTime);
        }
        setIsProcessing(false);
        setIsAiScanning(false);
        setAppMode('feed');
        showToast(`Extracted and clipped ${finalClips.length} viral 9:16 shorts with Gemini.`);
      }, 350);
    } catch (err: any) {
      console.error('Pipeline error:', err);
      setPipelineError(err.message || 'Video clipping failed. Please check the URL or try again.');
      setIsProcessing(false);
      setIsAiScanning(false);
      setAppMode('generator');
    }
  };

  const handleUpdateCaptions = (newCaptions: any[]) => {
    setActiveClip((prev) => {
      const updated = { ...prev, captions: newCaptions };
      setCurrentVideo((v) => ({
        ...v,
        highlights: v.highlights.map((h) => (h.id === updated.id ? updated : h)),
      }));
      return updated;
    });
  };

  const relTimeInClip = Math.max(0, currentTime - activeClip.startTime);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-violet-500 selection:text-white">
      {/* Header */}
      <Header
        currentVideo={currentVideo}
        activeClip={activeClip}
        appMode={appMode}
        onSetAppMode={setAppMode}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col min-h-0">
        {/* Mode 1: Generator Landing */}
        {appMode === 'generator' && (
          <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full py-4">
            <OpusClipHero
              onGenerateClips={handleGenerateClips}
              isProcessing={isProcessing}
              processingStep={processingStep}
              processingProgress={processingProgress}
              pipelineError={pipelineError}
              onDismissError={() => setPipelineError(null)}
            />
          </div>
        )}

        {/* Mode 2: Opus Clip Results Feed */}
        {appMode === 'feed' && (
          <div className="space-y-6">
            <OpusClipFeed
              videoSource={currentVideo}
              highlights={currentVideo.highlights}
              onSelectClipToEdit={handleSelectClipToEdit}
              onOpenExportModal={(clip) => {
                handleSelectClip(clip);
                setIsExportModalOpen(true);
              }}
              onNewVideo={() => setAppMode('generator')}
              onClipUpdated={handleClipUpdated}
            />
          </div>
        )}

        {/* Mode 3: Studio Editor */}
        {appMode === 'studio' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => setAppMode('feed')}
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to All Clips ({currentVideo.highlights.length})</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="text-xs text-zinc-400 flex items-center gap-2 max-w-md truncate">
                  <span>Active Clip:</span>
                  <span className="text-zinc-200 font-semibold truncate">{activeClip.title}</span>
                </div>

                <button
                  onClick={handleReclipInStudio}
                  disabled={isReclippingStudio}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  title="Re-render 9:16 MP4 with current trim & framing"
                >
                  {isReclippingStudio ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 text-violet-400" />
                  )}
                  <span>{isReclippingStudio ? 'Rendering...' : 'Apply Trim 9:16'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 min-h-[640px]">
              {/* Left Column: Viral Highlights Picker */}
              <section className="lg:col-span-3 h-[420px] lg:h-[calc(100vh-170px)] flex flex-col min-h-0">
                <HighlightList
                  highlights={currentVideo.highlights}
                  activeClip={activeClip}
                  onSelectClip={handleSelectClip}
                  onTriggerAiScan={() =>
                    handleGenerateClips({
                      videoSource: currentVideo,
                      focusCategory: 'all',
                      targetLength: 'auto',
                    })
                  }
                  isAiScanning={isAiScanning}
                />
              </section>

              {/* Center Column: 9:16 Vertical Video Studio Player + Trimmer */}
              <section className="lg:col-span-5 flex flex-col space-y-3 min-h-0">
                <div className="flex-1 min-h-[460px]">
                  <VerticalStudioPreview
                    videoUrl={currentVideo.videoUrl}
                    playableSourceUrl={currentVideo.playableSourceUrl}
                    youtubeUrl={currentVideo.youtubeUrl}
                    thumbnail={currentVideo.thumbnail}
                    activeClip={activeClip}
                    settings={settings}
                    onUpdateSettings={handleUpdateSettings}
                    videoRef={videoRef}
                    onTimeUpdate={(t) => setCurrentTime(t)}
                  />
                </div>

                <div className="shrink-0">
                  <TimelineTrimmer
                    totalVideoDuration={currentVideo.duration}
                    activeClip={activeClip}
                    currentTime={currentTime}
                    onUpdateClipTime={handleUpdateClipTime}
                    onSeek={handleSeek}
                  />
                </div>
              </section>

              {/* Right Column: Style & Script Tabs */}
              <section className="lg:col-span-4 h-[550px] lg:h-[calc(100vh-170px)] flex flex-col space-y-3 min-h-0">
                <div className="flex p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg shrink-0">
                  <button
                    onClick={() => setRightPanelTab('style')}
                    className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      rightPanelTab === 'style'
                        ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Caption Styles</span>
                  </button>

                  <button
                    onClick={() => setRightPanelTab('transcript')}
                    className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      rightPanelTab === 'transcript'
                        ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Dialogue ({activeClip.captions.length})</span>
                  </button>
                </div>

                <div className="flex-1 min-h-0">
                  {rightPanelTab === 'style' ? (
                    <CaptionStyleCustomizer
                      settings={settings}
                      activeClip={activeClip}
                      onUpdateSettings={handleUpdateSettings}
                    />
                  ) : (
                    <TranscriptEditor
                      activeClip={activeClip}
                      onUpdateCaptions={handleUpdateCaptions}
                      onSeek={handleSeek}
                      currentTimeInClip={relTimeInClip}
                    />
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Video Import Modal */}
      <VideoImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSelectVideo={(v) => {
          handleGenerateClips({
            videoSource: v,
            focusCategory: 'all',
            targetLength: 'auto',
          });
        }}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        activeClip={activeClip}
        videoSource={currentVideo}
        settings={settings}
        videoRef={videoRef}
      />

      {/* Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl text-xs font-medium text-zinc-100 animate-in slide-in-from-bottom duration-200">
          <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
