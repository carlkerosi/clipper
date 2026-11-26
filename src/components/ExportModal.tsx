import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Download,
  CheckCircle2,
  FileText,
  Copy,
  Sparkles,
  Smartphone,
  Check,
  Youtube,
  Music2,
  ExternalLink,
  Share2,
  Loader2,
  AlertCircle,
  Layers,
  Film,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { ClipHighlight, ExportSettings, VideoSource } from '../types';
import {
  exportVerticalVideo,
  generateSrtFile,
  generateConsolidatedSrtFile,
  downloadBlob,
} from '../utils/exportVideo';
import { getCssFilterString } from '../utils/videoFilters';
import { parseJsonResponse } from '../utils/safeFetchJson';
import {
  ExportPlatform,
  PLATFORM_PRESETS,
  buildPlatformFilename,
  buildPlatformSocialCopy,
  copyPlatformCaptionSilently,
  canNativeShareFiles,
  shareClipNatively,
  mergeSelectedClipsCompilation,
  isYoutubeWebUrl,
} from '../utils/platformExport';
import { useFirebase } from '../contexts/FirebaseContext';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeClip: ClipHighlight;
  videoSource: VideoSource;
  settings: ExportSettings;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  initialPlatform?: ExportPlatform;
  initialSelectedClipIds?: string[];
  initialExportMode?: 'batch' | 'reel';
  initialResolution?: '1080p' | '720p';
  initialBurnCaptions?: boolean;
  autoStartNonce?: number;
  onManageAccounts?: (platform: ExportPlatform) => void;
}

type BatchClipState = 'idle' | 'queued' | 'exporting' | 'done' | 'error' | 'cancelled';

