import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Youtube,
  Music2,
  Plus,
  ExternalLink,
  RefreshCw,
  Trash2,
  Star,
  Edit3,
  Search,
  Copy,
  Check,
  Loader2,
  LogIn,
  LogOut,
  BarChart3,
  CheckCircle2,
  Clock,
  UploadCloud,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ClipHighlight,
  ClipPublishStatus,
  PublishedClipRecord,
  SocialAccount,
  SocialPlatform,
  VideoSource,
} from '../types';
import { PLATFORM_PRESETS, buildPlatformSocialCopy } from '../utils/platformExport';
import { useFirebase } from '../contexts/FirebaseContext';
import { AddSocialAccountModal } from './AddSocialAccountModal';
import { parseJsonResponse } from '../utils/safeFetchJson';

interface MonitoringDashboardProps {
  currentVideo: VideoSource;
  highlights: ClipHighlight[];
  onGoToClips: () => void;
  onNotify?: (msg: string) => void;
}

function formatCompactNum(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatTimeAgo(isoOrTs: any): string {
  if (!isoOrTs) return 'Just now';
  let ms = 0;
  if (typeof isoOrTs === 'string') {
    ms = Date.parse(isoOrTs) || 0;
  } else if (typeof isoOrTs?.toMillis === 'function') {
    ms = isoOrTs.toMillis();
  } else if (typeof isoOrTs?.seconds === 'number') {
    ms = isoOrTs.seconds * 1000;
  }
  if (!ms) return 'Just now';
  const diffMin = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  currentVideo,
  highlights,
  onGoToClips,
  onNotify,
}) => {
  const {
    user,
    authReady,
    isSigningIn,
    authError,
    isLoadingData,
    socialAccounts,
    publishedClips,
    workspacePrefs,
    workspacePrefsLoaded,
    getDefaultAccountForPlatform,
    signInWithGoogle,
    signOutUser,
    updateSocialAccount,
    setDefaultSocialAccount,
    removeSocialAccount,
    logClipExport,
    updatePublishedClip,
    deletePublishedClip,
    updateWorkspacePrefs,
    autoApplyPrimaryAccountsToClips,
  } = useFirebase();

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalPlatform, setAccountModalPlatform] = useState<SocialPlatform>('shorts');
  const [editingAccount, setEditingAccount] = useState<SocialAccount | null>(null);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [isAutoApplying, setIsAutoApplying] = useState(false);

  const hasAutoSyncedUidRef = useRef<string | null>(null);

  // Filters for monitoring table
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | SocialPlatform>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ClipPublishStatus>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);

  // Track / Edit Post Modal
  const [editingRecord, setEditingRecord] = useState<PublishedClipRecord | null>(null);
  const [editStatus, setEditStatus] = useState<ClipPublishStatus>('exported');
  const [editAccountId, setEditAccountId] = useState<string>('');
  const [editPostUrl, setEditPostUrl] = useState<string>('');
  const [editScheduledFor, setEditScheduledFor] = useState<string>('');
  const [editViews, setEditViews] = useState<string>('0');
  const [editLikes, setEditLikes] = useState<string>('0');
  const [editComments, setEditComments] = useState<string>('0');
  const [editShares, setEditShares] = useState<string>('0');
  const [isFetchingPostStats, setIsFetchingPostStats] = useState(false);
  const [postLookupMsg, setPostLookupMsg] = useState<string | null>(null);
  const [isSavingRecord, setIsSavingRecord] = useState(false);

  // Manual Log Clip Modal
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logClipId, setLogClipId] = useState<string>(highlights[0]?.id || 'custom');
  const [logCustomTitle, setLogCustomTitle] = useState<string>('');
  const [logPlatform, setLogPlatform] = useState<SocialPlatform>('shorts');
  const [logStatus, setLogStatus] = useState<ClipPublishStatus>('published');
  const [logPostUrl, setLogPostUrl] = useState<string>('');
  const [logViews, setLogViews] = useState<string>('0');
  const [logLikes, setLogLikes] = useState<string>('0');
  const [isLoggingManual, setIsLoggingManual] = useState(false);

  const platformIcon: Record<SocialPlatform, React.ReactNode> = {
    shorts: <Youtube className="w-4 h-4 text-red-400 shrink-0" />,
    tiktok: <Music2 className="w-4 h-4 text-cyan-400 shrink-0" />,
  };

  const accountsByPlatform = useMemo(() => {
    return {
      shorts: socialAccounts.filter((a) => a.platform === 'shorts'),
      tiktok: socialAccounts.filter((a) => a.platform === 'tiktok'),
    };
  }, [socialAccounts]);

  const portfolioStats = useMemo(() => {
    const totalAccounts = socialAccounts.length;
    const totalFollowers = socialAccounts.reduce((acc, a) => acc + (a.followersCount || 0), 0);
    const totalClips = publishedClips.length;
    const publishedCount = publishedClips.filter((c) => c.status === 'published').length;
    const scheduledCount = publishedClips.filter((c) => c.status === 'scheduled').length;
    const exportedCount = publishedClips.filter((c) => c.status === 'exported').length;
    const totalViews = publishedClips.reduce((acc, c) => acc + (c.views || 0), 0);
    const totalLikes = publishedClips.reduce((acc, c) => acc + (c.likes || 0), 0);
    const totalComments = publishedClips.reduce((acc, c) => acc + (c.comments || 0), 0);
    const totalShares = publishedClips.reduce((acc, c) => acc + (c.shares || 0), 0);
    const totalEngagements = totalLikes + totalComments + totalShares;
    const engagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;

    return {
      totalAccounts,
      totalFollowers,
      totalClips,
      publishedCount,
      scheduledCount,
      exportedCount,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalEngagements,
      engagementRate,
    };
  }, [socialAccounts, publishedClips]);

  const platformBreakdown = useMemo(() => {
    return (['shorts', 'tiktok'] as SocialPlatform[]).map((pid) => {
      const accs = accountsByPlatform[pid];
      const rows = publishedClips.filter((r) => r.platform === pid);
      const published = rows.filter((r) => r.status === 'published').length;
      const scheduled = rows.filter((r) => r.status === 'scheduled').length;
      const exported = rows.filter((r) => r.status === 'exported').length;
      const views = rows.reduce((s, r) => s + (r.views || 0), 0);
      const likes = rows.reduce((s, r) => s + (r.likes || 0), 0);
      const engagements = rows.reduce(
        (s, r) => s + (r.likes || 0) + (r.comments || 0) + (r.shares || 0),
        0
      );
      const rate = views > 0 ? (engagements / views) * 100 : 0;
      const followers = accs.reduce((s, a) => s + (a.followersCount || 0), 0);
      return {
        platform: pid,
        label: PLATFORM_PRESETS[pid].label,
        accountsCount: accs.length,
        followers,
        totalClips: rows.length,
        published,
        scheduled,
        exported,
        views,
        likes,
        rate,
      };
    });
  }, [accountsByPlatform, publishedClips]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return publishedClips.filter((rec) => {
      if (platformFilter !== 'all' && rec.platform !== platformFilter) return false;
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
      if (accountFilter !== 'all' && rec.accountId !== accountFilter) return false;
      if (q) {
        const hay = `${rec.clipTitle} ${rec.sourceVideoTitle} ${rec.accountHandle} ${rec.filename}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [publishedClips, platformFilter, statusFilter, accountFilter, searchQuery]);

  const openAddAccount = (platform: SocialPlatform) => {
    setEditingAccount(null);
    setAccountModalPlatform(platform);
    setAccountModalOpen(true);
  };

  const openEditAccount = (account: SocialAccount) => {
    setEditingAccount(account);
    setAccountModalPlatform(account.platform);
    setAccountModalOpen(true);
  };

  const handleSyncAccount = async (account: SocialAccount, silent = false): Promise<boolean> => {
    setSyncingAccountId(account.id);
    try {
      const res = await fetch('/api/social/lookup-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: account.platform,
          handleOrUrl: account.profileUrl || account.handle,
        }),
      });
      const data = await parseJsonResponse(res, 'Could not refresh account');
      if (res.ok && data.profile) {
        await updateSocialAccount(account.id, {
          displayName: data.profile.displayName || account.displayName,
          avatarUrl: data.profile.avatarUrl || account.avatarUrl,
          followersCount:
            typeof data.profile.followersCount === 'number' && data.profile.followersCount > 0
              ? data.profile.followersCount
              : account.followersCount,
          postsCount:
            typeof data.profile.postsCount === 'number' && data.profile.postsCount > 0
              ? data.profile.postsCount
              : account.postsCount,
          lastSyncedAt: new Date().toISOString(),
        });
        if (!silent) {
          onNotify?.(
            data.verifiedFromSource
              ? `Synced live stats for ${account.handle}.`
              : `Updated sync timestamp for ${account.handle}.`
          );
        }
        return Boolean(data.verifiedFromSource);
      }
      return false;
    } catch (err: any) {
      if (!silent) {
        onNotify?.(err?.message || 'Could not refresh account.');
      }
      return false;
    } finally {
      setSyncingAccountId(null);
    }
  };

  // Auto-sync live YouTube channel stats once per session when Dashboard opens
  useEffect(() => {
    if (!user) {
      hasAutoSyncedUidRef.current = null;
      return;
    }
    if (
      !workspacePrefsLoaded ||
      !workspacePrefs.autoSyncStatsOnOpen ||
      hasAutoSyncedUidRef.current === user.uid
    ) {
      return;
    }
    const ytAccounts = socialAccounts.filter((a) => a.platform === 'shorts');
    if (ytAccounts.length === 0) return;

    hasAutoSyncedUidRef.current = user.uid;
    (async () => {
      for (const acc of ytAccounts) {
        await handleSyncAccount(acc, true);
      }
    })();
  }, [user, workspacePrefsLoaded, workspacePrefs.autoSyncStatsOnOpen, socialAccounts]);

  const handleAutoApplyNow = async () => {
    setIsAutoApplying(true);
    try {
      const assignedCount = await autoApplyPrimaryAccountsToClips();
      let syncedCount = 0;
      const ytAccounts = socialAccounts.filter((a) => a.platform === 'shorts');
      for (const acc of ytAccounts) {
        const ok = await handleSyncAccount(acc, true);
        if (ok) syncedCount += 1;
      }

      if (assignedCount > 0 || syncedCount > 0) {
        onNotify?.(
          `Auto-applied primary accounts to ${assignedCount} clip(s) and synced ${syncedCount} YouTube channel(s).`
        );
      } else {
        onNotify?.('All tracked clips already have primary accounts and channel stats are up to date.');
      }
    } catch (err: any) {
      onNotify?.(err?.message || 'Auto-apply could not complete.');
    } finally {
      setIsAutoApplying(false);
    }
  };

  const openTrackRecord = (rec: PublishedClipRecord) => {
    setEditingRecord(rec);
    setEditStatus(rec.status);
    setEditAccountId(rec.accountId);
    setEditPostUrl(rec.postUrl || '');
    setEditScheduledFor(rec.scheduledFor || '');
    setEditViews(String(rec.views || 0));
    setEditLikes(String(rec.likes || 0));
    setEditComments(String(rec.comments || 0));
    setEditShares(String(rec.shares || 0));
    setPostLookupMsg(null);
  };

  const handleFetchPostMetrics = async () => {
    if (!editingRecord || !editPostUrl.trim()) return;
    setIsFetchingPostStats(true);
    setPostLookupMsg(null);
    try {
      const res = await fetch('/api/social/lookup-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: editingRecord.platform,
          postUrl: editPostUrl.trim(),
        }),
      });
      const data = await parseJsonResponse(res, 'Could not fetch live post stats');
      if (!res.ok || !data.metrics) {
        throw new Error(data.error || 'Could not fetch live post stats');
      }
      setEditViews(String(data.metrics.views || 0));
      setEditLikes(String(data.metrics.likes || 0));
      setEditComments(String(data.metrics.comments || 0));
      setEditShares(String(data.metrics.shares || 0));
      setEditStatus('published');
      setPostLookupMsg('Fetched live views & engagement counts.');
    } catch (err: any) {
      setPostLookupMsg(err?.message || 'Auto-fetch unavailable; enter metrics manually below.');
    } finally {
      setIsFetchingPostStats(false);
    }
  };

  const handleSaveRecordChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setIsSavingRecord(true);
    try {
      const matchedAccount = socialAccounts.find((a) => a.id === editAccountId);
      const nextStatus: ClipPublishStatus =
        editingRecord.status === 'published' ? 'published' : editStatus;

      await updatePublishedClip(editingRecord.id, {
        status: nextStatus,
        accountId: matchedAccount?.id || editingRecord.accountId,
        accountHandle: matchedAccount?.handle || editingRecord.accountHandle,
        postUrl: editPostUrl.trim(),
        scheduledFor: editScheduledFor.trim(),
        views: Number(editViews) || 0,
        likes: Number(editLikes) || 0,
        comments: Number(editComments) || 0,
        shares: Number(editShares) || 0,
      });
      onNotify?.(`Updated tracking for "${editingRecord.clipTitle}".`);
      setEditingRecord(null);
    } catch (err: any) {
      setPostLookupMsg(err?.message || 'Could not save tracking update.');
    } finally {
      setIsSavingRecord(false);
    }
  };

  const handleLogManualClip = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingManual(true);
    try {
      const selectedClip = highlights.find((h) => h.id === logClipId);
      const title =
        logClipId === 'custom'
          ? logCustomTitle.trim() || 'Custom Short Clip'
          : selectedClip?.title || 'Viral Short Clip';
      const durationSec = selectedClip
        ? Math.max(1, Math.round(selectedClip.endTime - selectedClip.startTime))
        : 30;
      const targetAccount = workspacePrefs.autoApplyAccounts
        ? getDefaultAccountForPlatform(logPlatform)
        : undefined;
      const captionCopy = selectedClip
        ? buildPlatformSocialCopy(selectedClip, logPlatform, targetAccount)
        : title;

      await logClipExport({
        platform: logPlatform,
        clipId: selectedClip?.id || `manual_${Date.now()}`,
        clipTitle: title,
        sourceVideoTitle: currentVideo.title,
        filename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 28)}.mp4`,
        captionCopy,
        durationSec,
        viralityScore: selectedClip?.viralityScore || 90,
        status: logStatus,
        postUrl: logPostUrl.trim(),
        views: Number(logViews) || 0,
        likes: Number(logLikes) || 0,
        accountId: targetAccount?.id,
        accountHandle: targetAccount?.handle,
      });
      onNotify?.(`Logged clip to ${PLATFORM_PRESETS[logPlatform].label} monitor.`);
      setLogModalOpen(false);
      setLogCustomTitle('');
      setLogPostUrl('');
      setLogViews('0');
      setLogLikes('0');
    } catch (err: any) {
      onNotify?.(err?.message || 'Failed to log clip.');
    } finally {
      setIsLoggingManual(false);
    }
  };

  const renderStatusLabel = (status: ClipPublishStatus) => {
    if (status === 'published') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Published</span>
        </span>
      );
    }
    if (status === 'scheduled') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Scheduled</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 whitespace-nowrap">
        <UploadCloud className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span>Exported</span>
      </span>
    );
  };

  if (!authReady) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-xl bg-zinc-900/75 border border-zinc-800 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-zinc-900/75 border border-zinc-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Workspace Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-zinc-900/75 border border-zinc-800">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">Social Media Monitor</span>
            <span aria-hidden="true">·</span>
            <span>YouTube Shorts</span>
            <span aria-hidden="true">·</span>
            <span>TikTok</span>
          </div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">
            Accounts & Publishing Dashboard
          </h1>
          <p className="text-xs text-zinc-400">
            {user
              ? `Synced to ${user.email || user.displayName || 'your account'} · Every export and post update persists automatically.`
              : 'Saved locally in your browser — add YouTube Shorts & TikTok accounts manually anytime, or sign in with Google to cloud-sync.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => openAddAccount('shorts')}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Social Account</span>
          </button>

          <button
            type="button"
            onClick={() => setLogModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Log Clip Post</span>
          </button>

          {user ? (
            <button
              type="button"
              onClick={signOutUser}
              className="px-3 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={isSigningIn}
              className="px-3 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 border border-zinc-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
              title="Optional: sync local accounts across devices"
            >
              {isSigningIn ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogIn className="w-3.5 h-3.5" />
              )}
              <span>Google Sync</span>
            </button>
          )}
        </div>
      </div>

      {authError && (
        <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between gap-2">
          <span>
            Google Sync unavailable ({authError}) — your accounts are still saved locally without interruption.
          </span>
        </div>
      )}

      <>
          {/* Section 1: 4-Column Portfolio KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-zinc-900/75 border border-zinc-800 space-y-1">
              <div className="text-xs text-zinc-400">Connected Accounts</div>
              <div className="text-2xl font-bold text-zinc-100 font-mono tabular-nums">
                {portfolioStats.totalAccounts}
              </div>
              <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                {accountsByPlatform.shorts.length} YT · {accountsByPlatform.tiktok.length} TT
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/75 border border-zinc-800 space-y-1">
              <div className="text-xs text-zinc-400">Tracked Clips</div>
              <div className="text-2xl font-bold text-zinc-100 font-mono tabular-nums">
                {portfolioStats.totalClips}
              </div>
              <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                {portfolioStats.publishedCount} published · {portfolioStats.scheduledCount} sched ·{' '}
                {portfolioStats.exportedCount} exported
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/75 border border-zinc-800 space-y-1">
              <div className="text-xs text-zinc-400">Total Post Views</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
                {formatCompactNum(portfolioStats.totalViews)}
              </div>
              <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                {formatCompactNum(portfolioStats.totalFollowers)} combined audience
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/75 border border-zinc-800 space-y-1">
              <div className="text-xs text-zinc-400">Total Engagements</div>
              <div className="text-2xl font-bold text-zinc-100 font-mono tabular-nums">
                {formatCompactNum(portfolioStats.totalEngagements)}
              </div>
              <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                {portfolioStats.engagementRate.toFixed(1)}% engagement rate
              </div>
            </div>
          </div>

          {/* Auto-Apply Automation Controls */}
          <section className="p-4 sm:px-5 rounded-xl bg-zinc-900/75 border border-zinc-800 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Auto-Apply Automation</h2>
                <p className="text-xs text-zinc-500">
                  Saved to your profile — automatically routes primary accounts, restores Studio styles, applies AI framing, and syncs live channel metrics.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAutoApplyNow}
                disabled={isAutoApplying}
                className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 shrink-0"
              >
                {isAutoApplying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isAutoApplying ? 'Applying...' : 'Auto-Apply Now'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(
                [
                  {
                    key: 'autoApplyAccounts',
                    label: 'Primary Account Routing',
                    desc: 'Auto-assign defaults on export & sync unassigned clips',
                    checked: workspacePrefs.autoApplyAccounts,
                  },
                  {
                    key: 'autoApplyAiFraming',
                    label: 'AI Smart Framing',
                    desc: 'Auto-apply recommended crop & panX on each clip',
                    checked: workspacePrefs.autoApplyAiFraming,
                  },
                  {
                    key: 'autoApplyStyleAcrossClips',
                    label: 'Saved Style Preset',
                    desc: 'Persist & restore captions + color grade across sessions',
                    checked: workspacePrefs.autoApplyStyleAcrossClips,
                  },
                  {
                    key: 'autoSyncStatsOnOpen',
                    label: 'Live Channel Sync',
                    desc: 'Refresh YouTube stats automatically on Dashboard open',
                    checked: workspacePrefs.autoSyncStatsOnOpen,
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="switch"
                  aria-checked={item.checked}
                  onClick={() => updateWorkspacePrefs({ [item.key]: !item.checked })}
                  className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800 hover:border-zinc-700 text-left flex items-start justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs font-medium text-zinc-100">{item.label}</div>
                    <div className="text-[11px] text-zinc-500 leading-snug">{item.desc}</div>
                  </div>
                  <span
                    className={`mt-0.5 w-8 h-4.5 rounded-full p-0.5 transition-colors shrink-0 inline-flex items-center ${
                      item.checked ? 'bg-emerald-500 justify-end' : 'bg-zinc-700 justify-start'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-white" />
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Section 2: Connected Social Media Accounts by Platform */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  Social Media Accounts
                </h2>
                <p className="text-xs text-zinc-500">
                  Manage your respective accounts for each platform. Primary accounts auto-link to 1-click exports.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {(['shorts', 'tiktok'] as SocialPlatform[]).map((pid) => {
                const preset = PLATFORM_PRESETS[pid];
                const list = accountsByPlatform[pid];

                return (
                  <div
                    key={pid}
                    className="rounded-xl bg-zinc-900/75 border border-zinc-800 flex flex-col justify-between"
                  >
                    <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {platformIcon[pid]}
                        <span className="text-xs font-semibold text-zinc-100 truncate">
                          {preset.label}
                        </span>
                        <span className="text-[11px] font-mono tabular-nums text-zinc-500">
                          ({list.length})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openAddAccount(pid)}
                        className="px-2.5 py-1 rounded-md bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-emerald-400 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>

                    <div className="divide-y divide-zinc-800/80 flex-1">
                      {isLoadingData ? (
                        <div className="p-4 space-y-2">
                          <div className="h-10 rounded bg-zinc-950 animate-pulse" />
                        </div>
                      ) : list.length === 0 ? (
                        <div className="p-5 text-center space-y-2.5">
                          <p className="text-xs text-zinc-500">
                            No {preset.label} account added yet.
                          </p>
                          <button
                            type="button"
                            onClick={() => openAddAccount(pid)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Add {preset.shortLabel} Account</span>
                          </button>
                        </div>
                      ) : (
                        list.map((acc) => (
                          <div key={acc.id} className="p-4 space-y-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {acc.avatarUrl ? (
                                  <img
                                    src={acc.avatarUrl}
                                    alt={acc.displayName}
                                    referrerPolicy="no-referrer"
                                    className="w-9 h-9 rounded-full object-cover border border-zinc-700 shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-300 shrink-0">
                                    {acc.displayName.slice(0, 2).toUpperCase()}
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-zinc-100 truncate">
                                    {acc.displayName}
                                  </div>
                                  <div className="text-[11px] font-mono text-zinc-400 truncate">
                                    {acc.handle}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setDefaultSocialAccount(acc.id, acc.platform)}
                                title={
                                  acc.isDefault
                                    ? 'Primary export target'
                                    : 'Set as primary export target'
                                }
                                className={`text-[11px] font-medium flex items-center gap-1 shrink-0 cursor-pointer ${
                                  acc.isDefault
                                    ? 'text-emerald-400'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${
                                    acc.isDefault ? 'fill-emerald-400 text-emerald-400' : ''
                                  }`}
                                />
                                <span>{acc.isDefault ? 'Primary' : 'Set Primary'}</span>
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400 font-mono tabular-nums">
                              <span>{acc.connectionType === 'oauth' ? 'OAuth' : 'Linked'}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {formatCompactNum(acc.followersCount)}{' '}
                                {pid === 'shorts' ? 'subs' : 'followers'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{formatCompactNum(acc.postsCount)} posts</span>
                              <span aria-hidden="true">·</span>
                              <span className="text-zinc-500">
                                Synced {formatTimeAgo(acc.lastSyncedAt)}
                              </span>
                            </div>

                            {acc.notes && (
                              <p className="text-[11px] text-zinc-500 truncate">{acc.notes}</p>
                            )}

                            <div className="flex items-center justify-between pt-1 text-[11px]">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleSyncAccount(acc)}
                                  disabled={syncingAccountId === acc.id}
                                  className="text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <RefreshCw
                                    className={`w-3 h-3 ${
                                      syncingAccountId === acc.id ? 'animate-spin text-emerald-400' : ''
                                    }`}
                                  />
                                  <span>Sync</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openEditAccount(acc)}
                                  className="text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>

                                {acc.profileUrl && (
                                  <a
                                    href={acc.profileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                                  >
                                    <span>Profile</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => removeSocialAccount(acc.id)}
                                className="text-zinc-500 hover:text-rose-400 inline-flex items-center gap-1 cursor-pointer"
                                title="Remove account"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 3: Cross-Platform Performance Summary */}
          <section className="rounded-xl bg-zinc-900/75 border border-zinc-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-100">Platform Breakdown</h2>
              <span className="text-[11px] font-mono text-zinc-500">
                Aggregated from tracked clips & connected channels
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] font-mono text-zinc-500">
                    <th className="py-2.5 px-5 font-medium">Platform</th>
                    <th className="py-2.5 px-4 font-medium text-right">Accounts</th>
                    <th className="py-2.5 px-4 font-medium text-right">Audience</th>
                    <th className="py-2.5 px-4 font-medium text-right">Exported</th>
                    <th className="py-2.5 px-4 font-medium text-right">Scheduled</th>
                    <th className="py-2.5 px-4 font-medium text-right">Published</th>
                    <th className="py-2.5 px-4 font-medium text-right">Views</th>
                    <th className="py-2.5 px-4 font-medium text-right">Likes</th>
                    <th className="py-2.5 px-5 font-medium text-right">Eng. Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70 text-xs">
                  {platformBreakdown.map((row) => (
                    <tr key={row.platform} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 px-5 font-medium text-zinc-100">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {platformIcon[row.platform]}
                          <span>{row.label}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-300">
                        {row.accountsCount}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-300">
                        {formatCompactNum(row.followers)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-400">
                        {row.exported}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-400">
                        {row.scheduled}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-400">
                        {row.published}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-100 font-medium">
                        {formatCompactNum(row.views)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-300">
                        {formatCompactNum(row.likes)}
                      </td>
                      <td className="py-2.5 px-5 text-right font-mono tabular-nums text-zinc-300">
                        {row.rate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: Unified Clip & Publishing Monitor Table */}
          <section className="rounded-xl bg-zinc-900/75 border border-zinc-800 overflow-hidden">
            <div className="p-4 sm:px-5 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  Clip Publishing & Metrics Monitor
                </h2>
                <p className="text-xs text-zinc-500">
                  Track every exported short, attach live post URLs, and monitor views & engagement.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search clip or handle..."
                    className="pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 w-44"
                  />
                </div>

                <div className="flex items-center p-0.5 rounded-lg bg-zinc-950 border border-zinc-800">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'shorts', label: 'Shorts' },
                      { id: 'tiktok', label: 'TikTok' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPlatformFilter(opt.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        platformFilter === opt.id
                          ? 'bg-zinc-800 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  aria-label="Filter by status"
                  className="px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="exported">Exported</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                </select>

                {socialAccounts.length > 0 && (
                  <select
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                    aria-label="Filter by account"
                    className="px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[160px]"
                  >
                    <option value="all">All Accounts</option>
                    {socialAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {PLATFORM_PRESETS[a.platform].shortLabel} · {a.handle}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {isLoadingData ? (
              <div className="p-6 space-y-2.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 rounded-lg bg-zinc-950 animate-pulse" />
                ))}
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm font-medium text-zinc-200">
                  {publishedClips.length === 0
                    ? 'No exported or published clips monitored yet'
                    : 'No clips match your current filters'}
                </p>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  {publishedClips.length === 0
                    ? 'Use any YouTube Shorts or TikTok export shortcut from your Clips feed, or log an already-posted short manually.'
                    : 'Try clearing the search query or switching platform and status filters.'}
                </p>
                <div className="flex items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={onGoToClips}
                    className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer"
                  >
                    Go to Clips Feed
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogModalOpen(true)}
                    className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 cursor-pointer"
                  >
                    Log Clip Post
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[11px] font-mono text-zinc-500">
                      <th className="py-2.5 px-5 font-medium">Clip</th>
                      <th className="py-2.5 px-4 font-medium">Platform & Account</th>
                      <th className="py-2.5 px-4 font-medium">Status</th>
                      <th className="py-2.5 px-4 font-medium text-right">Views</th>
                      <th className="py-2.5 px-4 font-medium text-right">Likes</th>
                      <th className="py-2.5 px-4 font-medium text-right">Comments</th>
                      <th className="py-2.5 px-4 font-medium text-right">Shares</th>
                      <th className="py-2.5 px-5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70 text-xs">
                    {filteredRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-5 max-w-[260px]">
                          <div className="font-medium text-zinc-100 truncate" title={rec.clipTitle}>
                            {rec.clipTitle}
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate font-mono">
                            {rec.durationSec}s · {formatTimeAgo(rec.createdAt)}
                            {rec.sourceVideoTitle ? ` · ${rec.sourceVideoTitle}` : ''}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            {platformIcon[rec.platform]}
                            <div>
                              <div className="text-zinc-200 font-medium">
                                {PLATFORM_PRESETS[rec.platform].shortLabel}
                              </div>
                              <div className="text-[11px] font-mono text-zinc-500">
                                {rec.accountHandle || 'No account linked'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div>{renderStatusLabel(rec.status)}</div>
                          {rec.scheduledFor && rec.status === 'scheduled' && (
                            <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                              {rec.scheduledFor}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-100 font-medium">
                          {formatCompactNum(rec.views)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-300">
                          {formatCompactNum(rec.likes)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-400">
                          {formatCompactNum(rec.comments)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-400">
                          {formatCompactNum(rec.shares)}
                        </td>

                        <td className="py-3 px-5 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openTrackRecord(rec)}
                              className="px-2.5 py-1 rounded-md bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-emerald-400 cursor-pointer whitespace-nowrap"
                            >
                              Update
                            </button>

                            {rec.captionCopy && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(rec.captionCopy);
                                  setCopiedRowId(rec.id);
                                  setTimeout(() => setCopiedRowId(null), 1500);
                                }}
                                title="Copy platform caption"
                                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
                              >
                                {copiedRowId === rec.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            {rec.postUrl && (
                              <a
                                href={rec.postUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open live post"
                                className="p-1.5 rounded-md text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => deletePublishedClip(rec.id)}
                              title="Remove log entry"
                              className="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
      </>

      {/* Add / Edit Social Account Modal */}
      <AddSocialAccountModal
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        initialPlatform={accountModalPlatform}
        editingAccount={editingAccount}
        onSaved={(msg) => onNotify?.(msg)}
      />

      {/* Update Clip Tracking & Metrics Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/60">
              <div className="flex items-center gap-2 min-w-0">
                {platformIcon[editingRecord.platform]}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-100 truncate">
                    Track Clip Performance
                  </h3>
                  <p className="text-[11px] text-zinc-500 truncate">{editingRecord.clipTitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRecordChanges} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Status</label>
                  <select
                    value={editStatus}
                    disabled={editingRecord.status === 'published'}
                    onChange={(e) => setEditStatus(e.target.value as ClipPublishStatus)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                  >
                    <option value="exported">Exported</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Account</label>
                  <select
                    value={editAccountId}
                    onChange={(e) => setEditAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="unassigned">Unassigned</option>
                    {accountsByPlatform[editingRecord.platform].map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.handle}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {editStatus === 'scheduled' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Scheduled Date / Time
                  </label>
                  <input
                    type="text"
                    value={editScheduledFor}
                    onChange={(e) => setEditScheduledFor(e.target.value)}
                    placeholder="e.g. 2026-11-25 18:00"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Live Post URL (YouTube Short / TikTok)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={editPostUrl}
                    onChange={(e) => setEditPostUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleFetchPostMetrics}
                    disabled={isFetchingPostStats || !editPostUrl.trim()}
                    className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    {isFetchingPostStats ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>Sync Stats</span>
                  </button>
                </div>
                {postLookupMsg && <p className="text-[11px] text-zinc-400">{postLookupMsg}</p>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-[11px] text-zinc-400">Views</label>
                  <input
                    type="number"
                    min={0}
                    value={editViews}
                    onChange={(e) => setEditViews(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono tabular-nums text-zinc-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-zinc-400">Likes</label>
                  <input
                    type="number"
                    min={0}
                    value={editLikes}
                    onChange={(e) => setEditLikes(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono tabular-nums text-zinc-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-zinc-400">Comments</label>
                  <input
                    type="number"
                    min={0}
                    value={editComments}
                    onChange={(e) => setEditComments(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono tabular-nums text-zinc-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-zinc-400">Shares</label>
                  <input
                    type="number"
                    min={0}
                    value={editShares}
                    onChange={(e) => setEditShares(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono tabular-nums text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRecord}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingRecord && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Tracking</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Clip Post Modal */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/60">
              <h3 className="text-sm font-semibold text-zinc-100">Log Clip to Monitor</h3>
              <button
                type="button"
                onClick={() => setLogModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogManualClip} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">Clip</label>
                <select
                  value={logClipId}
                  onChange={(e) => setLogClipId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                >
                  {highlights.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.title}
                    </option>
                  ))}
                  <option value="custom">Custom clip title...</option>
                </select>
              </div>

              {logClipId === 'custom' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Clip Title</label>
                  <input
                    type="text"
                    required
                    value={logCustomTitle}
                    onChange={(e) => setLogCustomTitle(e.target.value)}
                    placeholder="Enter short clip title"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Platform</label>
                  <select
                    value={logPlatform}
                    onChange={(e) => setLogPlatform(e.target.value as SocialPlatform)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200"
                  >
                    <option value="shorts">YouTube Shorts</option>
                    <option value="tiktok">TikTok</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Status</label>
                  <select
                    value={logStatus}
                    onChange={(e) => setLogStatus(e.target.value as ClipPublishStatus)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200"
                  >
                    <option value="exported">Exported</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Live Post URL (optional)
                </label>
                <input
                  type="url"
                  value={logPostUrl}
                  onChange={(e) => setLogPostUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Views</label>
                  <input
                    type="number"
                    min={0}
                    value={logViews}
                    onChange={(e) => setLogViews(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono tabular-nums text-zinc-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Likes</label>
                  <input
                    type="number"
                    min={0}
                    value={logLikes}
                    onChange={(e) => setLogLikes(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono tabular-nums text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setLogModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoggingManual}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isLoggingManual && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Entry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
