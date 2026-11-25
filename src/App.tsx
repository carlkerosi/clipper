import React, { useState, useRef, useEffect } from 'react';
import { SAMPLE_VIDEOS } from './data/sampleVideos';
import { VideoSource, ClipHighlight, ExportSettings, ClipGenerationOptions } from './types';
import { ExportPlatform, PLATFORM_PRESETS } from './utils/platformExport';
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
import { VideoEffectsPanel } from './components/VideoEffectsPanel';
import { AiDirectorDrawer, DirectorActions } from './components/AiDirectorDrawer';
import { MonitoringDashboard } from './components/MonitoringDashboard';
import { AddSocialAccountModal } from './components/AddSocialAccountModal';
import { useFirebase } from './contexts/FirebaseContext';
import { parseJsonResponse } from './utils/safeFetchJson';
import { Sparkles, Sliders, FileText, ArrowLeft, RefreshCw, Loader2, Palette, Zap } from 'lucide-react';

export default function App() {
  const [appMode, setAppMode] = useState<'generator' | 'feed' | 'studio' | 'dashboard'>('generator');
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
    captionPreset: 'opus_box',
    captionHighlightStyle: 'active_box',
    captionColor: '#22C55E',
    captionBaseColor: '#FFFFFF',
    captionFontFamily: 'Montserrat',
    captionTextCase: 'uppercase',
    captionOutlineWidth: 6,
    captionWordsPerLine: 'multi_line',
    captionDropShadow: true,
    captionPosition: 'lower_third',
    captionFontSize: 32,
    captionEntranceAnim: 'pop',
    captionExitAnim: 'fade',
    showHookBanner: false,
    hookBannerText: SAMPLE_VIDEOS[0].highlights[0].hook,
    showProgressBar: true,
    progressBarColor: '#22C55E',
    panX: 0,
    videoFilter: 'none',
    filterBrightness: 100,
    filterContrast: 100,
    filterSaturate: 100,
    playbackSpeed: 1,
    normalizeAudio: false,
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportInitialPlatform, setExportInitialPlatform] = useState<ExportPlatform>('tiktok');
  const [exportAutoStartNonce, setExportAutoStartNonce] = useState(0);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountModalPlatform, setAccountModalPlatform] = useState<ExportPlatform>('shorts');
  const [isDirectorOpen, setIsDirectorOpen] = useState(false);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [isReclippingStudio, setIsReclippingStudio] = useState(false);
  const [aiBoostingClipId, setAiBoostingClipId] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<'style' | 'effects' | 'transcript'>('style');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { user, workspacePrefs, workspacePrefsLoaded, updateWorkspacePrefs } = useFirebase();
  const appliedInitialPrefsUidRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Hydrate saved caption + video filter preset once per signed-in session
  useEffect(() => {
    if (!user) {
      appliedInitialPrefsUidRef.current = null;
      return;
    }
    if (!workspacePrefsLoaded || appliedInitialPrefsUidRef.current === user.uid) {
      return;
    }
    appliedInitialPrefsUidRef.current = user.uid;
    if (workspacePrefs.autoApplyStyleAcrossClips) {
      setSettings((prev) => ({
        ...prev,
        captionPreset: workspacePrefs.captionPreset || prev.captionPreset,
        captionColor: workspacePrefs.captionColor || prev.captionColor,
        captionHighlightStyle:
          workspacePrefs.captionHighlightStyle || prev.captionHighlightStyle,
        videoFilter: workspacePrefs.videoFilter || prev.videoFilter,
      }));
    }
  }, [user, workspacePrefsLoaded, workspacePrefs]);

  // Persist style changes automatically when autoApplyStyleAcrossClips is active
  useEffect(() => {
    if (
      !user ||
      !workspacePrefsLoaded ||
      appliedInitialPrefsUidRef.current !== user.uid ||
      !workspacePrefs.autoApplyStyleAcrossClips
    ) {
      return;
    }
    const nextFilter = settings.videoFilter || 'none';
    const nextHighlight = settings.captionHighlightStyle || 'active_box';
    const unchanged =
      workspacePrefs.captionPreset === settings.captionPreset &&
      workspacePrefs.captionColor === settings.captionColor &&
      workspacePrefs.captionHighlightStyle === nextHighlight &&
      workspacePrefs.videoFilter === nextFilter;

    if (unchanged) return;

    const timer = setTimeout(() => {
      updateWorkspacePrefs({
        captionPreset: settings.captionPreset,
        captionColor: settings.captionColor,
        captionHighlightStyle: nextHighlight,
        videoFilter: nextFilter,
      }).catch(() => {});
    }, 700);

    return () => clearTimeout(timer);
  }, [
    user,
    workspacePrefsLoaded,
    workspacePrefs.autoApplyStyleAcrossClips,
    workspacePrefs.captionPreset,
    workspacePrefs.captionColor,
    workspacePrefs.captionHighlightStyle,
    workspacePrefs.videoFilter,
    settings.captionPreset,
    settings.captionColor,
    settings.captionHighlightStyle,
    settings.videoFilter,
    updateWorkspacePrefs,
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleQuickExportPlatform = (platform: ExportPlatform, clipOverride?: ClipHighlight) => {
    const targetClip = clipOverride || activeClip;
    if (!targetClip) return;
    if (clipOverride) {
      handleSelectClip(clipOverride);
    }
    setExportInitialPlatform(platform);
    setExportAutoStartNonce((n) => n + 1);
    setIsExportModalOpen(true);
    const preset = PLATFORM_PRESETS[platform];
    showToast(`Quick exporting ${preset.label} (${preset.shortcut})...`);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (appMode === 'generator' || isProcessing || !activeClip) return;
      if (e.ctrlKey || e.metaKey || e.altKey || !e.shiftKey) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'y') {
        e.preventDefault();
        handleQuickExportPlatform('shorts');
      } else if (key === 't') {
        e.preventDefault();
        handleQuickExportPlatform('tiktok');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appMode, isProcessing, activeClip]);

  const handleSelectClip = (clip: ClipHighlight) => {
    setActiveClip(clip);
    setSettings((prev) => ({
      ...prev,
      hookBannerText: clip.hook,
      framingMode: workspacePrefs.autoApplyAiFraming
        ? clip.framingSuggestion || prev.framingMode
        : prev.framingMode,
      panX:
        workspacePrefs.autoApplyAiFraming && typeof clip.panX === 'number'
          ? clip.panX
          : prev.panX,
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
    if (currentVideo.youtubeDownloadBlocked && !currentVideo.playableSourceUrl && !activeClip.clipVideoUrl) {
      showToast('Trim timestamps updated on live YouTube 9:16 player. Upload an MP4 to render a standalone file.');
      return;
    }
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
          burnCaptions: false,
          captionColor: settings.captionColor,
          captionBaseColor: settings.captionBaseColor,
          captionFontFamily: settings.captionFontFamily,
          captionTextCase: settings.captionTextCase,
          captionOutlineWidth: settings.captionOutlineWidth,
          captionDropShadow: settings.captionDropShadow,
          videoFilter: settings.videoFilter || 'none',
          filterBrightness: settings.filterBrightness ?? 100,
          filterContrast: settings.filterContrast ?? 100,
          filterSaturate: settings.filterSaturate ?? 100,
          playbackSpeed: settings.playbackSpeed ?? 1,
          normalizeAudio: Boolean(settings.normalizeAudio),
          showHookBanner: Boolean(settings.showHookBanner),
          hookBannerText: settings.hookBannerText || activeClip.hook,
        }),
      });
      const data = await parseJsonResponse(res, 'Failed to re-clip segment');
      if (!res.ok || !data.downloadUrl) {
        throw new Error(data.error || 'Failed to re-clip segment');
      }
      handleClipUpdated({
        ...activeClip,
        clipVideoUrl: data.downloadUrl,
        downloadUrl: data.downloadUrl,
      });
      showToast('Re-rendered 9:16 clip with updated trim, grade & pacing.');
    } catch (err: any) {
      showToast(err.message || 'Could not re-clip segment.');
    } finally {
      setIsReclippingStudio(false);
    }
  };

  const handleCreateCustomClip = () => {
    const total = Math.max(10, currentVideo.duration || 60);
    const start = Math.max(0, Math.min(total - 8, Math.round(currentTime * 10) / 10));
    const end = Math.min(total, Math.round((start + 25) * 10) / 10);
    const dur = Math.max(5, end - start);
    const newClip: ClipHighlight = {
      id: `custom-${Date.now()}`,
      title: `Custom Clip @ ${Math.floor(start / 60)}:${String(Math.floor(start % 60)).padStart(2, '0')}`,
      hook: 'Watch until the end',
      reason: 'Manually marked custom clip range from Studio timeline.',
      category: 'highlight',
      startTime: start,
      endTime: end,
      viralityScore: 90,
      framingSuggestion: settings.framingMode,
      panX: settings.panX,
      emojis: ['🔥'],
      hashtags: ['#shorts', '#viral'],
      captions: [
        {
          start: 0,
          end: Math.min(4, dur),
          text: 'Edit these captions in the Dialogue tab',
          emphasisWord: 'CAPTIONS',
        },
      ],
    };
    setCurrentVideo((prev) => ({
      ...prev,
      highlights: [newClip, ...prev.highlights],
    }));
    handleSelectClip(newClip);
    showToast('Created custom clip at current playhead.');
  };

  const handleDuplicateClip = (clip: ClipHighlight) => {
    const copy: ClipHighlight = {
      ...clip,
      id: `copy-${Date.now()}`,
      title: `${clip.title} (Copy)`,
      clipVideoUrl: undefined,
      downloadUrl: undefined,
    };
    setCurrentVideo((prev) => ({
      ...prev,
      highlights: [copy, ...prev.highlights],
    }));
    handleSelectClip(copy);
    showToast(`Duplicated "${clip.title}"`);
  };

  const handleDeleteClip = (clipId: string) => {
    if (currentVideo.highlights.length <= 1) return;
    const remaining = currentVideo.highlights.filter((h) => h.id !== clipId);
    setCurrentVideo((prev) => ({
      ...prev,
      highlights: remaining,
    }));
    if (activeClip.id === clipId && remaining[0]) {
      handleSelectClip(remaining[0]);
    }
    showToast('Removed clip from library.');
  };

  const handleStudioAiBoost = async (clip: ClipHighlight) => {
    if (aiBoostingClipId) return;
    setAiBoostingClipId(clip.id);
    try {
      const res = await fetch('/api/ai-optimize-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip,
          videoTitle: currentVideo.title,
          fullDuration: currentVideo.duration,
          transcript: currentVideo.transcript,
        }),
      });
      const data = await parseJsonResponse(res, 'AI Retention Boost failed');
      if (!res.ok) {
        throw new Error(data.error || 'AI Retention Boost failed');
      }
      const updatedClip: ClipHighlight = {
        ...clip,
        title: data.improvedTitle || clip.title,
        hook: data.improvedHook || clip.hook,
        reason: data.improvedReason || clip.reason,
        startTime:
          typeof data.recommendedStartTime === 'number'
            ? data.recommendedStartTime
            : clip.startTime,
        endTime:
          typeof data.recommendedEndTime === 'number'
            ? data.recommendedEndTime
            : clip.endTime,
        viralityScore: data.boostedViralityScore || clip.viralityScore,
        hookScore: data.boostedHookScore || clip.hookScore,
        flowScore: data.boostedFlowScore || clip.flowScore,
        framingSuggestion: data.recommendedFraming || clip.framingSuggestion,
        hashtags: Array.isArray(data.hashtags) ? data.hashtags : clip.hashtags,
        captions:
          Array.isArray(data.captions) && data.captions.length > 0
            ? data.captions
            : clip.captions,
      };
      handleClipUpdated(updatedClip);
      if (clip.id === activeClip.id) {
        handleUpdateSettings({
          hookBannerText: updatedClip.hook,
          showHookBanner: true,
          captionPreset: data.recommendedCaptionPreset || settings.captionPreset,
          videoFilter: data.recommendedFilter || settings.videoFilter,
          playbackSpeed: data.recommendedSpeed || settings.playbackSpeed,
          framingMode: data.recommendedFraming || settings.framingMode,
        });
      }
      showToast(data.retentionCritique || 'AI Retention Boost applied!');
    } catch (err: any) {
      showToast(err?.message || 'AI Retention Boost failed.');
    } finally {
      setAiBoostingClipId(null);
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

  const handleGenerateClips = async (options: ClipGenerationOptions) => {
    let video: VideoSource = { ...options.videoSource };
    let chapters: any[] = [];
    const appendMode = Boolean(options.appendExisting && video.highlights?.length > 0);
    const existingHighlights = appendMode ? [...video.highlights] : [];

    setPipelineError(null);
    setCurrentVideo(video);
    if (!appendMode) {
      setIsProcessing(true);
    }
    setIsAiScanning(true);
    setProcessingProgress(12);
    setProcessingStep('1/4: Ingesting source video metadata & stream...');

    try {
      // Step 1: Ingest YouTube OR generic Web/Direct video URL
      if (!appendMode && video.sourceType === 'youtube' && video.youtubeUrl) {
        setProcessingStep('1/4: Extracting YouTube video, captions & stream...');
        const ytRes = await fetch('/api/youtube-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: video.youtubeUrl }),
        });

        const ytData = await parseJsonResponse(ytRes, 'Could not retrieve YouTube video info');
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
          youtubeVideoId: ytData.videoId || video.youtubeVideoId,
          youtubeDownloadBlocked: Boolean(ytData.youtubeDownloadBlocked && !ytData.playableSourceUrl),
        };
        setCurrentVideo(video);
      } else if (!appendMode && video.sourceType === 'url' && video.videoUrl && !video.playableSourceUrl) {
        setProcessingStep('1/4: Downloading & probing external video URL...');
        const urlRes = await fetch('/api/ingest-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: video.videoUrl }),
        });

        const urlData = await parseJsonResponse(urlRes, 'Could not ingest external video URL');
        if (!urlRes.ok || !urlData.playableSourceUrl) {
          throw new Error(urlData.error || 'Could not ingest external video URL.');
        }

        video = {
          ...video,
          title: urlData.title || video.title,
          thumbnail: urlData.thumbnail || video.thumbnail,
          duration: urlData.duration || video.duration,
          channelName: urlData.channelName || video.channelName,
          description: urlData.description || video.description,
          transcript: video.transcript || urlData.transcript || '',
          videoUrl: urlData.playableSourceUrl,
          playableSourceUrl: urlData.playableSourceUrl,
        };
        setCurrentVideo(video);
      } else if (!video.playableSourceUrl && video.videoUrl.startsWith('/')) {
        video.playableSourceUrl = video.videoUrl;
      }

      // Step 2: Multimodal Speech Transcription + Keyframe Visual Inspection
      const hasTranscript = Boolean(video.transcript && video.transcript.trim().length >= 40);
      setProcessingProgress(36);
      if (!hasTranscript || !video.visualSummary) {
        const canTranscribeSource = Boolean(
          video.playableSourceUrl || (video.youtubeUrl && !video.youtubeDownloadBlocked)
        );
        if (canTranscribeSource) {
          setProcessingStep(
            hasTranscript
              ? '2/4: Inspecting visual keyframes for 9:16 smart framing...'
              : '2/4: Gemini AI listening to audio & analyzing visual keyframes...'
          );
          const trRes = await fetch('/api/transcribe-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoUrl: video.videoUrl,
              playableSourceUrl: video.playableSourceUrl,
              youtubeUrl: video.youtubeUrl,
              youtubeDownloadBlocked: Boolean(video.youtubeDownloadBlocked),
              skipAudio: hasTranscript,
            }),
          });
          const trData = await parseJsonResponse(trRes, 'Video transcription failed');
          if (!trRes.ok) {
            if (trData.code === 'MISSING_API_KEY' || trData.code === 'API_KEY_INVALID' || trData.code === 'PERMISSION_DENIED') {
              throw new Error(trData.error);
            }
            console.warn('Transcription step notice:', trData.error);
          } else {
            video = {
              ...video,
              transcript: video.transcript || trData.transcript || '',
              visualSummary: video.visualSummary || trData.visualSummary || '',
              duration: trData.duration || video.duration,
            };
            setCurrentVideo(video);
          }
        }
      }

      // Step 3: Gemini 4 Hydrogen Unrestricted AI Highlight & Framing Detection
      setProcessingProgress(64);
      setProcessingStep(
        options.customPrompt
          ? `3/4: Gemini AI clipping "${options.customPrompt.slice(0, 42)}"...`
          : '3/4: Gemini 4 Hydrogen detecting hooks, visuals & pacing arcs...'
      );

      const response = await fetch('/api/analyze-highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: video.title,
          description: video.description,
          transcript: video.transcript,
          visualSummary: video.visualSummary,
          fullDuration: video.duration,
          filter: options.focusCategory,
          targetLength: options.targetLength,
          customPrompt: options.customPrompt || '',
          clipCount: options.clipCount || 0,
          minDurationSec: options.minDurationSec || 0,
          maxDurationSec: options.maxDurationSec || 0,
          excludeRanges: appendMode
            ? existingHighlights.map((h) => ({ startTime: h.startTime, endTime: h.endTime }))
            : [],
          chapters,
        }),
      });

      const data = await parseJsonResponse(response, 'Gemini highlight detection failed');
      if (!response.ok) {
        throw new Error(data.error || 'Gemini highlight detection failed.');
      }

      if (!data.clips || data.clips.length === 0) {
        throw new Error('Gemini did not return any highlight clips for this request.');
      }

      let finalClips: ClipHighlight[] = data.clips.map((c: any, idx: number) => ({
        id: c.id || `clip-${Date.now()}-${idx}`,
        title: c.title || `Viral Short #${idx + 1}`,
        hook: c.hook || 'Wait till you see this!',
        reason: c.reason || 'High retention hook and emotional climax.',
        category: c.category || 'highlight',
        startTime: Math.max(0, Math.min(Number(c.startTime) || 0, Math.max(0, video.duration - 4))),
        endTime: Math.min(Number(c.endTime) || Math.min(35, video.duration), video.duration),
        viralityScore: c.viralityScore || 92,
        hookScore: c.hookScore || 94,
        flowScore: c.flowScore || 91,
        emotionScore: c.emotionScore || 90,
        framingSuggestion: c.framingSuggestion || 'smart_crop',
        panX: typeof c.panX === 'number' ? c.panX : 0,
        visualContext: c.visualContext,
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
          youtubeDownloadBlocked: Boolean(video.youtubeDownloadBlocked),
          clips: finalClips,
        }),
      });

      const autoData = await parseJsonResponse(autoRes, 'Auto-clipping failed');
      if (autoRes.ok && Array.isArray(autoData.clips)) {
        finalClips = finalClips.map((c) => {
          const matched = autoData.clips.find((m: any) => m.id === c.id);
          return matched && matched.clipVideoUrl
            ? { ...c, clipVideoUrl: matched.clipVideoUrl, downloadUrl: matched.downloadUrl }
            : c;
        });
        if (autoData.youtubeEmbedFallback) {
          video = { ...video, youtubeDownloadBlocked: true };
        }
      } else if (!video.playableSourceUrl) {
        throw new Error(autoData.error || 'Server could not render 9:16 MP4 clips from this video URL.');
      }

      if (video.sourceType === 'youtube' && !video.playableSourceUrl && finalClips[0]?.clipVideoUrl) {
        video.videoUrl = finalClips[0].clipVideoUrl;
      }

      const combinedClips = appendMode ? [...existingHighlights, ...finalClips] : finalClips;

      video = {
        ...video,
        aiSummary: data.summary || video.aiSummary || '',
        highlights: combinedClips,
      };

      setProcessingProgress(100);
      setProcessingStep('Done! Opening Clips Feed...');

      const finishUpdate = () => {
        setCurrentVideo(video);
        const focusClip = finalClips[0] || combinedClips[0];
        if (focusClip && !appendMode) {
          setActiveClip(focusClip);
          setSettings((prev) => ({
            ...prev,
            hookBannerText: focusClip.hook,
            framingMode: workspacePrefs.autoApplyAiFraming
              ? focusClip.framingSuggestion || prev.framingMode
              : prev.framingMode,
            panX:
              workspacePrefs.autoApplyAiFraming && typeof focusClip.panX === 'number'
                ? focusClip.panX
                : prev.panX,
          }));
          setCurrentTime(focusClip.startTime);
        }
        setIsProcessing(false);
        setIsAiScanning(false);
        if (!appendMode) {
          setAppMode('feed');
        }
        showToast(
          appendMode
            ? `Added ${finalClips.length} new AI-clipped shorts!`
            : `Extracted and clipped ${finalClips.length} 9:16 shorts with Gemini AI.`
        );
      };

      if (appendMode) {
        finishUpdate();
      } else {
        setTimeout(finishUpdate, 300);
      }
    } catch (err: any) {
      console.error('Pipeline error:', err);
      const errMsg = err.message || 'Video clipping failed. Please check the URL or try again.';
      setIsProcessing(false);
      setIsAiScanning(false);
      if (appendMode) {
        showToast(errMsg);
      } else {
        setPipelineError(errMsg);
        setAppMode('generator');
      }
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

  const handleApplyDirectorActions = (actions: DirectorActions): string[] => {
    const summary: string[] = [];
    const nextSettings: Partial<ExportSettings> = {};

    if (typeof actions.hookBannerText === 'string' && actions.hookBannerText.trim()) {
      nextSettings.hookBannerText = actions.hookBannerText.trim();
      nextSettings.showHookBanner = true;
      summary.push(`Hook -> "${actions.hookBannerText.trim()}"`);
    }
    if (typeof actions.showHookBanner === 'boolean') {
      nextSettings.showHookBanner = actions.showHookBanner;
    }
    if (actions.framingMode) {
      nextSettings.framingMode = actions.framingMode;
      summary.push(`Framing -> ${actions.framingMode}`);
    }
    if (typeof actions.panX === 'number') {
      nextSettings.panX = Math.max(-100, Math.min(100, Math.round(actions.panX)));
      summary.push(`Pan -> ${nextSettings.panX}%`);
    }
    if (actions.captionPreset) {
      nextSettings.captionPreset = actions.captionPreset;
      summary.push(`Caption Preset -> ${actions.captionPreset}`);
    }
    if (actions.captionColor) {
      nextSettings.captionColor = actions.captionColor;
    }
    if (actions.captionEntranceAnim) {
      nextSettings.captionEntranceAnim = actions.captionEntranceAnim;
    }
    if (actions.captionExitAnim) {
      nextSettings.captionExitAnim = actions.captionExitAnim;
    }
    if (actions.videoFilter) {
      nextSettings.videoFilter = actions.videoFilter;
      summary.push(`Color Grade -> ${actions.videoFilter}`);
    }
    if (typeof actions.filterBrightness === 'number') {
      nextSettings.filterBrightness = Math.max(50, Math.min(150, Math.round(actions.filterBrightness)));
    }
    if (typeof actions.filterContrast === 'number') {
      nextSettings.filterContrast = Math.max(50, Math.min(200, Math.round(actions.filterContrast)));
    }
    if (typeof actions.filterSaturate === 'number') {
      nextSettings.filterSaturate = Math.max(0, Math.min(200, Math.round(actions.filterSaturate)));
    }

    if (Object.keys(nextSettings).length > 0) {
      handleUpdateSettings(nextSettings);
    }

    if (activeClip && (typeof actions.startTime === 'number' || typeof actions.endTime === 'number' || actions.newClipTitle || actions.hookBannerText)) {
      const nextStart = typeof actions.startTime === 'number' ? Math.max(0, Math.min(actions.startTime, currentVideo.duration - 4)) : activeClip.startTime;
      const nextEnd = typeof actions.endTime === 'number' ? Math.min(currentVideo.duration, Math.max(nextStart + 4, actions.endTime)) : activeClip.endTime;
      const updatedClip: ClipHighlight = {
        ...activeClip,
        startTime: nextStart,
        endTime: nextEnd,
        title: actions.newClipTitle ? actions.newClipTitle.trim() : activeClip.title,
        hook: actions.hookBannerText ? actions.hookBannerText.trim() : activeClip.hook,
      };
      handleClipUpdated(updatedClip);
      if (typeof actions.startTime === 'number' || typeof actions.endTime === 'number') {
        summary.push(`Trim -> ${Math.round(nextStart)}s–${Math.round(nextEnd)}s`);
      }
    }

    if (actions.triggerClipMorePrompt && actions.triggerClipMorePrompt.trim()) {
      summary.push(`Extracting new clips...`);
      handleGenerateClips({
        videoSource: currentVideo,
        focusCategory: 'all',
        targetLength: 'auto',
        customPrompt: actions.triggerClipMorePrompt.trim(),
        clipCount: 3,
        appendExisting: true,
      });
    }

    return summary;
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
        onQuickExportPlatform={
          appMode !== 'generator' && activeClip
            ? (platform) => handleQuickExportPlatform(platform)
            : undefined
        }
        onOpenAiDirector={() => setIsDirectorOpen(true)}
        onOpenAddSocialModal={() => {
          setAccountModalPlatform('shorts');
          setIsAccountModalOpen(true);
        }}
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
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onSelectClipToEdit={handleSelectClipToEdit}
              onOpenExportModal={(clip, platform) => {
                if (platform) {
                  handleQuickExportPlatform(platform, clip);
                } else {
                  handleSelectClip(clip);
                  setIsExportModalOpen(true);
                }
              }}
              onNewVideo={() => setAppMode('generator')}
              onOpenDashboard={() => setAppMode('dashboard')}
              onClipUpdated={handleClipUpdated}
              isAiGenerating={isAiScanning}
              onGenerateMoreClips={(customPrompt, clipCount) =>
                handleGenerateClips({
                  videoSource: currentVideo,
                  focusCategory: 'all',
                  targetLength: 'auto',
                  customPrompt,
                  clipCount,
                  appendExisting: true,
                })
              }
            />
          </div>
        )}

        {/* Mode 4: Accounts & Monitoring Dashboard */}
        {appMode === 'dashboard' && (
          <MonitoringDashboard
            currentVideo={currentVideo}
            highlights={currentVideo.highlights}
            onGoToClips={() => setAppMode('feed')}
            onNotify={showToast}
          />
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

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="text-xs text-zinc-400 flex items-center gap-2 max-w-md truncate">
                  <span>Active Clip:</span>
                  <span className="text-zinc-200 font-semibold truncate">{activeClip.title}</span>
                </div>

                <button
                  onClick={() => handleStudioAiBoost(activeClip)}
                  disabled={aiBoostingClipId === activeClip.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  title="Audit and boost hook, timing, captions & styling with Gemini AI"
                >
                  {aiBoostingClipId === activeClip.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                  <span>{aiBoostingClipId === activeClip.id ? 'Boosting...' : 'AI Boost Clip'}</span>
                </button>

                <button
                  onClick={handleReclipInStudio}
                  disabled={isReclippingStudio}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  title="Re-render 9:16 MP4 with current trim, grade, speed & framing"
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
                  onTriggerAiScan={(filter, customPrompt) =>
                    handleGenerateClips({
                      videoSource: currentVideo,
                      focusCategory: filter || 'all',
                      targetLength: 'auto',
                      customPrompt,
                      clipCount: 3,
                      appendExisting: true,
                    })
                  }
                  onCreateCustomClip={handleCreateCustomClip}
                  onDuplicateClip={handleDuplicateClip}
                  onDeleteClip={handleDeleteClip}
                  onAiBoostClip={handleStudioAiBoost}
                  aiBoostingClipId={aiBoostingClipId}
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
                    youtubeVideoId={currentVideo.youtubeVideoId}
                    youtubeDownloadBlocked={currentVideo.youtubeDownloadBlocked}
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

              {/* Right Column: Style, Video Effects & Script Tabs */}
              <section className="lg:col-span-4 h-[550px] lg:h-[calc(100vh-170px)] flex flex-col space-y-3 min-h-0">
                <div className="flex p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg shrink-0 gap-0.5">
                  <button
                    onClick={() => setRightPanelTab('style')}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      rightPanelTab === 'style'
                        ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Captions</span>
                  </button>

                  <button
                    onClick={() => setRightPanelTab('effects')}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      rightPanelTab === 'effects'
                        ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Video Effects</span>
                  </button>

                  <button
                    onClick={() => setRightPanelTab('transcript')}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
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
                  ) : rightPanelTab === 'effects' ? (
                    <VideoEffectsPanel
                      settings={settings}
                      onUpdateSettings={handleUpdateSettings}
                      videoUrl={currentVideo.videoUrl}
                      playableSourceUrl={currentVideo.playableSourceUrl}
                      videoTitle={currentVideo.title}
                      clipHook={activeClip.hook}
                      currentTimestamp={currentTime}
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

      {/* AI Studio Director Slide-Over */}
      <AiDirectorDrawer
        isOpen={isDirectorOpen}
        onClose={() => setIsDirectorOpen(false)}
        currentVideo={currentVideo}
        activeClip={activeClip}
        settings={settings}
        onApplyActions={handleApplyDirectorActions}
      />

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
        initialPlatform={exportInitialPlatform}
        autoStartNonce={exportAutoStartNonce}
        onManageAccounts={(platform) => {
          setIsExportModalOpen(false);
          setAccountModalPlatform(platform);
          setIsAccountModalOpen(true);
        }}
      />

      {/* Quick Connect Social Account Modal (accessible from Export Modal) */}
      <AddSocialAccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        initialPlatform={accountModalPlatform}
        onSaved={showToast}
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
