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
} from 'lucide-react';
import { SocialAccount, SocialPlatform } from '../types';
import { PLATFORM_PRESETS } from '../utils/platformExport';
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

export const AddSocialAccountModal: React.FC<AddSocialAccountModalProps> = ({
  isOpen,
  onClose,
  initialPlatform = 'shorts',
  editingAccount = null,
  onSaved,
}) => {
  const { user, signInWithGoogle, addSocialAccount, updateSocialAccount } = useFirebase();

  const [platform, setPlatform] = useState<SocialPlatform>(initialPlatform);
  const [handleInput, setHandleInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [followersCount, setFollowersCount] = useState<string>('0');
  const [postsCount, setPostsCount] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [isDefault, setIsDefault] = useState(true);

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
      setPlatform(editingAccount.platform);
      setHandleInput(editingAccount.handle);
      setDisplayName(editingAccount.displayName);
      setProfileUrl(editingAccount.profileUrl);
      setAvatarUrl(editingAccount.avatarUrl);
      setFollowersCount(String(editingAccount.followersCount || 0));
      setPostsCount(String(editingAccount.postsCount || 0));
      setNotes(editingAccount.notes || '');
      setIsDefault(editingAccount.isDefault);
    } else {
      setPlatform(initialPlatform);
      setHandleInput('');
      setDisplayName('');
      setProfileUrl('');
      setAvatarUrl('');
      setFollowersCount('0');
      setPostsCount('0');
      setNotes('');
      setIsDefault(true);
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
          if (!user) {
            await signInWithGoogle();
          }
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
          onSaved?.(`Connected ${PLATFORM_PRESETS[oauthPlatform].label} (${p.handle}) via OAuth.`);
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
  }, [isOpen, platform, user, signInWithGoogle, addSocialAccount, onSaved, onClose]);

  if (!isOpen) return null;

  const platformIcon: Record<SocialPlatform, React.ReactNode> = {
    shorts: <Youtube className="w-4 h-4 text-red-400" />,
    tiktok: <Music2 className="w-4 h-4 text-cyan-400" />,
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
      if (p.displayName) setDisplayName(p.displayName);
      if (p.profileUrl) setProfileUrl(p.profileUrl);
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
          : 'Normalized handle and profile link. Verify details below and save.'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Account lookup failed.');
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
        setErrorMsg('Popup blocked. Please allow popups for this site or link by handle below.');
      }
    } catch (err: any) {
      setIsConnectingOAuth(false);
      setErrorMsg(err?.message || 'Could not initiate OAuth.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user) {
      const signedIn = await signInWithGoogle();
      if (!signedIn) return;
    }

    if (!handleInput.trim()) {
      setErrorMsg('Please enter an account @handle or channel URL.');
      return;
    }

    setIsSaving(true);
    try {
      const cleanHandle = handleInput.trim();
      const inferredName =
        displayName.trim() || cleanHandle.replace(/^@+/, '').split('/').pop() || 'Creator';

      if (editingAccount) {
        await updateSocialAccount(editingAccount.id, {
          displayName: inferredName,
          profileUrl: profileUrl.trim(),
          avatarUrl: avatarUrl.trim(),
          followersCount: Number(followersCount) || 0,
          postsCount: Number(postsCount) || 0,
          notes: notes.trim(),
          lastSyncedAt: new Date().toISOString(),
        });
        onSaved?.(`Updated ${editingAccount.handle} (${PLATFORM_PRESETS[platform].label}).`);
      } else {
        await addSocialAccount({
          platform,
          handle: cleanHandle,
          displayName: inferredName,
          profileUrl: profileUrl.trim(),
          avatarUrl: avatarUrl.trim(),
          connectionType: 'linked',
          isDefault,
          followersCount: Number(followersCount) || 0,
          postsCount: Number(postsCount) || 0,
          notes: notes.trim(),
          lastSyncedAt: new Date().toISOString(),
        });
        onSaved?.(`Added ${PLATFORM_PRESETS[platform].label} account ${cleanHandle}.`);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save social account.');
    } finally {
      setIsSaving(false);
    }
  };

  const preset = PLATFORM_PRESETS[platform];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            {platformIcon[platform]}
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                {editingAccount
                  ? `Edit ${preset.label} Account`
                  : 'Add Social Media Account'}
              </h3>
              <p className="text-xs text-zinc-500">
                Link your respective channel for YouTube Shorts or TikTok
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {/* Platform Picker */}
          {!editingAccount && (
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
                      onClick={() => {
                        setPlatform(pid);
                        setOauthSetupInfo(null);
                        setErrorMsg(null);
                      }}
                      className={`px-3 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        active
                          ? 'bg-zinc-800 border-emerald-500 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {platformIcon[pid]}
                      <span>{p.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Optional OAuth Connect Strip */}
          {!editingAccount && (
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Connect via {preset.label} OAuth</span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Sign in directly with {preset.shortLabel} to auto-sync followers & video stats.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleConnectOAuth}
                  disabled={isConnectingOAuth}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-100 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  {isConnectingOAuth ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Connect OAuth</span>
                </button>
              </div>

              {oauthSetupInfo && (
                <div className="pt-2.5 border-t border-zinc-800 space-y-2 text-[11px] text-zinc-400">
                  <p className="text-amber-300 font-medium">
                    OAuth credentials are not configured yet for {preset.label}. Link by @handle below right now, or add these Secrets to enable OAuth:
                  </p>
                  <div className="font-mono text-[10px] text-zinc-300 bg-zinc-900 p-2 rounded border border-zinc-800 space-y-1">
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

          {/* Handle / URL + Auto Lookup */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              {preset.label} Handle or Channel URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                disabled={Boolean(editingAccount)}
                placeholder={
                  platform === 'shorts'
                    ? '@yourchannel or https://youtube.com/@yourchannel'
                    : '@yourtiktok or https://tiktok.com/@yourtiktok'
                }
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
              />
              {!editingAccount && (
                <button
                  type="button"
                  onClick={handleLookupChannel}
                  disabled={isLookingUp}
                  className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isLookingUp ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Lookup</span>
                </button>
              )}
            </div>
            {lookupNotice && <p className="text-[11px] text-emerald-400">{lookupNotice}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Channel or brand name"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-300">Profile URL</label>
              <input
                type="url"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://..."
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

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Channel Focus / Posting Schedule Note
            </label>
            <input
              type="text"
              maxLength={300}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Daily 6pm EST podcast clips"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
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
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingAccount ? 'Save Changes' : 'Save Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
