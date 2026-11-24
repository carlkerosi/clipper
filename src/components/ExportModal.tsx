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
} from 'lucide-react';
import { ClipHighlight, ExportSettings, VideoSource } from '../types';
import { exportVerticalVideo, generateSrtFile, downloadBlob } from '../utils/exportVideo';
import { parseJsonResponse } from '../utils/safeFetchJson';
import {
  ExportPlatform,
  PLATFORM_PRESETS,
  buildPlatformFilename,
  buildPlatformSocialCopy,
  copyPlatformCaptionSilently,
  canNativeShareFiles,
  shareClipNatively,
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
  autoStartNonce = 0,
  onManageAccounts,
}) => {
  const { getDefaultAccountForPlatform, logClipExport, workspacePrefs } = useFirebase();
  const [selectedPlatform, setSelectedPlatform] = useState<ExportPlatform>(initialPlatform);
  const [resolution, setResolution] = useState<'1080p' | '720p'>(
    PLATFORM_PRESETS[initialPlatform].recommendedResolution
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

  const selectedClips = useMemo(
    () => availableClips.filter((c) => selectedClipIds.includes(c.id)),
    [availableClips, selectedClipIds]
  );

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

  // Sync modal defaults when opened or clip changes
  useEffect(() => {
    if (!isOpen) return;
    const preset = PLATFORM_PRESETS[initialPlatform];
    cancelBatchRef.current = false;
    setSelectedPlatform(initialPlatform);
    setResolution(preset.recommendedResolution);
    setFramerate(preset.recommendedFramerate);
    setSelectedClipIds([activeClip.id]);
    setIsExporting(false);
    setDownloadUrl(null);
    setExportedBlob(null);
    setExportedFilename('');
    setExportProgress(0);
    setExportStatusText('');
    setBatchResults({});
    setBatchCompleted(false);
    setCopiedCaption(false);
  }, [isOpen, initialPlatform, activeClip.id]);

  // Auto-trigger 1-click export when launched via Header shortcut or Shift+Y/T
  useEffect(() => {
    if (!isOpen || autoStartNonce === 0 || autoStartNonce === lastHandledNonceRef.current) {
      return;
    }
    lastHandledNonceRef.current = autoStartNonce;

    if (isYoutubeEmbedOnly) {
      const autoAcc = workspacePrefs.autoApplyAccounts
        ? getDefaultAccountForPlatform(initialPlatform)
        : undefined;
      copyPlatformCaptionSilently(activeClip, initialPlatform, autoAcc).then((ok) => {
        if (ok) setCopiedCaption(true);
      });
      return;
    }

    handleFastClipExport(initialPlatform, [activeClip]);
  }, [isOpen, autoStartNonce, initialPlatform, isYoutubeEmbedOnly]);

  if (!isOpen) return null;

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

  const socialCaptionText =
    selectedClips.length <= 1
      ? buildPlatformSocialCopy(primaryClip, selectedPlatform, autoLinkedAccount)
      : selectedClips
          .map(
            (clip, idx) =>
              `[Clip ${idx + 1}: ${clip.title}]\n${buildPlatformSocialCopy(
                clip,
                selectedPlatform,
                autoLinkedAccount
              )}`
          )
          .join('\n\n---\n\n');

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

  const renderServerSingleClip = async (
    clip: ClipHighlight,
    targetPlatform: ExportPlatform,
    targetRes: '1080p' | '720p'
  ): Promise<{ blob: Blob; filename: string; downloadUrl: string }> => {
    const clipDuration = Math.max(1, Math.round(clip.endTime - clip.startTime));
    const response = await fetch('/api/clip-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: videoSource.videoUrl,
        playableSourceUrl: videoSource.playableSourceUrl,
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
        burnCaptions: burnServerCaptions,
        captions: clip.captions,
        captionColor: settings.captionColor,
        captionBaseColor: settings.captionBaseColor,
        captionPosition: settings.captionPosition,
        captionFontSize: settings.captionFontSize,
        captionFontFamily: settings.captionFontFamily,
        captionTextCase: settings.captionTextCase,
        captionOutlineWidth: settings.captionOutlineWidth,
        captionDropShadow: settings.captionDropShadow,
      }),
    });

    const data = await parseJsonResponse(response, 'Export failed');
    if (!response.ok || !data.downloadUrl) {
      throw new Error(data.error || 'Server clipping service returned ' + response.status);
    }

    const clipFileRes = await fetch(data.downloadUrl);
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
      (videoSource.videoUrl.startsWith('/') ? videoSource.videoUrl : '');
    const isClipOnly = !fullSrc && Boolean(clip.clipVideoUrl);

    let videoToUse =
      clip.id === activeClip.id && videoRef.current && videoRef.current.readyState >= 2
        ? videoRef.current
        : null;

    if (!videoToUse) {
      videoToUse = document.createElement('video');
      videoToUse.src = fullSrc || clip.clipVideoUrl || videoSource.videoUrl;
      videoToUse.crossOrigin = 'anonymous';
      videoToUse.playsInline = true;
      videoToUse.muted = true;
      await new Promise<void>((resolve) => {
        videoToUse!.onloadedmetadata = () => resolve();
        videoToUse!.onerror = () => resolve();
        setTimeout(resolve, 3000);
      });
    }

    const blob = await exportVerticalVideo({
      videoElement: videoToUse,
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
      onProgress: onClipProgress,
    });

    const targetFilename = buildPlatformFilename(clip, targetPlatform, 'webm');
    const url = URL.createObjectURL(blob);
    return { blob, filename: targetFilename, downloadUrl: url };
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
    clipsOverride?: ClipHighlight[]
  ) => {
    const queue = clipsOverride || selectedClips;
    if (queue.length === 0) return;

    const targetPlatform = overridePlatform || selectedPlatform;
    const targetPreset = PLATFORM_PRESETS[targetPlatform];
    const targetRes = overridePlatform ? targetPreset.recommendedResolution : resolution;

    cancelBatchRef.current = false;
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
          ? burnServerCaptions
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
          rendered = await renderServerSingleClip(clip, targetPlatform, targetRes);
        } catch (serverErr: any) {
          if (queue.length === 1) {
            console.warn('Fast export fallback to canvas render:', serverErr);
            rendered = await renderStudioSingleClip(clip, targetPlatform, (prog, text) => {
              setExportProgress(prog);
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
          await new Promise((r) => setTimeout(r, 180));
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

        if (queue.length > 1) {
          downloadBlob(rendered.blob, rendered.filename);
          await new Promise((r) => setTimeout(r, 180));
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
                {selectedClips.length > 1
                  ? `Batch Export ${selectedClips.length} Clips to ${activePreset.label}`
                  : `Export to ${activePreset.label}`}
              </h3>
              <p className="text-xs text-zinc-500">
                1-click 9:16 package + auto-copied caption & upload link
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

          {/* Multi-Clip Batch Selector List */}
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-zinc-200 truncate">
                  Clips to Export ({selectedClips.length}/{availableClips.length})
                </span>
                {selectedClips.length > 0 && (
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                    {totalSelectedDuration}s total
                  </span>
                )}
              </div>

              <label className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-300 hover:text-white cursor-pointer select-none shrink-0">
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

            <div className="max-h-44 overflow-y-auto divide-y divide-zinc-800/70">
              {availableClips.map((clip, idx) => {
                const isChecked = selectedClipIds.includes(clip.id);
                const dur = Math.max(1, Math.round(clip.endTime - clip.startTime));
                const job = batchResults[clip.id];
                const isCurrent = clip.id === activeClip.id;

                return (
                  <label
                    key={clip.id}
                    className={`flex items-center justify-between gap-2.5 px-3.5 py-2 text-xs transition-colors cursor-pointer ${
                      isChecked ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'hover:bg-zinc-900/70'
                    } ${isExporting ? 'cursor-default' : ''}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isExporting}
                        onChange={() => handleToggleClip(clip.id)}
                        className="accent-emerald-500 w-3.5 h-3.5 rounded cursor-pointer shrink-0 disabled:opacity-50"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                            #{idx + 1}
                          </span>
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
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {job?.status === 'queued' && (
                        <span className="text-[10px] font-mono text-zinc-500">Queued</span>
                      )}
                      {job?.status === 'exporting' && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      )}
                      {job?.status === 'done' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
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
                  </label>
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
                  disabled={selectedClips.length === 0}
                  className="py-2.5 px-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40"
                >
                  <FileText className="w-4 h-4" />
                  <span>
                    {selectedClips.length > 1
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
              {selectedClips.length > 1 && (
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
                    {isBatchResultView
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
                  New Batch
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
                      {doneResults.length > 1
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
                      {selectedClips.length > 1
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
            </div>
          )}

          {/* Platform-Tailored Social Caption Copy */}
          <div className="pt-3 border-t border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                {selectedClips.length > 1
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

