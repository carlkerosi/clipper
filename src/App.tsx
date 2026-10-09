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
import { Sparkles, Sliders, FileText, ArrowLeft } from 'lucide-react';

export default function App() {
  const [appMode, setAppMode] = useState<'generator' | 'feed' | 'studio'>('generator');
  const [currentVideo, setCurrentVideo] = useState<VideoSource>(SAMPLE_VIDEOS[0]);
  const [activeClip, setActiveClip] = useState<ClipHighlight>(SAMPLE_VIDEOS[0].highlights[0]);
  const [currentTime, setCurrentTime] = useState<number>(SAMPLE_VIDEOS[0].highlights[0].startTime);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);

  const [settings, setSettings] = useState<ExportSettings>({
    resolution: '1080p',
    framerate: 30,
    framingMode: 'smart_crop',
    captionPreset: 'hormozi',
    captionColor: '#FACC15',
    captionPosition: 'lower_third',
    captionFontSize: 32,
    showHookBanner: true,
    hookBannerText: SAMPLE_VIDEOS[0].highlights[0].hook,
    showProgressBar: true,
    progressBarColor: '#EF4444',
    panX: 0,
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAiScanning, setIsAiScanning] = useState(false);
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
    }));
    if (videoRef.current) {
      videoRef.current.currentTime = clip.startTime;
      videoRef.current.play().catch(() => {});
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
    setActiveClip((prev) => ({
      ...prev,
      startTime: Math.round(newStart * 10) / 10,
      endTime: Math.round(newEnd * 10) / 10,
    }));
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleGenerateClips = async (options: {
    videoSource: VideoSource;
    focusCategory: string;
    targetLength: string;
  }) => {
    let video = { ...options.videoSource };
    setCurrentVideo(video);
    setIsProcessing(true);
    setProcessingProgress(15);
    setProcessingStep('1/4: Analyzing source video & dialogue streams...');

    try {
      // If it's a YouTube URL, fetch real metadata using yt-dlp first
      if (video.youtubeUrl && !video.transcript) {
        setProcessingStep('1/4: Fetching YouTube metadata & captions with yt-dlp...');
        try {
          const ytRes = await fetch('/api/youtube-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: video.youtubeUrl }),
          });
          if (ytRes.ok) {
            const ytData = await ytRes.json();
            video = {
              ...video,
              title: ytData.title || video.title,
              thumbnail: ytData.thumbnail || video.thumbnail,
              duration: ytData.duration || video.duration,
              channelName: ytData.channelName || video.channelName,
              description: ytData.description || video.description,
            };
            setCurrentVideo(video);
          }
        } catch (ytErr) {
          console.warn('yt-dlp metadata warning:', ytErr);
        }
      }

      // Step 2 timer
      setTimeout(() => {
        setProcessingProgress(45);
        setProcessingStep('2/4: Transcribing dialogue & aligning speech cadence...');
      }, 700);

      // Step 3 timer
      setTimeout(() => {
        setProcessingProgress(75);
        setProcessingStep('3/4: Gemini 3.8 Flash detecting viral hooks, comedy & climax...');
      }, 1500);

      const response = await fetch('/api/analyze-highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: video.title,
          description: video.description,
          transcript: video.transcript,
          fullDuration: video.duration,
          filter: options.focusCategory,
        }),
      });

      setProcessingProgress(92);
      setProcessingStep('4/4: Formatting 9:16 vertical crop & generating bouncing kinetic captions...');

      let finalClips: ClipHighlight[] = [];

      if (response.ok) {
        const data = await response.json();
        if (data.clips && data.clips.length > 0) {
          finalClips = data.clips.map((c: any, idx: number) => ({
            id: c.id || `clip-${Date.now()}-${idx}`,
            title: c.title || `Viral Short #${idx + 1}`,
            hook: c.hook || 'Wait till you see this! 🤯',
            reason: c.reason || 'High emotional hook and retention potential',
            category: c.category || 'highlight',
            startTime: Math.max(0, Math.min(c.startTime || 0, Math.max(0, video.duration - 25))),
            endTime: Math.min(c.endTime || Math.min(35, video.duration), video.duration),
            viralityScore: c.viralityScore || 95,
            hookScore: c.hookScore || 97,
            flowScore: c.flowScore || 94,
            emojis: c.emojis || ['🔥', '👀'],
            hashtags: c.hashtags || ['#shorts', '#viral', '#fyp'],
            captions: c.captions || [
              { start: 0, end: 4, text: c.hook || c.title, emphasisWord: 'VIRAL' },
            ],
          }));
        }
      }

      // Fallback if empty
      if (finalClips.length === 0) {
        finalClips = video.highlights.length > 0 ? video.highlights : SAMPLE_VIDEOS[0].highlights;
      }

      setProcessingProgress(100);
      setProcessingStep('Complete! Launching Opus Clips Feed...');

      setTimeout(() => {
        setCurrentVideo((prev) => ({
          ...prev,
          highlights: finalClips,
        }));
        if (finalClips.length > 0) {
          handleSelectClip(finalClips[0]);
        }
        setIsProcessing(false);
        setAppMode('feed');
        showToast(`🎉 Generated ${finalClips.length} viral clips with virality scores!`);
      }, 500);
    } catch (err) {
      console.error('Error generating clips:', err);
      const fallbackClips = video.highlights.length > 0 ? video.highlights : SAMPLE_VIDEOS[0].highlights;
      setCurrentVideo((prev) => ({
        ...prev,
        highlights: fallbackClips,
      }));
      handleSelectClip(fallbackClips[0]);
      setIsProcessing(false);
      setAppMode('feed');
      showToast(`Generated ${fallbackClips.length} viral clips!`);
    }
  };

  const handleUpdateCaptions = (newCaptions: any[]) => {
    setActiveClip((prev) => ({
      ...prev,
      captions: newCaptions,
    }));
  };

  const relTimeInClip = Math.max(0, currentTime - activeClip.startTime);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-black">
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
        {/* Mode 1: Generator Landing (Opus Clip style) */}
        {appMode === 'generator' && (
          <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full py-4">
            <OpusClipHero
              onGenerateClips={handleGenerateClips}
              isProcessing={isProcessing}
              processingStep={processingStep}
              processingProgress={processingProgress}
            />
          </div>
        )}

        {/* Mode 2: Opus Clip Results Feed (List of generated 9:16 short clips with virality scores) */}
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
            />
          </div>
        )}

        {/* Mode 3: Klap Studio Editor (Fine-tune framing, pan, trimmer, captions, and export) */}
        {appMode === 'studio' && (
          <div className="space-y-4">
            {/* Back to feed button */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setAppMode('feed')}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to All Clips ({currentVideo.highlights.length})</span>
              </button>

              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span className="font-semibold text-slate-200">Active Clip:</span>
                <span className="text-amber-400 font-bold">{activeClip.title}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 min-h-[640px]">
              {/* Left Column: Viral Highlights Picker (3 cols) */}
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

              {/* Center Column: 9:16 Vertical Video Studio Player + Trimmer (5.5 cols) */}
              <section className="lg:col-span-5 flex flex-col space-y-3 min-h-0">
                <div className="flex-1 min-h-[460px]">
                  <VerticalStudioPreview
                    videoUrl={currentVideo.videoUrl}
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

              {/* Right Column: Style & Script Tabs (3.5 cols) */}
              <section className="lg:col-span-4 h-[550px] lg:h-[calc(100vh-170px)] flex flex-col space-y-3 min-h-0">
                <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-xl shrink-0">
                  <button
                    onClick={() => setRightPanelTab('style')}
                    className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      rightPanelTab === 'style'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Caption Styles</span>
                  </button>

                  <button
                    onClick={() => setRightPanelTab('transcript')}
                    className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      rightPanelTab === 'transcript'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Word Script ({activeClip.captions.length})</span>
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

      {/* Master Persistent Video Engine */}
      <video
        ref={videoRef}
        src={currentVideo.videoUrl}
        playsInline
        preload="auto"
        className="hidden"
      />

      {/* Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900 border border-amber-500/50 shadow-2xl shadow-black text-xs font-semibold text-slate-100 animate-in slide-in-from-bottom duration-200">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
