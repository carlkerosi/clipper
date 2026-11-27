import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SAMPLE_VIDEOS } from './data/sampleVideos';
import { VideoSource, ClipHighlight, ExportSettings, ClipGenerationOptions } from './types';
import { ExportPlatform, PLATFORM_PRESETS } from './utils/platformExport';
import { Header } from './components/Header';
import { OpusClipHero } from './components/OpusClipHero';
import { OpusClipFeed } from './components/OpusClipFeed';
import { HighlightList } from './components/HighlightList';
import { VerticalStudioPreview, TrimMarkerFeedback } from './components/VerticalStudioPreview';
import { CaptionStyleCustomizer } from './components/CaptionStyleCustomizer';
import { TimelineTrimmer } from './components/TimelineTrimmer';
import { TranscriptEditor } from './components/TranscriptEditor';
import { VideoImportModal } from './components/VideoImportModal';
import { ExportModal } from './components/ExportModal';
import { VideoEffectsPanel } from './components/VideoEffectsPanel';
import { TransitionsPanel } from './components/TransitionsPanel';
import { AiDirectorDrawer, DirectorActions } from './components/AiDirectorDrawer';
import { MonitoringDashboard } from './components/MonitoringDashboard';
import { AddSocialAccountModal } from './components/AddSocialAccountModal';
import { useFirebase } from './contexts/FirebaseContext';
import { parseJsonResponse } from './utils/safeFetchJson';
import {
  Sparkles,
  Sliders,
  FileText,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Palette,
  Zap,
  Save,
  RotateCcw,
  Trash2,
  Cloud,
  Blend,
} from 'lucide-react';

