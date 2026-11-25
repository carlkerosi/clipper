import React, { useState, useEffect } from 'react';
import {
  X,
  Youtube,
  Music2,
  Loader2,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Link2,
  Search,
  UserPlus,
  Layers,
  Cloud,
  HardDrive,
} from 'lucide-react';
import { SocialAccount, SocialPlatform } from '../types';
import {
  PLATFORM_PRESETS,
  normalizeSocialProfileUrl,
  parseSocialHandleAndUrl,
} from '../utils/platformExport';
import { useFirebase } from '../contexts/FirebaseContext';
import { parseJsonResponse } from '../utils/safeFetchJson';

interface AddSocialAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlatform?: SocialPlatform;
  editingAccount?: SocialAccount | null;
  onSaved?: (msg: string) => void;
}

interface OAuthSetupInfo {
  platform: SocialPlatform;
  redirectUri: string;
  requiredEnvVars: string[];
  setupGuideUrl: string;
}

type AddMode = 'manual' | 'both' | 'oauth';

export const AddSocialAccountModal: React.FC<AddSocialAccountModalProps> = ({
  isOpen,
  onClose,
  initialPlatform = 'shorts',
  editingAccount = null,
  onSaved,
}) => {
  const { user, isSigningIn, signInWithGoogle, addSocialAccount, updateSocialAccount } =
    useFirebase();

  const [mode, setMode] = useState<AddMode>('manual');

  // Single Manual / OAuth fields
  const [platform, setPlatform] = useState<SocialPlatform>(initialPlatform);
  const [handleInput, setHandleInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [followersCount, setFollowersCount] = useState<string>('0');
  const [postsCount, setPostsCount] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [profileUrlTouched, setProfileUrlTouched] = useState(false);

  // Quick Add Both (Shorts + TikTok) fields
  const [shortsHandle, setShortsHandle] = useState('');
  const [shortsName, setShortsName] = useState('');
  const [shortsSubs, setShortsSubs] = useState('0');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [tiktokName, setTiktokName] = useState('');
  const [tiktokFollowers, setTiktokFollowers] = useState('0');
  const [bothNotes, setBothNotes] = useState('');
  const [bothSetPrimary, setBothSetPrimary] = useState(true);

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupNotice, setLookupNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [oauthSetupInfo, setOauthSetupInfo] = useState<OAuthSetupInfo | null>(null);
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setLookupNotice(null);
    setOauthSetupInfo(null);

    if (editingAccount) {
      setMode('manual');
      setPlatform(editingAccount.platform);
      setHandleInput(editingAccount.handle);
      setDisplayName(editingAccount.displayName);
      setProfileUrl(editingAccount.profileUrl);
      setAvatarUrl(editingAccount.avatarUrl);
      setFollowersCount(String(editingAccount.followersCount || 0));
      setPostsCount(String(editingAccount.postsCount || 0));
      setNotes(editingAccount.notes || '');
      setIsDefault(editingAccount.isDefault);
      setDisplayNameTouched(true);
      setProfileUrlTouched(true);
    } else {
      setMode('manual');
      setPlatform(initialPlatform);
      setHandleInput('');
      setDisplayName('');
      setProfileUrl('');
      setAvatarUrl('');
      setFollowersCount('0');
      setPostsCount('0');
      setNotes('');
      setIsDefault(true);
      setDisplayNameTouched(false);
      setProfileUrlTouched(false);

      setShortsHandle('');
      setShortsName('');
      setShortsSubs('0');
      setTiktokHandle('');
      setTiktokName('');
      setTiktokFollowers('0');
      setBothNotes('');
      setBothSetPrimary(true);
    }
  }, [isOpen, initialPlatform, editingAccount]);

  // Listen for 3P OAuth popup completion
  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'SOCIAL_OAUTH_SUCCESS' && event.data?.profile) {
        const oauthPlatform = (event.data.platform as SocialPlatform) || platform;
        const p = event.data.profile;
        setIsConnectingOAuth(false);
        try {
          await addSocialAccount({
            platform: oauthPlatform,
            handle: p.handle || '@creator',
            displayName: p.displayName || p.handle || 'Connected Creator',
            profileUrl: p.profileUrl || '',
            avatarUrl: p.avatarUrl || '',
            connectionType: 'oauth',
            isDefault: true,
            followersCount: Number(p.followersCount) || 0,
            postsCount: Number(p.postsCount) || 0,
            notes: 'Connected via OAuth 2.0',
            lastSyncedAt: new Date().toISOString(),
          });
          onSaved?.(
            `Connected ${PLATFORM_PRESETS[oauthPlatform].label} (${p.handle}) via OAuth.`
          );
          onClose();
        } catch (err: any) {
          setErrorMsg(err?.message || 'Could not save OAuth-connected account.');
        }
      } else if (event.data?.type === 'SOCIAL_OAUTH_ERROR') {
        setIsConnectingOAuth(false);
        setErrorMsg(event.data?.error || 'OAuth authorization was cancelled or failed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, platform, addSocialAccount, onSaved, onClose]);

  if (!isOpen) return null;

  const platformIcon: Record<SocialPlatform, React.ReactNode> = {
    shorts: <Youtube className="w-4 h-4 text-red-400 shrink-0" />,
    tiktok: <Music2 className="w-4 h-4 text-cyan-400 shrink-0" />,
  };

  const handleManualHandleChange = (val: string) => {
    setHandleInput(val);
    setErrorMsg(null);
    if (!val.trim()) {
      if (!displayNameTouched) setDisplayName('');
      if (!profileUrlTouched) setProfileUrl('');
      return;
    }
    const parsed = parseSocialHandleAndUrl(platform, val);
    if (!displayNameTouched) {
      setDisplayName(parsed.displayName);
    }
    if (!profileUrlTouched) {
      setProfileUrl(parsed.profileUrl);
    }
  };

  const handlePlatformChange = (nextPlatform: SocialPlatform) => {
    setPlatform(nextPlatform);
    setOauthSetupInfo(null);
    setErrorMsg(null);
    if (handleInput.trim() && !profileUrlTouched) {
      const parsed = parseSocialHandleAndUrl(nextPlatform, handleInput);
      setProfileUrl(parsed.profileUrl);
    }
  };

  const handleLookupChannel = async () => {
    if (!handleInput.trim()) {
      setErrorMsg('Enter a @handle or channel URL first.');
      return;
    }
    setIsLookingUp(true);
    setErrorMsg(null);
    setLookupNotice(null);
    try {
      const res = await fetch('/api/social/lookup-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, handleOrUrl: handleInput.trim() }),
      });
      const data = await parseJsonResponse(res, 'Could not look up account');
      if (!res.ok) {
        throw new Error(data.error || 'Could not look up account');
      }
      const p = data.profile || {};
      if (p.handle) setHandleInput(p.handle);
      if (p.displayName) {
        setDisplayName(p.displayName);
        setDisplayNameTouched(true);
      }
      if (p.profileUrl) {
        setProfileUrl(p.profileUrl);
        setProfileUrlTouched(true);
      }
      if (p.avatarUrl) setAvatarUrl(p.avatarUrl);
      if (typeof p.followersCount === 'number' && p.followersCount > 0) {
        setFollowersCount(String(p.followersCount));
      }
      if (typeof p.postsCount === 'number' && p.postsCount > 0) {
        setPostsCount(String(p.postsCount));
      }
      setLookupNotice(
        data.verifiedFromSource
          ? 'Fetched live channel details from YouTube.'
          : 'Auto-filled handle & link cleanly. Adjust anything below and save.'
      );
    } catch {
      const parsed = parseSocialHandleAndUrl(platform, handleInput);
      setHandleInput(parsed.handle);
      if (!displayNameTouched) setDisplayName(parsed.displayName);
      if (!profileUrlTouched) setProfileUrl(parsed.profileUrl);
      setLookupNotice('Auto-formatted handle and link locally — ready to save manually.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleConnectOAuth = async () => {
    setIsConnectingOAuth(true);
    setErrorMsg(null);
    setOauthSetupInfo(null);
    try {
      const res = await fetch(`/api/social/oauth/${platform}/url`);
      const data = await parseJsonResponse(res, 'Failed to prepare OAuth URL');
      if (!res.ok) {
        throw new Error(data.error || 'Failed to prepare OAuth URL');
      }
      if (!data.configured) {
        setIsConnectingOAuth(false);
        setOauthSetupInfo({
          platform,
          redirectUri: data.redirectUri,
          requiredEnvVars: data.requiredEnvVars || [],
          setupGuideUrl: data.setupGuideUrl || '',
        });
        return;
      }

      const popup = window.open(data.url, 'oauth_popup', 'width=600,height=700');
      if (!popup) {
        setIsConnectingOAuth(false);
        setErrorMsg('Popup blocked. Please allow popups or switch to Manual Entry.');
      }
    } catch (err: any) {
      setIsConnectingOAuth(false);
      setErrorMsg(err?.message || 'Could not initiate OAuth.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (mode === 'both' && !editingAccount) {
      const hasShorts = Boolean(shortsHandle.trim());
      const hasTiktok = Boolean(tiktokHandle.trim());
      if (!hasShorts && !hasTiktok) {
        setErrorMsg('Enter at least one handle or link for YouTube Shorts or TikTok.');
        return;
      }

      setIsSaving(true);
      try {
        const addedLabels: string[] = [];
        if (hasShorts) {
          const parsed = parseSocialHandleAndUrl('shorts', shortsHandle);
          await addSocialAccount({
            platform: 'shorts',
            handle: parsed.handle,
            displayName: shortsName.trim() || parsed.displayName,
            profileUrl: parsed.profileUrl,
            avatarUrl: '',
            connectionType: 'linked',
            isDefault: bothSetPrimary,
            followersCount: Number(shortsSubs) || 0,
            postsCount: 0,
            notes: bothNotes.trim(),
            lastSyncedAt: new Date().toISOString(),
          });
          addedLabels.push(`YouTube Shorts (${parsed.handle})`);
        }
        if (hasTiktok) {
          const parsed = parseSocialHandleAndUrl('tiktok', tiktokHandle);
          await addSocialAccount({
            platform: 'tiktok',
            handle: parsed.handle,
            displayName: tiktokName.trim() || parsed.displayName,
            profileUrl: parsed.profileUrl,
            avatarUrl: '',
            connectionType: 'linked',
            isDefault: bothSetPrimary,
            followersCount: Number(tiktokFollowers) || 0,
            postsCount: 0,
            notes: bothNotes.trim(),
            lastSyncedAt: new Date().toISOString(),
          });
          addedLabels.push(`TikTok (${parsed.handle})`);
        }

        const storageNote = user ? '' : ' (saved locally)';
        onSaved?.(`Added ${addedLabels.join(' & ')}${storageNote}.`);
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Could not save social accounts.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!handleInput.trim()) {
      setErrorMsg('Please enter an account @handle or channel URL.');
      return;
    }

    setIsSaving(true);
    try {
      const parsed = parseSocialHandleAndUrl(platform, handleInput, profileUrl);
      const inferredName = displayName.trim() || parsed.displayName || 'Creator';
      const normalizedUrl = normalizeSocialProfileUrl(profileUrl) || parsed.profileUrl;
      const normalizedAvatar = normalizeSocialProfileUrl(avatarUrl);

      if (editingAccount) {
        await updateSocialAccount(editingAccount.id, {
          handle: parsed.handle,
          displayName: inferredName,
          profileUrl: normalizedUrl,
          avatarUrl: normalizedAvatar,
          followersCount: Number(followersCount) || 0,
          postsCount: Number(postsCount) || 0,
          notes: notes.trim(),
          lastSyncedAt: new Date().toISOString(),
        });
        onSaved?.(`Updated ${parsed.handle} (${PLATFORM_PRESETS[platform].label}).`);
      } else {
        await addSocialAccount({
          platform,
          handle: parsed.handle,
          displayName: inferredName,
          profileUrl: normalizedUrl,
          avatarUrl: normalizedAvatar,
          connectionType: 'linked',
          isDefault,
          followersCount: Number(followersCount) || 0,
          postsCount: Number(postsCount) || 0,
          notes: notes.trim(),
          lastSyncedAt: new Date().toISOString(),
        });
        const storageNote = user ? '' : ' (saved locally)';
        onSaved?.(`Added ${PLATFORM_PRESETS[platform].label} account ${parsed.handle}${storageNote}.`);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save social account.');
    } finally {
      setIsSaving(false);
    }
  };

  const preset = PLATFORM_PRESETS[platform];
  const livePreview =
    handleInput.trim() ? parseSocialHandleAndUrl(platform, handleInput, profileUrl) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5 min-w-0">
            {mode === 'both' ? (
              <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              platformIcon[platform]
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-zinc-100 truncate">
                {editingAccount
                  ? `Edit ${preset.label} Account`
                  : 'Add Social Media Account'}
              </h3>
              <p className="text-xs text-zinc-500 truncate">
                Add manually in seconds — works immediately with or without OAuth
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {/* Storage sync status strip (non-blocking) */}
          <div className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-zinc-400 min-w-0">
              {user ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">
                    Synced to <span className="text-zinc-200">{user.email || 'Google account'}</span>
                  </span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">
                    Instant local save · No login required
                  </span>
                </>
              )}
            </div>
            {!user && (
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={isSigningIn}
                className="text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isSigningIn ? 'Signing in...' : 'Google Sync'}
              </button>
            )}
          </div>

          {/* Entry Method Selector */}
          {!editingAccount && (
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setMode('manual');
                  setErrorMsg(null);
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  mode === 'manual'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Manual</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('both');
                  setErrorMsg(null);
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  mode === 'both'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Add Both</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('oauth');
                  setErrorMsg(null);
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  mode === 'oauth'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>OAuth</span>
              </button>
            </div>
          )}

          {/* Platform Picker (for Manual or OAuth mode) */}
          {!editingAccount && mode !== 'both' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Platform</label>
              <div className="grid grid-cols-2 gap-2">
                {(['shorts', 'tiktok'] as SocialPlatform[]).map((pid) => {
                  const p = PLATFORM_PRESETS[pid];
                  const active = platform === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => handlePlatformChange(pid)}
                      className={`px-3 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        active
                          ? 'bg-zinc-800 border-emerald-500 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {platformIcon[pid]}
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODE: OAUTH */}
          {mode === 'oauth' && !editingAccount && (
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Connect via {preset.label} OAuth 2.0</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Authorize {preset.label} directly to pull verified handle, avatar, and live subscriber counts.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleConnectOAuth}
                  disabled={isConnectingOAuth}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isConnectingOAuth ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  <span>Connect {preset.shortLabel} OAuth</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 cursor-pointer"
                >
                  Use Manual Entry Instead
                </button>
              </div>

              {oauthSetupInfo && (
                <div className="pt-3 border-t border-zinc-800 space-y-2 text-[11px] text-zinc-400">
                  <p className="text-amber-300 font-medium">
                    OAuth app credentials are not configured on this server yet. You can switch to Manual Entry right now with zero setup, or add these environment secrets:
                  </p>
                  <div className="font-mono text-[10px] text-zinc-300 bg-zinc-900 p-2.5 rounded border border-zinc-800 space-y-1">
                    <div>
                      Secrets:{' '}
                      <span className="text-emerald-400">
                        {oauthSetupInfo.requiredEnvVars.join(', ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">Callback: {oauthSetupInfo.redirectUri}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(oauthSetupInfo.redirectUri);
                          setCopiedUri(true);
                          setTimeout(() => setCopiedUri(false), 1500);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 shrink-0 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedUri ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUri ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                  {oauthSetupInfo.setupGuideUrl && (
                    <a
                      href={oauthSetupInfo.setupGuideUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      <span>Open Developer Console</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MODE: QUICK ADD BOTH */}
          {mode === 'both' && !editingAccount && (
            <div className="space-y-3.5">
              {/* YouTube Shorts row */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
                  <Youtube className="w-4 h-4 text-red-400" />
                  <span>YouTube Shorts Account</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={shortsHandle}
                    onChange={(e) => {
                      setShortsHandle(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="@handle or channel URL"
                    className="sm:col-span-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="number"
                    min={0}
                    value={shortsSubs}
                    onChange={(e) => setShortsSubs(e.target.value)}
                    placeholder="Subs"
                    title="Subscribers (optional)"
                    className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono tabular-nums text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <input
                  type="text"
                  value={shortsName}
                  onChange={(e) => setShortsName(e.target.value)}
                  placeholder="Channel display name (optional — auto-fills from handle)"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* TikTok row */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
                  <Music2 className="w-4 h-4 text-cyan-400" />
                  <span>TikTok Account</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={tiktokHandle}
                    onChange={(e) => {
                      setTiktokHandle(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="@handle or tiktok URL"
                    className="sm:col-span-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="number"
                    min={0}
                    value={tiktokFollowers}
                    onChange={(e) => setTiktokFollowers(e.target.value)}
                    placeholder="Followers"
                    title="Followers (optional)"
                    className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono tabular-nums text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <input
                  type="text"
                  value={tiktokName}
                  onChange={(e) => setTiktokName(e.target.value)}
                  placeholder="Display name (optional — auto-fills from handle)"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <input
                type="text"
                maxLength={300}
                value={bothNotes}
                onChange={(e) => setBothNotes(e.target.value)}
                placeholder="Shared schedule or CTA note (optional)"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />

              <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer">
                <span className="text-xs text-zinc-300">
                  Set both as primary 1-click export targets
                </span>
                <input
                  type="checkbox"
                  checked={bothSetPrimary}
                  onChange={(e) => setBothSetPrimary(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          )}

          {/* MODE: MANUAL ENTRY (OR EDIT) */}
          {(mode === 'manual' || editingAccount) && (
            <>
              {/* Handle / URL + Optional Auto-Fill */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-zinc-300">
                    {preset.label} Handle or Channel Link
                  </label>
                  {livePreview && (
                    <span className="text-[11px] font-mono text-emerald-400">
                      {livePreview.handle}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={handleInput}
                    onChange={(e) => handleManualHandleChange(e.target.value)}
                    placeholder={
                      platform === 'shorts'
                        ? '@yourchannel or https://youtube.com/@yourchannel'
                        : '@yourtiktok or https://tiktok.com/@yourtiktok'
                    }
                    className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleLookupChannel}
                    disabled={isLookingUp}
                    title="Optional: try fetching public channel avatar & subscriber count"
                    className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isLookingUp ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>Auto-Fill</span>
                  </button>
                </div>
                {lookupNotice && <p className="text-[11px] text-emerald-400">{lookupNotice}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayNameTouched(true);
                      setDisplayName(e.target.value);
                    }}
                    placeholder="Channel or brand name"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">Profile Link</label>
                  <input
                    type="text"
                    value={profileUrl}
                    onChange={(e) => {
                      setProfileUrlTouched(true);
                      setProfileUrl(e.target.value);
                    }}
                    placeholder={
                      platform === 'shorts'
                        ? 'https://www.youtube.com/@handle'
                        : 'https://www.tiktok.com/@handle'
                    }
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    {platform === 'shorts' ? 'Subscribers' : 'Followers'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={followersCount}
                    onChange={(e) => setFollowersCount(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Existing Posts / Videos
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={postsCount}
                    onChange={(e) => setPostsCount(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Avatar Image URL (optional)
                  </label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Posting Schedule / CTA Note
                  </label>
                  <input
                    type="text"
                    maxLength={300}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Daily 6pm EST clips"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {!editingAccount && (
                <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer">
                  <span className="text-xs text-zinc-300">
                    Set as primary {preset.shortLabel} export target
                  </span>
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="accent-emerald-500 w-4 h-4 cursor-pointer"
                  />
                </label>
              )}
            </>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 cursor-pointer"
            >
              Cancel
            </button>
            {mode !== 'oauth' && (
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {editingAccount
                    ? 'Save Changes'
                    : mode === 'both'
                      ? 'Save Accounts'
                      : 'Save Account'}
                </span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