interface BatchClipResult {
  clip: ClipHighlight;
  status: BatchClipState;
  blob?: Blob;
  filename?: string;
  downloadUrl?: string;
  error?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  activeClip,
  videoSource,
  settings,
  videoRef,
  initialPlatform = 'tiktok',
  initialSelectedClipIds,
  initialExportMode = 'batch',
  initialResolution,
  initialBurnCaptions,
  autoStartNonce = 0,
  onManageAccounts,
}) => {
  const { getDefaultAccountForPlatform, logClipExport, workspacePrefs } = useFirebase();
  const [selectedPlatform, setSelectedPlatform] = useState<ExportPlatform>(initialPlatform);
  const [exportMode, setExportMode] = useState<'batch' | 'reel'>(initialExportMode);
  const [lastExportKind, setLastExportKind] = useState<'batch' | 'reel'>('batch');
  const [resolution, setResolution] = useState<'1080p' | '720p'>(
    initialResolution || PLATFORM_PRESETS[initialPlatform].recommendedResolution
  );
  const [framerate, setFramerate] = useState<30 | 60>(
    PLATFORM_PRESETS[initialPlatform].recommendedFramerate
  );

  const availableClips = useMemo(() => {
    const list = Array.isArray(videoSource.highlights) ? videoSource.highlights : [];
    if (list.length === 0) return [activeClip];
    if (!list.some((c) => c.id === activeClip.id)) return [activeClip, ...list];
    return list;
  }, [videoSource.highlights, activeClip]);

  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([activeClip.id]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusText, setExportStatusText] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedFilename, setExportedFilename] = useState<string>('');
  const [batchResults, setBatchResults] = useState<Record<string, BatchClipResult>>({});
  const [batchCompleted, setBatchCompleted] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [burnServerCaptions, setBurnServerCaptions] = useState(true);

  const lastHandledNonceRef = useRef<number>(0);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const cancelBatchRef = useRef<boolean>(false);

  // Preserve explicit sequence order of selectedClipIds (crucial for Consolidated Highlight Reels)
  const selectedClips = useMemo(() => {
    const byId = new Map<string, ClipHighlight>();
    availableClips.forEach((c) => byId.set(c.id, c));
    return selectedClipIds
      .map((id) => byId.get(id))
      .filter((c): c is ClipHighlight => Boolean(c));
  }, [availableClips, selectedClipIds]);

  const allSelected =
    availableClips.length > 0 && selectedClipIds.length === availableClips.length;
  const partiallySelected =
    selectedClipIds.length > 0 && selectedClipIds.length < availableClips.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  const isYoutubeEmbedOnly = Boolean(
    videoSource.youtubeDownloadBlocked &&
      !videoSource.playableSourceUrl &&
      selectedClips.some((c) => !c.clipVideoUrl)
  );

  // Sync modal defaults when opened or launched from Feed selection
  useEffect(() => {
    if (!isOpen) return;
    const preset = PLATFORM_PRESETS[initialPlatform];
    const validIds = new Set(availableClips.map((c) => c.id));
    const initialIds = (initialSelectedClipIds || []).filter((id) => validIds.has(id));

    cancelBatchRef.current = false;
    setSelectedPlatform(initialPlatform);
    setExportMode(initialExportMode);
    setLastExportKind(initialExportMode);
    setResolution(initialResolution || preset.recommendedResolution);
    setFramerate(preset.recommendedFramerate);
    if (typeof initialBurnCaptions === 'boolean') {
      setBurnServerCaptions(initialBurnCaptions);
    }
    setSelectedClipIds(initialIds.length > 0 ? initialIds : [activeClip.id]);
    setIsExporting(false);
    setDownloadUrl(null);
    setExportedBlob(null);
    setExportedFilename('');
    setExportProgress(0);
    setExportStatusText('');
    setBatchResults({});
    setBatchCompleted(false);
    setCopiedCaption(false);
  }, [
    isOpen,
    initialPlatform,
    activeClip.id,
    initialSelectedClipIds,
    initialExportMode,
    initialResolution,
    initialBurnCaptions,
  ]);

  // Auto-trigger 1-click export when launched via Instant Export After Clipping, Header shortcut, Feed Instant Export, or Shift+Y/T
  useEffect(() => {
    if (!isOpen || autoStartNonce === 0 || autoStartNonce === lastHandledNonceRef.current) {
      return;
    }
    lastHandledNonceRef.current = autoStartNonce;

    const byId = new Map<string, ClipHighlight>();
    availableClips.forEach((c) => byId.set(c.id, c));
    const resolvedClips = (initialSelectedClipIds || [])
      .map((id) => byId.get(id))
      .filter((c): c is ClipHighlight => Boolean(c));
    const targetClips = resolvedClips.length > 0 ? resolvedClips : [activeClip];
    const targetRes =
      initialResolution || PLATFORM_PRESETS[initialPlatform].recommendedResolution;
    const targetBurn = typeof initialBurnCaptions === 'boolean' ? initialBurnCaptions : true;

    const embedOnlyTarget = Boolean(
      videoSource.youtubeDownloadBlocked &&
        !videoSource.playableSourceUrl &&
        targetClips.some((c) => !c.clipVideoUrl)
    );

    if (embedOnlyTarget) {
      const autoAcc = workspacePrefs.autoApplyAccounts
        ? getDefaultAccountForPlatform(initialPlatform)
        : undefined;
      copyPlatformCaptionSilently(targetClips[0], initialPlatform, autoAcc).then((ok) => {
        if (ok) setCopiedCaption(true);
      });
      return;
    }

    if (initialExportMode === 'reel' && targetClips.length >= 2) {
      handleMergeCompilation(initialPlatform, targetClips, targetRes, targetBurn);
    } else {
      handleFastClipExport(initialPlatform, targetClips, targetRes, targetBurn);
    }
  }, [
    isOpen,
    autoStartNonce,
    initialPlatform,
    initialExportMode,
    initialSelectedClipIds,
    initialResolution,
    initialBurnCaptions,
  ]);

  const primaryClip = selectedClips[0] || activeClip;
  const primaryClipDuration = Math.max(1, Math.round(primaryClip.endTime - primaryClip.startTime));
  const totalSelectedDuration = selectedClips.reduce(
    (sum, c) => sum + Math.max(1, Math.round(c.endTime - c.startTime)),
    0
  );
  const activePreset = PLATFORM_PRESETS[selectedPlatform];
  const autoLinkedAccount = workspacePrefs.autoApplyAccounts
    ? getDefaultAccountForPlatform(selectedPlatform)
    : undefined;

  const reelClips = selectedClips.slice(0, 10);
  const reelDuration = reelClips.reduce(
    (sum, c) => sum + Math.max(1, Math.round(c.endTime - c.startTime)),
    0
  );

  const socialCaptionText = useMemo(() => {
    if (selectedClips.length <= 1) {
      return buildPlatformSocialCopy(primaryClip, selectedPlatform, autoLinkedAccount);
    }
    if (exportMode === 'reel') {
      const tags = Array.from(
        new Set(
          reelClips
            .flatMap((c) => c.hashtags || [])
            .map((t) => (t.startsWith('#') ? t : `#${t}`))
        )
      )
        .slice(0, 6)
        .join(' ');
      const chapters = reelClips
        .map((c, idx) => `${idx + 1}. ${c.title} (${Math.max(1, Math.round(c.endTime - c.startTime))}s)`)
        .join('\n');
      return `${videoSource.title} — Best Highlights Reel (${reelClips.length} clips, ${reelDuration}s)\n\n${chapters}\n\n${tags || '#shorts #highlights'}${autoLinkedAccount ? `\nCredit: ${autoLinkedAccount.handle}` : ''}`;
    }
    return selectedClips
      .map(
        (clip, idx) =>
          `[Clip ${idx + 1}: ${clip.title}]\n${buildPlatformSocialCopy(
            clip,
            selectedPlatform,
            autoLinkedAccount
          )}`
      )
      .join('\n\n---\n\n');
  }, [selectedClips, primaryClip, selectedPlatform, autoLinkedAccount, exportMode, reelClips, videoSource.title, reelDuration]);

  if (!isOpen) return null;

  const handleSelectPlatform = (platformId: ExportPlatform) => {
    const preset = PLATFORM_PRESETS[platformId];
    setSelectedPlatform(platformId);
    setResolution(preset.recommendedResolution);
    setFramerate(preset.recommendedFramerate);
  };

  const handleToggleSelectAll = () => {
    if (isExporting) return;
    if (allSelected) {
      setSelectedClipIds([]);
    } else {
      setSelectedClipIds(availableClips.map((c) => c.id));
    }
  };

  const handleToggleClip = (clipId: string) => {
    if (isExporting) return;
    setSelectedClipIds((prev) =>
      prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [...prev, clipId]
    );
  };

  const handleMoveSelectedClip = (clipId: string, direction: -1 | 1) => {
    if (isExporting) return;
    setSelectedClipIds((prev) => {
      const idx = prev.indexOf(clipId);
      if (idx === -1) return prev;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(targetIdx, 0, item);
      return next;
    });
  };

  const renderServerSingleClip = async (
    clip: ClipHighlight,
    targetPlatform: ExportPlatform,
    targetRes: '1080p' | '720p',
    burnOverride?: boolean
  ): Promise<{ blob: Blob; filename: string; downloadUrl: string }> => {
    const clipDuration = Math.max(1, Math.round(clip.endTime - clip.startTime));
    const response = await fetch('/api/clip-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(100000),
      body: JSON.stringify({
        videoUrl: videoSource.videoUrl,
        playableSourceUrl: videoSource.playableSourceUrl,
        clipVideoUrl: clip.clipVideoUrl,
        youtubeUrl: videoSource.youtubeUrl,
        startTime: clip.startTime,
        duration: clipDuration,
        resolution: targetRes,
        framingMode: workspacePrefs.autoApplyAiFraming
          ? clip.framingSuggestion || settings.framingMode
          : settings.framingMode,
        panX:
          workspacePrefs.autoApplyAiFraming && typeof clip.panX === 'number'
            ? clip.panX
            : settings.panX,
        title: clip.title,
        clipId: `${clip.id}_${targetPlatform}`,
        burnCaptions: typeof burnOverride === 'boolean' ? burnOverride : burnServerCaptions,
        captions: clip.captions,
        captionColor: settings.captionColor,
        captionBaseColor: settings.captionBaseColor,
        captionPosition: settings.captionPosition,
        captionFontSize: settings.captionFontSize,
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
        hookBannerText: clip.id === activeClip.id ? settings.hookBannerText || clip.hook : clip.hook,
      }),
    });

    const data = await parseJsonResponse(response, 'Export failed');
    if (!response.ok || !data.downloadUrl) {
      throw new Error(data.error || 'Server clipping service returned ' + response.status);
    }

    const clipFileRes = await fetch(data.downloadUrl, { signal: AbortSignal.timeout(45000) });
    if (!clipFileRes.ok) {
      throw new Error(`Could not download rendered clip (${clipFileRes.status}).`);
    }
    const blob = await clipFileRes.blob();
    const targetFilename = buildPlatformFilename(clip, targetPlatform, 'mp4');

    return { blob, filename: targetFilename, downloadUrl: data.downloadUrl };
  };

  const renderStudioSingleClip = async (
    clip: ClipHighlight,
    targetPlatform: ExportPlatform,
    onClipProgress: (prog: number, text: string) => void
  ): Promise<{ blob: Blob; filename: string; downloadUrl: string }> => {
    const clipDuration = Math.max(1, Math.round(clip.endTime - clip.startTime));
    const fullSrc =
      videoSource.playableSourceUrl ||
      (videoSource.videoUrl && !isYoutubeWebUrl(videoSource.videoUrl) ? videoSource.videoUrl : '');
    const isClipOnly = !fullSrc && Boolean(clip.clipVideoUrl);
    const candidateSrc = fullSrc || clip.clipVideoUrl || '';

    if (!candidateSrc || isYoutubeWebUrl(candidateSrc)) {
      throw new Error(
        'Direct MP4 stream unavailable for Studio Render (YouTube bot-protection). Export timed .SRT subtitles or upload an MP4 video.'
      );
    }

    // Use a dedicated isolated <video> element so the Studio preview player never gets corrupted
    const offscreenVideo = document.createElement('video');
    offscreenVideo.src = candidateSrc;
    offscreenVideo.crossOrigin = 'anonymous';
    offscreenVideo.playsInline = true;
    offscreenVideo.preload = 'auto';

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const done = (err?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          offscreenVideo.onloadeddata = null;
          offscreenVideo.oncanplay = null;
          offscreenVideo.onerror = null;
          if (err) reject(err);
          else resolve();
        };
        offscreenVideo.onloadeddata = () => done();
        offscreenVideo.oncanplay = () => done();
        offscreenVideo.onerror = () =>
          done(new Error('Could not decode source MP4 in browser for Studio Render.'));
        const timer = setTimeout(() => {
          if (offscreenVideo.readyState >= 1) done();
          else done(new Error('Timed out loading video stream for Studio Render.'));
        }, 8000);
      });

      const blob = await exportVerticalVideo({
        videoElement: offscreenVideo,
        startTime: isClipOnly ? 0 : clip.startTime,
        endTime: isClipOnly ? clipDuration : clip.endTime,
        resolution,
        framerate,
        framingMode: workspacePrefs.autoApplyAiFraming
          ? clip.framingSuggestion || settings.framingMode
          : settings.framingMode,
        panX:
          workspacePrefs.autoApplyAiFraming && typeof clip.panX === 'number'
            ? clip.panX
            : settings.panX,
        captionPreset: settings.captionPreset,
        captionHighlightStyle: settings.captionHighlightStyle,
        captionPosition: settings.captionPosition,
        captionFontSize: settings.captionFontSize,
        captionColor: settings.captionColor,
        captionBaseColor: settings.captionBaseColor,
        captionFontFamily: settings.captionFontFamily,
        captionTextCase: settings.captionTextCase,
        captionOutlineWidth: settings.captionOutlineWidth,
        captionWordsPerLine: settings.captionWordsPerLine,
        captionDropShadow: settings.captionDropShadow,
        captionEntranceAnim: settings.captionEntranceAnim,
        captionExitAnim: settings.captionExitAnim,
        captions: clip.captions,
        showHookBanner: settings.showHookBanner,
        hookBannerText: clip.id === activeClip.id ? settings.hookBannerText || clip.hook : clip.hook,
        showProgressBar: settings.showProgressBar,
        progressBarColor: settings.progressBarColor,
        videoFilterCss: getCssFilterString(settings),
        playbackSpeed: settings.playbackSpeed ?? 1,
        onProgress: onClipProgress,
      });

      const targetFilename = buildPlatformFilename(clip, targetPlatform, 'webm');
      const url = URL.createObjectURL(blob);
      return { blob, filename: targetFilename, downloadUrl: url };
    } finally {
      try {
        offscreenVideo.pause();
        offscreenVideo.removeAttribute('src');
        offscreenVideo.load();
      } catch {}
    }
  };

  const recordExportToFirestore = (
    clip: ClipHighlight,
    targetPlatform: ExportPlatform,
    filename: string
  ) => {
    const targetAccount = workspacePrefs.autoApplyAccounts
      ? getDefaultAccountForPlatform(targetPlatform)
      : undefined;
    const clipDuration = Math.max(1, Math.round(clip.endTime - clip.startTime));

    logClipExport({
      platform: targetPlatform,
      clipId: clip.id,
      clipTitle: clip.title,
      sourceVideoTitle: videoSource.title,
      filename,
      captionCopy: buildPlatformSocialCopy(clip, targetPlatform, targetAccount),
      durationSec: clipDuration,
      viralityScore: clip.viralityScore,
      status: 'exported',
      accountId: targetAccount?.id,
      accountHandle: targetAccount?.handle,
    }).catch(() => {});
  };

  // Fast FFmpeg 9:16 Clipping (Single or Batch)
  const handleFastClipExport = async (
    overridePlatform?: ExportPlatform,
    clipsOverride?: ClipHighlight[],
    resolutionOverride?: '1080p' | '720p',
    burnOverride?: boolean
  ) => {
    const queue = clipsOverride || selectedClips;
    if (queue.length === 0) return;

    const targetPlatform = overridePlatform || selectedPlatform;
    const targetPreset = PLATFORM_PRESETS[targetPlatform];
    const targetRes =
      resolutionOverride ||
      (overridePlatform ? targetPreset.recommendedResolution : resolution);
    const shouldBurn =
      typeof burnOverride === 'boolean' ? burnOverride : burnServerCaptions;

    cancelBatchRef.current = false;
    setLastExportKind('batch');
    setIsExporting(true);
    setBatchCompleted(false);
    setExportProgress(queue.length === 1 ? 20 : 5);
    setDownloadUrl(null);
    setExportedBlob(null);
    setExportedFilename('');

    const initialMap: Record<string, BatchClipResult> = {};
    queue.forEach((c) => {
      initialMap[c.id] = { clip: c, status: 'queued' };
    });
    setBatchResults(initialMap);

    let firstSuccess: { blob: Blob; filename: string; downloadUrl: string } | null = null;
    const succeededClips: ClipHighlight[] = [];

    for (let i = 0; i < queue.length; i++) {
      const clip = queue[i];
      if (cancelBatchRef.current) {
        setBatchResults((prev) => ({
          ...prev,
          [clip.id]: { clip, status: 'cancelled' },
        }));
        continue;
      }

      const basePct = Math.round((i / queue.length) * 100);
      setExportProgress(Math.max(8, basePct));
      setExportStatusText(
        queue.length === 1
          ? shouldBurn
            ? `Exporting ${targetPreset.label} 9:16 MP4 & burning subtitles...`
            : `Clipping ${targetPreset.label} 9:16 video with FFmpeg...`
          : `Batch ${i + 1}/${queue.length}: Rendering "${clip.title.slice(0, 28)}"...`
      );
      setBatchResults((prev) => ({
        ...prev,
        [clip.id]: { clip, status: 'exporting' },
      }));

      try {
        let rendered: { blob: Blob; filename: string; downloadUrl: string };
        try {
          rendered = await renderServerSingleClip(clip, targetPlatform, targetRes, shouldBurn);
        } catch (serverErr: any) {
          const hasBrowserPlayable = Boolean(
            videoSource.playableSourceUrl ||
              clip.clipVideoUrl ||
              (videoSource.videoUrl && !isYoutubeWebUrl(videoSource.videoUrl))
          );
          const isBotWall = String(serverErr?.message || '').includes('YOUTUBE_BOT_WALL');
          if (hasBrowserPlayable && !isBotWall) {
            console.warn('Fast export fallback to canvas render:', serverErr);
            rendered = await renderStudioSingleClip(clip, targetPlatform, (prog, text) => {
              const overall =
                queue.length === 1
                  ? prog
                  : Math.round(((i + prog / 100) / queue.length) * 100);
              setExportProgress(overall);
              setExportStatusText(text);
            });
          } else {
            throw serverErr;
          }
        }

        if (!firstSuccess) {
          firstSuccess = rendered;
        }
        succeededClips.push(clip);

        setBatchResults((prev) => ({
          ...prev,
          [clip.id]: {
            clip,
            status: 'done',
            blob: rendered.blob,
            filename: rendered.filename,
            downloadUrl: rendered.downloadUrl,
          },
        }));

        downloadBlob(rendered.blob, rendered.filename);
        recordExportToFirestore(clip, targetPlatform, rendered.filename);

        if (i < queue.length - 1) {
          await new Promise((r) => setTimeout(r, 280));
        }
      } catch (err: any) {
        setBatchResults((prev) => ({
          ...prev,
          [clip.id]: {
            clip,
            status: 'error',
            error: err?.message || 'Export failed',
          },
        }));
      }

      setExportProgress(Math.round(((i + 1) / queue.length) * 100));
    }

    if (firstSuccess) {
      setExportedBlob(firstSuccess.blob);
      setExportedFilename(firstSuccess.filename);
      setDownloadUrl(firstSuccess.downloadUrl);
    }

    if (succeededClips.length > 0) {
      const targetAccount = workspacePrefs.autoApplyAccounts
        ? getDefaultAccountForPlatform(targetPlatform)
        : undefined;
      if (succeededClips.length === 1) {
        const copied = await copyPlatformCaptionSilently(
          succeededClips[0],
          targetPlatform,
          targetAccount
        );
        if (copied) setCopiedCaption(true);
      } else {
        try {
          const combinedCopy = succeededClips
            .map(
              (c, idx) =>
                `[Clip ${idx + 1}: ${c.title}]\n${buildPlatformSocialCopy(
                  c,
                  targetPlatform,
                  targetAccount
                )}`
            )
            .join('\n\n---\n\n');
          await navigator.clipboard.writeText(combinedCopy);
          setCopiedCaption(true);
        } catch {}
      }
    }

    setBatchCompleted(true);
    setIsExporting(false);
    setExportStatusText(
      cancelBatchRef.current
        ? `Batch cancelled (${succeededClips.length}/${queue.length} exported)`
        : `Completed ${succeededClips.length}/${queue.length} exports`
    );
  };

  // Studio Export with Burned-in Animated Captions (Single or Batch)
  const handleStudioExport = async (overridePlatform?: ExportPlatform) => {
    const queue = selectedClips;
    if (queue.length === 0) return;

    const targetPlatform = overridePlatform || selectedPlatform;
    const targetPreset = PLATFORM_PRESETS[targetPlatform];

    cancelBatchRef.current = false;
    setLastExportKind('batch');
    setIsExporting(true);
    setBatchCompleted(false);
    setExportProgress(0);
    setExportStatusText(`Initializing ${targetPreset.label} 9:16 render pipeline...`);
    setDownloadUrl(null);
    setExportedBlob(null);
    setExportedFilename('');

    const initialMap: Record<string, BatchClipResult> = {};
    queue.forEach((c) => {
      initialMap[c.id] = { clip: c, status: 'queued' };
    });
    setBatchResults(initialMap);

    let firstSuccess: { blob: Blob; filename: string; downloadUrl: string } | null = null;
    const succeededClips: ClipHighlight[] = [];

    for (let i = 0; i < queue.length; i++) {
      const clip = queue[i];
      if (cancelBatchRef.current) {
        setBatchResults((prev) => ({
          ...prev,
          [clip.id]: { clip, status: 'cancelled' },
        }));
        continue;
      }

      setBatchResults((prev) => ({
        ...prev,
        [clip.id]: { clip, status: 'exporting' },
      }));

      try {
        const rendered = await renderStudioSingleClip(clip, targetPlatform, (prog, text) => {
          const overall = Math.round(((i + prog / 100) / queue.length) * 100);
          setExportProgress(overall);
          setExportStatusText(
            queue.length === 1
              ? text
              : `Studio batch ${i + 1}/${queue.length} (${clip.title.slice(0, 22)}): ${text}`
          );
        });

        if (!firstSuccess) {
          firstSuccess = rendered;
        }
        succeededClips.push(clip);

        setBatchResults((prev) => ({
          ...prev,
          [clip.id]: {
            clip,
            status: 'done',
            blob: rendered.blob,
            filename: rendered.filename,
            downloadUrl: rendered.downloadUrl,
          },
        }));

        downloadBlob(rendered.blob, rendered.filename);
        if (i < queue.length - 1) {
          await new Promise((r) => setTimeout(r, 280));
        }

        recordExportToFirestore(clip, targetPlatform, rendered.filename);
      } catch (err: any) {
        console.error('Studio export error:', err);
        setBatchResults((prev) => ({
          ...prev,
          [clip.id]: {
            clip,
            status: 'error',
            error: err?.message || 'Render failed',
          },
        }));
      }
    }

    if (firstSuccess) {
      setExportedBlob(firstSuccess.blob);
      setExportedFilename(firstSuccess.filename);
      setDownloadUrl(firstSuccess.downloadUrl);
    }

    if (succeededClips.length > 0) {
      const targetAccount = workspacePrefs.autoApplyAccounts
        ? getDefaultAccountForPlatform(targetPlatform)
        : undefined;
      const copied = await copyPlatformCaptionSilently(
        succeededClips[0],
        targetPlatform,
        targetAccount
      );
      if (copied) setCopiedCaption(true);
    }

    setExportProgress(100);
    setBatchCompleted(true);
    setIsExporting(false);
    setExportStatusText(
      cancelBatchRef.current
        ? `Studio batch cancelled (${succeededClips.length}/${queue.length} rendered)`
        : `Completed ${succeededClips.length}/${queue.length} Studio renders`
    );
  };

  // Merge multiple selected clips into 1 continuous 9:16 consolidated highlight reel MP4
  const handleMergeCompilation = async (
    overridePlatform?: ExportPlatform,
    clipsOverride?: ClipHighlight[],
    resolutionOverride?: '1080p' | '720p',
    burnOverride?: boolean
  ) => {
    const targets = (clipsOverride || selectedClips).slice(0, 10);
    if (targets.length < 2) return;
    const targetPlatform = overridePlatform || selectedPlatform;
    const targetPreset = PLATFORM_PRESETS[targetPlatform];
    const targetRes = resolutionOverride || resolution;
    const shouldBurn =
      typeof burnOverride === 'boolean' ? burnOverride : burnServerCaptions;
    const targetAccount = workspacePrefs.autoApplyAccounts
      ? getDefaultAccountForPlatform(targetPlatform)
      : undefined;

    cancelBatchRef.current = false;
    setLastExportKind('reel');
    setIsExporting(true);
    setBatchCompleted(false);
    setExportProgress(18);
    setExportStatusText(
      `Stitching ${targets.length} clips into 1 ${targetPreset.label} highlight reel MP4...`
    );
    setDownloadUrl(null);
    setExportedBlob(null);
    setExportedFilename('');
    setBatchResults({});

    try {
      const merged = await mergeSelectedClipsCompilation({
        clips: targets,
        videoSource,
        settings,
        platform: targetPlatform,
        resolution: targetRes,
        burnCaptions: shouldBurn,
        account: targetAccount,
      });

      setExportedBlob(merged.blob);
      setExportedFilename(merged.filename);
      setDownloadUrl(merged.downloadUrl);
      downloadBlob(merged.blob, merged.filename);
      if (merged.captionCopied) setCopiedCaption(true);

      const leadClip = targets[0];
      setBatchResults({
        [leadClip.id]: {
          clip: {
            ...leadClip,
            title: `${videoSource.title} (${merged.clipCount}-Clip Highlight Reel)`,
          },
          status: 'done',
          blob: merged.blob,
          filename: merged.filename,
          downloadUrl: merged.downloadUrl,
        },
      });

      logClipExport({
        platform: targetPlatform,
        clipId: `reel_${Date.now()}`,
        clipTitle: `${videoSource.title} (${merged.clipCount}-Clip Highlight Reel)`,
        sourceVideoTitle: videoSource.title,
        filename: merged.filename,
        captionCopy: socialCaptionText,
        durationSec: merged.duration || reelDuration,
        viralityScore: Math.max(...targets.map((c) => c.viralityScore)),
        status: 'exported',
        accountId: targetAccount?.id,
        accountHandle: targetAccount?.handle,
      }).catch(() => {});

      setExportProgress(100);
      setBatchCompleted(true);
      setExportStatusText(`Created ${merged.clipCount}-clip highlight reel (${merged.filename})`);
    } catch (err: any) {
      const leadClip = targets[0];
      setBatchResults({
        [leadClip.id]: {
          clip: leadClip,
          status: 'error',
          error: err?.message || 'Highlight reel merge failed',
        },
      });
      setBatchCompleted(true);
      setExportStatusText(err?.message || 'Highlight reel merge failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadVideo = () => {
    const doneItems = Object.values(batchResults).filter((r) => r.status === 'done' && r.blob);
    if (doneItems.length > 1) {
      doneItems.forEach((item, idx) => {
        setTimeout(() => {
          if (item.blob) {
            downloadBlob(
              item.blob,
              item.filename || buildPlatformFilename(item.clip, selectedPlatform, 'mp4')
            );
          }
        }, idx * 200);
      });
      return;
    }

    if (!exportedBlob) return;
    downloadBlob(
      exportedBlob,
      exportedFilename || buildPlatformFilename(primaryClip, selectedPlatform, 'mp4')
    );
  };

  const handleDownloadSrt = () => {
    if (exportMode === 'reel' && selectedClips.length >= 2) {
      const targets = selectedClips.slice(0, 10);
      const srtContent = generateConsolidatedSrtFile(targets);
      const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
      const slug = (videoSource.title || 'clipforge')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 32);
      downloadBlob(blob, `${slug || 'clipforge'}_${selectedPlatform}_highlight_reel.srt`);
      return;
    }

    const targets = selectedClips.length > 0 ? selectedClips : [primaryClip];
    targets.forEach((clip, idx) => {
      setTimeout(() => {
        const srtContent = generateSrtFile(clip.captions);
        const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, buildPlatformFilename(clip, selectedPlatform, 'srt'));
      }, idx * 160);
    });
  };

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(socialCaptionText);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const handleNativeShare = async () => {
    if (!exportedBlob) return;
    await shareClipNatively(
      exportedBlob,
      exportedFilename || buildPlatformFilename(primaryClip, selectedPlatform, 'mp4'),
      primaryClip,
      selectedPlatform,
      autoLinkedAccount
    );
  };

  const platformIconMap: Record<ExportPlatform, React.ReactNode> = {
    shorts: <Youtube className="w-4 h-4 text-red-500" />,
    tiktok: <Music2 className="w-4 h-4 text-cyan-400" />,
  };

  const batchResultList = Object.values(batchResults);
  const doneResults = batchResultList.filter((r) => r.status === 'done');
  const errorResults = batchResultList.filter((r) => r.status === 'error');
  const isBatchResultView = batchResultList.length > 1;
  const showNativeShare =
    !isBatchResultView && canNativeShareFiles(exportedBlob, exportedFilename || 'clip.mp4');

  const formatRange = (clip: ClipHighlight) => {
    const fmt = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${String(s).padStart(2, '0')}`;
    };
    return `${fmt(clip.startTime)}–${fmt(clip.endTime)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-semibold text-zinc-100 text-sm">
                {exportMode === 'reel'
                  ? `Highlight Reel (${Math.min(10, selectedClips.length)} clips) · ${activePreset.label}`
                  : selectedClips.length > 1
                  ? `Batch Export ${selectedClips.length} Clips to ${activePreset.label}`
                  : `Export to ${activePreset.label}`}
              </h3>
              <p className="text-xs text-zinc-500">
                {exportMode === 'reel'
                  ? 'Single continuous 9:16 compilation MP4 + consolidated captions'
                  : '1-click 9:16 package + auto-copied caption & upload link'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Platform Shortcuts Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-zinc-300">
                Destination Shortcut
              </label>
              <span className="text-[10px] font-mono text-zinc-500">
                Hotkeys: Shift+Y / Shift+T
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['shorts', 'tiktok'] as ExportPlatform[]).map((platformId) => {
                const p = PLATFORM_PRESETS[platformId];
                const isSelected = selectedPlatform === platformId;
                const linkedAcc = workspacePrefs.autoApplyAccounts
                  ? getDefaultAccountForPlatform(platformId)
                  : undefined;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isExporting}
                    onClick={() => handleSelectPlatform(platformId)}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer space-y-1 disabled:opacity-60 ${
                      isSelected
                        ? 'bg-zinc-800 border-emerald-500 text-white ring-1 ring-emerald-500/30'
                        : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      {platformIconMap[platformId]}
                      <kbd className="text-[9px] font-mono px-1 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-400">
                        {p.shortcut}
                      </kbd>
                    </div>
                    <div className="text-xs font-semibold text-zinc-100">{p.shortLabel}</div>
                    <div className="text-[10px] text-zinc-400 font-mono truncate">
                      {linkedAcc ? linkedAcc.handle : p.tag}
                    </div>
                  </button>
                );
              })}
            </div>
            {onManageAccounts && (
              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <span className="text-zinc-500">
                  Target:{' '}
                  <span className="font-mono text-zinc-300">
                    {!workspacePrefs.autoApplyAccounts
                      ? 'Auto-apply paused'
                      : autoLinkedAccount?.handle || 'No account linked'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onManageAccounts(selectedPlatform)}
                  className="text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                >
                  {getDefaultAccountForPlatform(selectedPlatform)
                    ? 'Switch / Manage Account'
                    : `+ Connect ${activePreset.shortLabel} Account`}
                </button>
              </div>
            )}
          </div>

          {/* Resolution & Framerate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Resolution
              </label>
              <select
                value={resolution}
                disabled={isExporting}
                onChange={(e) => setResolution(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer disabled:opacity-60"
              >
                <option value="1080p">1080 x 1920 (Full HD)</option>
                <option value="720p">720 x 1280 (Fast 720p)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Framerate
              </label>
              <select
                value={framerate}
                disabled={isExporting}
                onChange={(e) => setFramerate(Number(e.target.value) as any)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer disabled:opacity-60"
              >
                <option value={30}>30 FPS (Standard)</option>
                <option value={60}>60 FPS (Smooth Shorts)</option>
              </select>
            </div>
          </div>

          {/* Export Format Mode Switch: Batch vs Consolidated Highlight Reel */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Multi-Clip Output Mode
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => {
                  setExportMode('batch');
                  setBatchCompleted(false);
                }}
                className={`py-2 px-3 rounded-lg text-left transition-colors cursor-pointer disabled:opacity-60 ${
                  exportMode === 'batch'
                    ? 'bg-emerald-500/15 border border-emerald-500/40 text-white'
                    : 'border border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Layers className={`w-3.5 h-3.5 ${exportMode === 'batch' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span>Batch Clips</span>
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Separate MP4 per selected clip
                </div>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => {
                  setExportMode('reel');
                  setBatchCompleted(false);
                }}
                className={`py-2 px-3 rounded-lg text-left transition-colors cursor-pointer disabled:opacity-60 ${
                  exportMode === 'reel'
                    ? 'bg-violet-500/15 border border-violet-500/45 text-white'
                    : 'border border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Film className={`w-3.5 h-3.5 ${exportMode === 'reel' ? 'text-violet-400' : 'text-zinc-500'}`} />
                  <span>Highlight Reel</span>
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Stitch 2–10 clips into 1 MP4
                </div>
              </button>
            </div>
          </div>

          {/* Multi-Clip Feed Selector List */}
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-2 min-w-0">
                {exportMode === 'reel' ? (
                  <Film className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                ) : (
                  <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="text-xs font-semibold text-zinc-200 truncate">
                  Feed Clips ({selectedClips.length}/{availableClips.length})
                </span>
                {selectedClips.length > 0 && (
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                    {exportMode === 'reel'
                      ? `${reelDuration}s reel`
                      : `${totalSelectedDuration}s total`}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {selectedClips.length > 0 && !isExporting && (
                  <button
                    type="button"
                    onClick={() => setSelectedClipIds([])}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 underline underline-offset-2 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-300 hover:text-white cursor-pointer select-none">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    disabled={isExporting}
                    onChange={handleToggleSelectAll}
                    className="accent-emerald-500 w-3.5 h-3.5 rounded cursor-pointer disabled:opacity-50"
                  />
                  <span>Select All</span>
                </label>
              </div>
            </div>

            {exportMode === 'reel' && selectedClips.length > 10 && (
              <div className="px-3.5 py-1.5 bg-amber-500/10 border-b border-amber-500/25 text-[10px] text-amber-300">
                Consolidated highlight reels support up to 10 clips at once — the first 10 checked clips will be stitched.
              </div>
            )}

            <div className="max-h-48 overflow-y-auto divide-y divide-zinc-800/70">
              {availableClips.map((clip, idx) => {
                const isChecked = selectedClipIds.includes(clip.id);
                const orderIdx = selectedClipIds.indexOf(clip.id);
                const dur = Math.max(1, Math.round(clip.endTime - clip.startTime));
                const job = batchResults[clip.id];
                const isCurrent = clip.id === activeClip.id;
                const isExcludedByCap = exportMode === 'reel' && orderIdx >= 10;

                return (
                  <div
                    key={clip.id}
                    className={`flex items-center justify-between gap-2 px-3.5 py-2 text-xs transition-colors ${
                      isChecked
                        ? isExcludedByCap
                          ? 'bg-amber-500/5'
                          : exportMode === 'reel'
                          ? 'bg-violet-500/10 hover:bg-violet-500/15'
                          : 'bg-emerald-500/5 hover:bg-emerald-500/10'
                        : 'hover:bg-zinc-900/70'
                    }`}
                  >
                    <label
                      className={`flex items-center gap-2.5 min-w-0 flex-1 ${
                        isExporting ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isExporting}
                        onChange={() => handleToggleClip(clip.id)}
                        className="accent-emerald-500 w-3.5 h-3.5 rounded cursor-pointer shrink-0 disabled:opacity-50"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isChecked && exportMode === 'reel' ? (
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono text-[9px] shrink-0 ${
                                isExcludedByCap
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-violet-500/25 text-violet-200'
                              }`}
                            >
                              {isExcludedByCap ? 'Over cap' : `Part ${orderIdx + 1}`}
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                              #{idx + 1}
                            </span>
                          )}
                          <span className="font-medium text-zinc-200 truncate">{clip.title}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] font-mono text-zinc-400 shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500">
                          {formatRange(clip)} · {dur}s · {clip.viralityScore}% score
                        </div>
                      </div>
                    </label>

                    <div className="shrink-0 flex items-center gap-1">
                      {isChecked && exportMode === 'reel' && selectedClipIds.length > 1 && !isExporting && (
                        <div className="flex items-center gap-0.5 mr-1">
                          <button
                            type="button"
                            disabled={orderIdx === 0}
                            onClick={() => handleMoveSelectedClip(clip.id, -1)}
                            title="Move earlier in reel"
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-default"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={orderIdx === selectedClipIds.length - 1}
                            onClick={() => handleMoveSelectedClip(clip.id, 1)}
                            title="Move later in reel"
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-default"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {job?.status === 'queued' && (
                        <span className="text-[10px] font-mono text-zinc-500">Queued</span>
                      )}
                      {job?.status === 'exporting' && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      )}
                      {job?.status === 'done' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (job.blob) {
                              downloadBlob(
                                job.blob,
                                job.filename ||
                                  buildPlatformFilename(clip, selectedPlatform, 'mp4')
                              );
                            }
                          }}
                          title="Download clip"
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                      )}
                      {job?.status === 'error' && (
                        <span
                          title={job.error || 'Failed'}
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-400"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Failed</span>
                        </span>
                      )}
                      {job?.status === 'cancelled' && (
                        <span className="text-[10px] font-mono text-zinc-500">Cancelled</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Export Action / Progress */}
          {isYoutubeEmbedOnly ? (
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3 text-xs">
              <p className="text-zinc-300 leading-relaxed">
                YouTube blocks direct MP4 downloads from cloud server IPs. Export your timed{' '}
                <span className="text-emerald-400 font-semibold">.SRT subtitles</span> and
                auto-copied {activePreset.label} caption below, then jump straight to{' '}
                {activePreset.label}:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleDownloadSrt}
                  disabled={
                    selectedClips.length === 0 ||
                    (exportMode === 'reel' && selectedClips.length < 2)
                  }
                  className="py-2.5 px-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40"
                >
                  <FileText className="w-4 h-4" />
                  <span>
                    {exportMode === 'reel' && selectedClips.length >= 2
                      ? `Consolidated .SRT (${reelClips.length} clips)`
                      : selectedClips.length > 1
                      ? `Download ${selectedClips.length} .SRT Files`
                      : `Download .SRT (${primaryClip.captions.length})`}
                  </span>
                </button>
                <a
                  href={activePreset.uploadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>{activePreset.uploadCta}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : isExporting ? (
            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-zinc-300 flex items-center gap-2 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
                  <span className="truncate">{exportStatusText}</span>
                </span>
                <span className="font-mono text-emerald-400 font-semibold tabular-nums shrink-0">
                  {exportProgress}%
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-200"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              {exportMode === 'batch' && selectedClips.length > 1 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      cancelBatchRef.current = true;
                    }}
                    className="text-[11px] font-medium text-zinc-400 hover:text-rose-300 cursor-pointer"
                  >
                    Cancel remaining clips
                  </button>
                </div>
              )}
            </div>
          ) : batchCompleted && (doneResults.length > 0 || errorResults.length > 0) ? (
            <div
              className={`p-4 rounded-xl border space-y-3 ${
                doneResults.length > 0
                  ? 'bg-emerald-500/10 border-emerald-500/25'
                  : 'bg-rose-500/10 border-rose-500/30'
              }`}
            >
              <div
                className={`flex items-center justify-between font-medium text-xs ${
                  doneResults.length > 0 ? 'text-emerald-400' : 'text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {doneResults.length > 0 ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {lastExportKind === 'reel'
                      ? doneResults.length > 0
                        ? `Consolidated highlight reel exported & caption copied`
                        : errorResults[0]?.error || 'Highlight reel export failed'
                      : isBatchResultView
                      ? `Batch finished: ${doneResults.length}/${batchResultList.length} ${activePreset.label} clips exported`
                      : doneResults.length > 0
                      ? `${activePreset.label} clip exported & caption copied`
                      : errorResults[0]?.error || 'Clip export failed'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBatchCompleted(false);
                    setBatchResults({});
                    setDownloadUrl(null);
                  }}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 underline underline-offset-2 cursor-pointer"
                >
                  {lastExportKind === 'reel' ? 'New Reel' : 'New Export'}
                </button>
              </div>

              {doneResults.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleDownloadVideo}
                    className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 border border-zinc-700 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {lastExportKind === 'reel'
                        ? 'Download Reel (.MP4)'
                        : doneResults.length > 1
                        ? `Download All (${doneResults.length})`
                        : 'Download Again'}
                    </span>
                  </button>

                  <button
                    onClick={handleDownloadSrt}
                    className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 border border-zinc-700 cursor-pointer transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>
                      {exportMode === 'reel' && selectedClips.length >= 2
                        ? 'Consolidated .SRT'
                        : selectedClips.length > 1
                        ? `All .SRT (${selectedClips.length})`
                        : '.SRT Captions'}
                    </span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <a
                  href={activePreset.uploadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  {platformIconMap[selectedPlatform]}
                  <span>{activePreset.uploadCta}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                {showNativeShare && (
                  <button
                    onClick={handleNativeShare}
                    className="py-2.5 px-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    title="Share video via OS Share Sheet"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
                <span className="text-xs text-zinc-200 font-medium">
                  Burn Styled Subtitles into Server MP4
                </span>
                <input
                  type="checkbox"
                  checked={burnServerCaptions}
                  onChange={(e) => setBurnServerCaptions(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>

              {exportMode === 'reel' ? (
                <>
                  {selectedClips.length < 2 && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400">
                      <span>Select at least 2 feed clips to stitch a highlight reel.</span>
                      {availableClips.length >= 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedClipIds(availableClips.slice(0, 10).map((c) => c.id))
                          }
                          className="text-violet-400 hover:text-violet-300 font-semibold shrink-0 cursor-pointer"
                        >
                          Select All ({Math.min(10, availableClips.length)})
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleMergeCompilation()}
                    disabled={selectedClips.length < 2}
                    className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Film className="w-4 h-4" />
                    <span>
                      {selectedClips.length < 2
                        ? 'Select 2+ Clips to Build Highlight Reel'
                        : `Export Consolidated Highlight Reel (${reelClips.length} Clips · ${reelDuration}s)`}
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadSrt}
                      disabled={selectedClips.length < 2}
                      className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 border border-zinc-700 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FileText className="w-3.5 h-3.5 text-violet-400" />
                      <span>Consolidated .SRT</span>
                    </button>

                    <a
                      href={activePreset.uploadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 border border-zinc-800 transition-colors"
                    >
                      <span>{activePreset.uploadCta}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleFastClipExport()}
                    disabled={selectedClips.length === 0}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {selectedClips.length === 0
                        ? 'Select at least 1 clip to export'
                        : selectedClips.length > 1
                        ? `Batch Export ${selectedClips.length} Clips for ${activePreset.label} (${resolution})`
                        : `Quick Export for ${activePreset.label} (${resolution})`}
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleStudioExport()}
                      disabled={selectedClips.length === 0}
                      className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 border border-zinc-700 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      <span>
                        {selectedClips.length > 1
                          ? `Batch Studio (${selectedClips.length})`
                          : 'Studio Render'}
                      </span>
                    </button>

                    <a
                      href={activePreset.uploadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 border border-zinc-800 transition-colors"
                    >
                      <span>{activePreset.uploadCta}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Platform-Tailored Social Caption Copy */}
          <div className="pt-3 border-t border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                {exportMode === 'reel' && selectedClips.length >= 2
                  ? `${activePreset.label} Highlight Reel Description (${reelClips.length} clips)`
                  : selectedClips.length > 1
                  ? `${activePreset.label} Batch Captions & Hashtags (${selectedClips.length} clips)`
                  : `${activePreset.label} Caption & Hashtags`}
              </label>
              <button
                onClick={handleCopyCaption}
                disabled={selectedClips.length === 0}
                className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer disabled:opacity-40"
              >
                {copiedCaption ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCaption ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <textarea
              readOnly
              value={socialCaptionText}
              rows={selectedClips.length > 1 ? 4 : 3}
              className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 resize-none font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