function buildDraftSignature(
  clip: ClipHighlight,
  settings: ExportSettings,
  videoId: string,
  mode: string,
  timeSec: number
): string {
  return JSON.stringify({
    videoId,
    mode,
    t: Math.round(timeSec),
    clip: {
      id: clip.id,
      title: clip.title,
      hook: clip.hook,
      startTime: clip.startTime,
      endTime: clip.endTime,
      panX: clip.panX,
      framingSuggestion: clip.framingSuggestion,
      clipVideoUrl: clip.clipVideoUrl,
      captions: clip.captions,
    },
    settings,
  });
}

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
    compilationTransition: 'none',
    transitionDuration: 0.6,
    wipeDirection: 'wipeleft',
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportInitialPlatform, setExportInitialPlatform] = useState<ExportPlatform>('tiktok');
  const [exportInitialSelectedClipIds, setExportInitialSelectedClipIds] = useState<string[] | undefined>(undefined);
  const [exportInitialMode, setExportInitialMode] = useState<'batch' | 'reel'>('batch');
  const [exportInitialResolution, setExportInitialResolution] = useState<'1080p' | '720p' | undefined>(undefined);
  const [exportInitialBurnCaptions, setExportInitialBurnCaptions] = useState<boolean | undefined>(undefined);
  const [exportAutoStartNonce, setExportAutoStartNonce] = useState(0);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountModalPlatform, setAccountModalPlatform] = useState<ExportPlatform>('shorts');
  const [isDirectorOpen, setIsDirectorOpen] = useState(false);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [isReclippingStudio, setIsReclippingStudio] = useState(false);
  const [aiBoostingClipId, setAiBoostingClipId] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<'style' | 'effects' | 'transitions' | 'transcript'>('style');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasActiveEditSession, setHasActiveEditSession] = useState(false);
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);
  const [syncCaptionsOnTrim, setSyncCaptionsOnTrim] = useState(true);
  const [trimFeedback, setTrimFeedback] = useState<TrimMarkerFeedback | null>(null);
  const [trimHistoryCount, setTrimHistoryCount] = useState(0);
  const [playToggleNonce, setPlayToggleNonce] = useState(0);

  const {
    user,
    signInWithGoogle,
    workspacePrefs,
    workspacePrefsLoaded,
    updateWorkspacePrefs,
    savedDraft,
    draftLoaded,
    isSavingDraft,
    lastDraftSavedAt,
    saveClipDraft,
    clearClipDraft,
  } = useFirebase();
  const appliedInitialPrefsUidRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trimHistoryRef = useRef<
    Array<{
      clipId: string;
      startTime: number;
      endTime: number;
      captions: ClipHighlight['captions'];
    }>
  >([]);
  const syncCaptionsOnTrimRef = useRef(syncCaptionsOnTrim);
  syncCaptionsOnTrimRef.current = syncCaptionsOnTrim;
  const lastSavedDraftSigRef = useRef<string>('');
  const latestDraftSnapshotRef = useRef({
    appMode,
    currentTime,
    currentVideo,
    activeClip,
    settings,
    hasActiveEditSession,
    isProcessing,
  });
  latestDraftSnapshotRef.current = {
    appMode,
    currentTime,
    currentVideo,
    activeClip,
    settings,
    hasActiveEditSession,
    isProcessing,
  };

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

  const performAutoDraftSave = useCallback(
    async (force = false): Promise<boolean> => {
      const snap = latestDraftSnapshotRef.current;
      if (!snap.hasActiveEditSession || snap.isProcessing) return false;
      if (snap.appMode !== 'studio' && snap.appMode !== 'feed') return false;

      const sig = buildDraftSignature(
        snap.activeClip,
        snap.settings,
        snap.currentVideo.id,
        snap.appMode,
        snap.currentTime
      );
      if (!force && sig === lastSavedDraftSigRef.current) return false;

      await saveClipDraft({
        appMode: snap.appMode,
        currentTime: snap.currentTime,
        video: snap.currentVideo,
        clip: snap.activeClip,
        settings: snap.settings,
      });
      lastSavedDraftSigRef.current = sig;
      return true;
    },
    [saveClipDraft]
  );

  // Auto-Draft: save current active clip editing state to Firestore every 30 seconds
  useEffect(() => {
    if (!hasActiveEditSession || (appMode !== 'studio' && appMode !== 'feed')) return;
    const intervalId = window.setInterval(() => {
      performAutoDraftSave(false).catch(() => {});
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [hasActiveEditSession, appMode, performAutoDraftSave]);

  // Flush unsaved draft when browser tab is hidden or closed
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        performAutoDraftSave(false).catch(() => {});
      }
    };
    const handlePageHide = () => {
      performAutoDraftSave(false).catch(() => {});
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [performAutoDraftSave]);

  const handleResumeDraft = () => {
    if (!savedDraft) return;
    const matchingSample = SAMPLE_VIDEOS.find((s) => s.id === savedDraft.video.id);
    const fallbackThumb = matchingSample?.thumbnail || SAMPLE_VIDEOS[0].thumbnail;
    const restoredHighlights = matchingSample
      ? matchingSample.highlights.map((h) => (h.id === savedDraft.clip.id ? savedDraft.clip : h))
      : [savedDraft.clip];
    if (matchingSample && !restoredHighlights.some((h) => h.id === savedDraft.clip.id)) {
      restoredHighlights.unshift(savedDraft.clip);
    }

    const restoredVideo: VideoSource = {
      ...savedDraft.video,
      thumbnail: savedDraft.video.thumbnail || fallbackThumb,
      playableSourceUrl: savedDraft.video.playableSourceUrl || savedDraft.video.videoUrl,
      highlights: restoredHighlights,
    };

    const nextMode: 'studio' | 'feed' = savedDraft.appMode === 'feed' ? 'feed' : 'studio';
    const resumeTime = savedDraft.currentTime || savedDraft.clip.startTime || 0;

    setCurrentVideo(restoredVideo);
    setActiveClip(savedDraft.clip);
    setSettings(savedDraft.settings);
    setCurrentTime(resumeTime);
    setHasActiveEditSession(true);
    setDraftBannerDismissed(true);
    lastSavedDraftSigRef.current = buildDraftSignature(
      savedDraft.clip,
      savedDraft.settings,
      restoredVideo.id,
      nextMode,
      resumeTime
    );
    setAppMode(nextMode);
    showToast(`Resumed "${savedDraft.clip.title}" from Auto-Draft.`);
  };

  const handleManualSaveDraft = async () => {
    try {
      setHasActiveEditSession(true);
      latestDraftSnapshotRef.current.hasActiveEditSession = true;
      await performAutoDraftSave(true);
      showToast(
        user ? 'Draft synced to Firestore.' : 'Draft saved locally (sign in to sync to Firestore).'
      );
    } catch (err: any) {
      showToast(err?.message || 'Could not save draft.');
    }
  };

  const handleDiscardDraft = async () => {
    setDraftBannerDismissed(true);
    try {
      await clearClipDraft();
      showToast('Discarded saved Auto-Draft.');
    } catch {
      // Ignore cleanup errors
    }
  };

  const handleQuickExportPlatform = (platform: ExportPlatform, clipOverride?: ClipHighlight) => {
    const targetClip = clipOverride || activeClip;
    if (!targetClip) return;
    if (clipOverride) {
      handleSelectClip(clipOverride);
    }
    setExportInitialPlatform(platform);
    setExportInitialSelectedClipIds([targetClip.id]);
    setExportInitialMode('batch');
    setExportInitialResolution(undefined);
    setExportInitialBurnCaptions(undefined);
    setExportAutoStartNonce((n) => n + 1);
    setIsExportModalOpen(true);
    const preset = PLATFORM_PRESETS[platform];
    showToast(`Quick exporting ${preset.label} (${preset.shortcut})...`);
  };

  const formatTrimTime = (sec: number) => {
    const safe = Math.max(0, sec);
    const m = Math.floor(safe / 60);
    const s = Math.floor(safe % 60);
    const d = Math.floor((safe % 1) * 10);
    return `${m}:${String(s).padStart(2, '0')}.${d}`;
  };

  const applyClipTimeUpdate = useCallback(
    (
      newStart: number,
      newEnd: number,
      options?: { skipHistory?: boolean; shiftCaptions?: boolean }
    ) => {
      const snap = latestDraftSnapshotRef.current;
      const vid = snap.currentVideo;
      const maxDur = Math.max(4, vid.duration || 86400);
      const minSpan = 2;

      const clampedStart = Math.max(
        0,
        Math.min(maxDur - minSpan, Math.round(newStart * 10) / 10)
      );
      const clampedEnd = Math.min(
        maxDur,
        Math.max(clampedStart + minSpan, Math.round(newEnd * 10) / 10)
      );

      const hasFullDirectSource = Boolean(
        vid.playableSourceUrl ||
          (vid.videoUrl &&
            !vid.videoUrl.includes('youtube.com') &&
            !vid.videoUrl.includes('youtu.be'))
      );

      setHasActiveEditSession(true);
      setActiveClip((prev) => {
        if (!options?.skipHistory && (prev.startTime !== clampedStart || prev.endTime !== clampedEnd)) {
          trimHistoryRef.current = [
            ...trimHistoryRef.current.slice(-24),
            {
              clipId: prev.id,
              startTime: prev.startTime,
              endTime: prev.endTime,
              captions: prev.captions,
            },
          ];
          setTrimHistoryCount(
            trimHistoryRef.current.filter((entry) => entry.clipId === prev.id).length
          );
        }

        const deltaStart = clampedStart - prev.startTime;
        const shouldShiftCaptions =
          options?.shiftCaptions !== false && syncCaptionsOnTrimRef.current && deltaStart !== 0;

        const nextCaptions = shouldShiftCaptions
          ? prev.captions.map((c) => ({
              ...c,
              start: Math.round((c.start - deltaStart) * 100) / 100,
              end: Math.round((c.end - deltaStart) * 100) / 100,
              words: c.words?.map((w) => ({
                ...w,
                start: Math.round((w.start - deltaStart) * 100) / 100,
                end: Math.round((w.end - deltaStart) * 100) / 100,
              })),
            }))
          : prev.captions;

        const updated: ClipHighlight = {
          ...prev,
          startTime: clampedStart,
          endTime: clampedEnd,
          captions: nextCaptions,
          ...(hasFullDirectSource ? { clipVideoUrl: undefined, downloadUrl: undefined } : {}),
        };

        setCurrentVideo((v) => ({
          ...v,
          highlights: v.highlights.map((h) => (h.id === updated.id ? updated : h)),
        }));
        return updated;
      });
    },
    []
  );

  const handleSetTrimMarkerFromPlayhead = useCallback(
    (edge: 'in' | 'out') => {
      const snap = latestDraftSnapshotRef.current;
      const clip = snap.activeClip;
      if (!clip) return;

      const total = Math.max(4, snap.currentVideo.duration || 3600);
      const rawPlayhead =
        videoRef.current && Number.isFinite(videoRef.current.currentTime)
          ? Boolean(
              snap.currentVideo.playableSourceUrl ||
                (snap.currentVideo.videoUrl &&
                  !snap.currentVideo.videoUrl.includes('youtube.com') &&
                  !snap.currentVideo.videoUrl.includes('youtu.be'))
            )
            ? videoRef.current.currentTime
            : snap.currentTime
          : snap.currentTime;

      const playhead = Math.round(rawPlayhead * 10) / 10;

      if (edge === 'in') {
        const targetStart = Math.max(0, Math.min(total - 2, playhead));
        let nextEnd = clip.endTime;
        let note: string | undefined;
        if (targetStart > clip.endTime - 2) {
          nextEnd = Math.min(total, Math.round((targetStart + 15) * 10) / 10);
          note = `Out -> ${formatTrimTime(nextEnd)}`;
        }
        applyClipTimeUpdate(targetStart, nextEnd);
        const durSec = Math.round((nextEnd - targetStart) * 10) / 10;
        setTrimFeedback({ edge: 'in', time: targetStart, nonce: Date.now(), note });
        showToast(
          note
            ? `In marker set to ${formatTrimTime(targetStart)} (Out shifted to ${formatTrimTime(nextEnd)})`
            : `In marker set to ${formatTrimTime(targetStart)} (${durSec}s clip)`
        );
      } else {
        const targetEnd = Math.max(2, Math.min(total, playhead));
        let nextStart = clip.startTime;
        let note: string | undefined;
        if (targetEnd < clip.startTime + 2) {
          nextStart = Math.max(0, Math.round((targetEnd - 15) * 10) / 10);
          note = `In -> ${formatTrimTime(nextStart)}`;
        }
        applyClipTimeUpdate(nextStart, targetEnd);
        const durSec = Math.round((targetEnd - nextStart) * 10) / 10;
        setTrimFeedback({ edge: 'out', time: targetEnd, nonce: Date.now(), note });
        showToast(
          note
            ? `Out marker set to ${formatTrimTime(targetEnd)} (In pulled to ${formatTrimTime(nextStart)})`
            : `Out marker set to ${formatTrimTime(targetEnd)} (${durSec}s clip)`
        );
      }
    },
    [applyClipTimeUpdate]
  );

  const handleUndoTrim = useCallback(() => {
    const snap = latestDraftSnapshotRef.current;
    const clipId = snap.activeClip?.id;
    if (!clipId) return;

    const history = trimHistoryRef.current;
    let idx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].clipId === clipId) {
        idx = i;
        break;
      }
    }
    if (idx === -1) return;

    const entry = history[idx];
    trimHistoryRef.current = [...history.slice(0, idx), ...history.slice(idx + 1)];
    setTrimHistoryCount(
      trimHistoryRef.current.filter((item) => item.clipId === clipId).length
    );

    setActiveClip((prev) => {
      if (prev.id !== clipId) return prev;
      const restored: ClipHighlight = {
        ...prev,
        startTime: entry.startTime,
        endTime: entry.endTime,
        captions: entry.captions,
      };
      setCurrentVideo((v) => ({
        ...v,
        highlights: v.highlights.map((h) => (h.id === restored.id ? restored : h)),
      }));
      return restored;
    });

    showToast(`Restored trim ${formatTrimTime(entry.startTime)} – ${formatTrimTime(entry.endTime)}`);
  }, []);

  const seekSourcePlayhead = useCallback((time: number) => {
    const snap = latestDraftSnapshotRef.current;
    const total = Math.max(1, snap.currentVideo.duration || 86400);
    const clamped = Math.max(0, Math.min(total, Math.round(time * 10) / 10));
    setCurrentTime(clamped);
    const hasFullSource = Boolean(
      snap.currentVideo.playableSourceUrl ||
        (snap.currentVideo.videoUrl &&
          !snap.currentVideo.videoUrl.includes('youtube.com') &&
          !snap.currentVideo.videoUrl.includes('youtu.be'))
    );
    if (videoRef.current) {
      try {
        videoRef.current.currentTime =
          !hasFullSource && snap.activeClip.clipVideoUrl
            ? Math.max(0, clamped - snap.activeClip.startTime)
            : clamped;
      } catch {}
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const snap = latestDraftSnapshotRef.current;
      if (snap.appMode === 'generator' || snap.isProcessing || !snap.activeClip) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        ((target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range') ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Ctrl+[ / Ctrl+] (or Cmd+[ / Cmd+]) to set Start / End trim markers from active player
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const isInKey = e.key === '[' || e.code === 'BracketLeft';
        const isOutKey = e.key === ']' || e.code === 'BracketRight';
        if (snap.appMode === 'studio' && isInKey) {
          e.preventDefault();
          handleSetTrimMarkerFromPlayhead('in');
          return;
        }
        if (snap.appMode === 'studio' && isOutKey) {
          e.preventDefault();
          handleSetTrimMarkerFromPlayhead('out');
          return;
        }
        if (snap.appMode === 'studio' && e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndoTrim();
          return;
        }
        return;
      }

      if (e.altKey) return;

      // Studio NLE player transport & frame-nudge shortcuts
      if (snap.appMode === 'studio') {
        const keyLower = e.key.toLowerCase();
        if ((e.code === 'Space' || keyLower === 'k') && !e.shiftKey) {
          e.preventDefault();
          setPlayToggleNonce((n) => n + 1);
          return;
        }
        if (keyLower === 'j' && !e.shiftKey) {
          e.preventDefault();
          seekSourcePlayhead(snap.currentTime - 5);
          return;
        }
        if (keyLower === 'l' && !e.shiftKey) {
          e.preventDefault();
          seekSourcePlayhead(snap.currentTime + 5);
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          seekSourcePlayhead(snap.currentTime - (e.shiftKey ? 0.1 : 1));
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          seekSourcePlayhead(snap.currentTime + (e.shiftKey ? 0.1 : 1));
          return;
        }
        if ((e.key === '[' || e.code === 'BracketLeft') && !e.shiftKey) {
          e.preventDefault();
          seekSourcePlayhead(snap.activeClip.startTime);
          return;
        }
        if ((e.key === ']' || e.code === 'BracketRight') && !e.shiftKey) {
          e.preventDefault();
          seekSourcePlayhead(snap.activeClip.endTime);
          return;
        }
      }

      if (!e.shiftKey) return;
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
  }, [handleSetTrimMarkerFromPlayhead, handleUndoTrim, seekSourcePlayhead]);

  const handleSelectClip = (clip: ClipHighlight) => {
    setHasActiveEditSession(true);
    setActiveClip(clip);
    setTrimHistoryCount(
      trimHistoryRef.current.filter((entry) => entry.clipId === clip.id).length
    );
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
    setHasActiveEditSession(true);
    setAppMode('studio');
  };

  const handleUpdateSettings = (newSettings: Partial<ExportSettings>) => {
    setHasActiveEditSession(true);
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleUpdateClipTime = (
    newStart: number,
    newEnd: number,
    options?: { skipHistory?: boolean; shiftCaptions?: boolean }
  ) => {
    applyClipTimeUpdate(newStart, newEnd, options);
  };

  const handleClipUpdated = (updatedClip: ClipHighlight) => {
    setHasActiveEditSession(true);
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
        signal: AbortSignal.timeout(55000),
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
        signal: AbortSignal.timeout(35000),
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
          signal: AbortSignal.timeout(42000),
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
          signal: AbortSignal.timeout(45000),
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
      // Built-in samples already ship with rich transcripts, so skip redundant slow Step 2 blocking on them.
      const hasTranscript = Boolean(video.transcript && video.transcript.trim().length >= 40);
      const needsStep2 = !hasTranscript || (!video.visualSummary && video.sourceType !== 'sample');
      setProcessingProgress(36);
      if (needsStep2) {
        const canTranscribeSource = Boolean(
          video.playableSourceUrl || (video.youtubeUrl && !video.youtubeDownloadBlocked)
        );
        if (canTranscribeSource) {
          setProcessingStep(
            hasTranscript
              ? '2/4: Inspecting visual keyframes for 9:16 smart framing...'
              : '2/4: Gemini AI listening to audio & analyzing visual keyframes...'
          );
          try {
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
              signal: AbortSignal.timeout(45000),
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
          } catch (step2Err: any) {
            if (
              step2Err?.message?.includes('GEMINI_API_KEY') ||
              step2Err?.message?.includes('permission denied')
            ) {
              throw step2Err;
            }
            console.warn('Non-fatal Step 2 notice, continuing to highlight analysis:', step2Err?.message);
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
        signal: AbortSignal.timeout(45000),
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
        signal: AbortSignal.timeout(45000),
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

      const combinedClips = appendMode ? [...existingHighlights, ...finalClips] : finalClips;

      video = {
        ...video,
        aiSummary: data.summary || video.aiSummary || '',
        highlights: combinedClips,
      };

      setProcessingProgress(100);
      setProcessingStep('Done! Opening Clips Feed...');

      const finishUpdate = () => {
        setHasActiveEditSession(true);
        setDraftBannerDismissed(true);
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
        if (!appendMode && options.autoExport?.enabled && finalClips.length > 0) {
          const ae = options.autoExport;
          setExportInitialPlatform(ae.platform);
          setExportInitialSelectedClipIds(finalClips.map((c) => c.id));
          setExportInitialMode(ae.mode === 'reel' && finalClips.length >= 2 ? 'reel' : 'batch');
          setExportInitialResolution(ae.resolution);
          setExportInitialBurnCaptions(ae.burnCaptions);
          setExportAutoStartNonce((n) => n + 1);
          setIsExportModalOpen(true);
          showToast(
            `Clipping finished! Instantly exporting ${finalClips.length} clip${
              finalClips.length > 1 ? 's' : ''
            } for ${PLATFORM_PRESETS[ae.platform].label}...`
          );
        } else {
          showToast(
            appendMode
              ? `Added ${finalClips.length} new AI-clipped shorts!`
              : `Extracted and clipped ${finalClips.length} 9:16 shorts with Gemini AI.`
          );
        }
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
        onSetAppMode={(nextMode) => {
          if (nextMode === 'feed' || nextMode === 'studio') {
            setHasActiveEditSession(true);
          }
          setAppMode(nextMode);
        }}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenExportModal={() => {
          setExportInitialSelectedClipIds(activeClip ? [activeClip.id] : undefined);
          setExportInitialMode('batch');
          setExportInitialResolution(undefined);
          setExportInitialBurnCaptions(undefined);
          setIsExportModalOpen(true);
        }}
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
          <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full py-4 space-y-4">
            {draftLoaded && savedDraft && !draftBannerDismissed && !isProcessing && (
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-100">
                      <span>Resume Auto-Draft: {savedDraft.clip.title}</span>
                      <span className="text-[10px] font-mono font-normal text-emerald-300">
                        {lastDraftSavedAt
                          ? `Saved ${new Date(lastDraftSavedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : 'Saved'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {savedDraft.video.title} ·{' '}
                      {Math.max(1, Math.round(savedDraft.clip.endTime - savedDraft.clip.startTime))}s ·{' '}
                      {user ? 'Synced to Firestore' : 'Saved on this browser'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!user && (
                    <button
                      type="button"
                      onClick={() => {
                        signInWithGoogle().catch(() => {});
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer transition-colors"
                    >
                      <Cloud className="w-3.5 h-3.5 text-violet-400" />
                      <span>Cloud Sync</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-300 hover:bg-zinc-900/70 transition-colors cursor-pointer"
                    title="Discard saved draft"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleResumeDraft}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Resume Editing</span>
                  </button>
                </div>
              </div>
            )}

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
              onOpenExportModal={(clip, platform, selectedClipIds, exportMode, autoStart) => {
                if (platform && !autoStart) {
                  handleQuickExportPlatform(platform, clip);
                } else {
                  handleSelectClip(clip);
                  if (platform) {
                    setExportInitialPlatform(platform);
                  }
                  setExportInitialSelectedClipIds(
                    selectedClipIds && selectedClipIds.length > 0 ? selectedClipIds : [clip.id]
                  );
                  setExportInitialMode(exportMode || 'batch');
                  setExportInitialResolution(undefined);
                  setExportInitialBurnCaptions(undefined);
                  if (autoStart) {
                    setExportAutoStartNonce((n) => n + 1);
                  }
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

                {!user && (
                  <button
                    type="button"
                    onClick={() => {
                      signInWithGoogle().catch(() => {});
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-medium transition-colors cursor-pointer"
                    title="Sign in with Google to save Auto-Drafts to Firestore"
                  >
                    <Cloud className="w-3.5 h-3.5 text-violet-400" />
                    <span>Sync Drafts</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleManualSaveDraft}
                  disabled={isSavingDraft}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  title="Auto-Draft saves every 30s — click to save immediately"
                >
                  {isSavingDraft ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>
                    {isSavingDraft
                      ? 'Saving...'
                      : lastDraftSavedAt
                      ? `Draft ${new Date(lastDraftSavedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : 'Save Draft'}
                  </span>
                </button>

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
                    totalVideoDuration={currentVideo.duration}
                    activeClip={activeClip}
                    settings={settings}
                    onUpdateSettings={handleUpdateSettings}
                    videoRef={videoRef}
                    onTimeUpdate={(t) => setCurrentTime(t)}
                    onSeekSourceTime={seekSourcePlayhead}
                    onSetInPoint={() => handleSetTrimMarkerFromPlayhead('in')}
                    onSetOutPoint={() => handleSetTrimMarkerFromPlayhead('out')}
                    trimFeedback={trimFeedback}
                    playToggleNonce={playToggleNonce}
                  />
                </div>

                <div className="shrink-0">
                  <TimelineTrimmer
                    totalVideoDuration={currentVideo.duration}
                    activeClip={activeClip}
                    currentTime={currentTime}
                    onUpdateClipTime={handleUpdateClipTime}
                    onSeek={handleSeek}
                    onSetInPoint={() => handleSetTrimMarkerFromPlayhead('in')}
                    onSetOutPoint={() => handleSetTrimMarkerFromPlayhead('out')}
                    onUndoTrim={handleUndoTrim}
                    canUndoTrim={trimHistoryCount > 0}
                    syncCaptionsOnTrim={syncCaptionsOnTrim}
                    onToggleSyncCaptions={() => setSyncCaptionsOnTrim((v) => !v)}
                  />
                </div>
              </section>

              {/* Right Column: Style, Video Effects, Transitions & Script Tabs */}
              <section className="lg:col-span-4 h-[550px] lg:h-[calc(100vh-170px)] flex flex-col space-y-3 min-h-0">
                <div className="flex p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg shrink-0 gap-0.5 overflow-x-auto">
                  <button
                    onClick={() => setRightPanelTab('style')}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      rightPanelTab === 'style'
                        ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 shrink-0" />
                    <span>Captions</span>
                  </button>

                  <button
                    onClick={() => setRightPanelTab('effects')}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      rightPanelTab === 'effects'
                        ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5 shrink-0" />
                    <span>Effects</span>
                  </button>

                  <button
                    onClick={() => setRightPanelTab('transitions')}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      rightPanelTab === 'transitions'
                        ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Blend className="w-3.5 h-3.5 shrink-0" />
                    <span>Transitions</span>
                  </button>

                  <button
                    onClick={() => setRightPanelTab('transcript')}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      rightPanelTab === 'transcript'
                        ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
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
                  ) : rightPanelTab === 'transitions' ? (
                    <TransitionsPanel
                      settings={settings}
                      onUpdateSettings={handleUpdateSettings}
                      clipCount={currentVideo.highlights.length}
                      onOpenCompilationExport={() => {
                        setExportInitialSelectedClipIds(
                          currentVideo.highlights.slice(0, 10).map((h) => h.id)
                        );
                        setExportInitialMode('reel');
                        setExportInitialResolution(undefined);
                        setExportInitialBurnCaptions(undefined);
                        setIsExportModalOpen(true);
                      }}
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
        initialSelectedClipIds={exportInitialSelectedClipIds}
        initialExportMode={exportInitialMode}
        initialResolution={exportInitialResolution}
        initialBurnCaptions={exportInitialBurnCaptions}
        autoStartNonce={exportAutoStartNonce}
        onManageAccounts={(platform) => {
          setIsExportModalOpen(false);
          setAccountModalPlatform(platform);
          setIsAccountModalOpen(true);
        }}
        onUpdateSettings={handleUpdateSettings}
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
