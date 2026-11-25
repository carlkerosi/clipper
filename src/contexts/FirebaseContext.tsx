import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  OperationType,
  handleFirestoreError,
} from '../firebase';
import {
  AccountConnectionType,
  CaptionHighlightStyle,
  CaptionPreset,
  ClipPublishStatus,
  PublishedClipRecord,
  SocialAccount,
  SocialPlatform,
  VideoFilterPreset,
  WorkspacePreferences,
} from '../types';
import {
  normalizeSocialProfileUrl,
  parseSocialHandleAndUrl,
} from '../utils/platformExport';

export interface AddSocialAccountInput {
  platform: SocialPlatform;
  handle: string;
  displayName: string;
  profileUrl?: string;
  avatarUrl?: string;
  connectionType?: AccountConnectionType;
  isDefault?: boolean;
  followersCount?: number;
  postsCount?: number;
  notes?: string;
  lastSyncedAt?: string;
}

export interface LogClipExportInput {
  platform: SocialPlatform;
  clipId: string;
  clipTitle: string;
  sourceVideoTitle: string;
  filename: string;
  captionCopy: string;
  durationSec: number;
  viralityScore: number;
  status?: ClipPublishStatus;
  postUrl?: string;
  scheduledFor?: string;
  accountId?: string;
  accountHandle?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export interface UpdatePublishedClipPatch {
  status?: ClipPublishStatus;
  postUrl?: string;
  scheduledFor?: string;
  accountId?: string;
  accountHandle?: string;
  captionCopy?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export type WorkspacePreferencesValues = Omit<
  WorkspacePreferences,
  'id' | 'userId' | 'createdAt' | 'updatedAt'
>;

export const DEFAULT_WORKSPACE_PREFS: WorkspacePreferencesValues = {
  autoApplyAccounts: true,
  autoApplyAiFraming: true,
  autoApplyStyleAcrossClips: true,
  autoSyncStatsOnOpen: true,
  captionPreset: 'opus_box',
  captionColor: '#22C55E',
  captionHighlightStyle: 'active_box',
  videoFilter: 'none',
};

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  authError: string | null;
  isLoadingData: boolean;
  isLocalWorkspace: boolean;
  socialAccounts: SocialAccount[];
  publishedClips: PublishedClipRecord[];
  workspacePrefs: WorkspacePreferences;
  workspacePrefsLoaded: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  getDefaultAccountForPlatform: (platform: SocialPlatform) => SocialAccount | undefined;
  addSocialAccount: (input: AddSocialAccountInput) => Promise<SocialAccount>;
  updateSocialAccount: (
    accountId: string,
    patch: Partial<Omit<AddSocialAccountInput, 'platform' | 'isDefault'>>
  ) => Promise<void>;
  setDefaultSocialAccount: (accountId: string, platform: SocialPlatform) => Promise<void>;
  removeSocialAccount: (accountId: string) => Promise<void>;
  logClipExport: (input: LogClipExportInput) => Promise<PublishedClipRecord | null>;
  updatePublishedClip: (recordId: string, patch: UpdatePublishedClipPatch) => Promise<void>;
  deletePublishedClip: (recordId: string) => Promise<void>;
  updateWorkspacePrefs: (patch: Partial<WorkspacePreferencesValues>) => Promise<void>;
  autoApplyPrimaryAccountsToClips: () => Promise<number>;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

const LOCAL_ACCOUNTS_KEY = 'clipforge_local_accounts_v1';
const LOCAL_CLIPS_KEY = 'clipforge_local_clips_v1';
const LOCAL_PREFS_KEY = 'clipforge_local_prefs_v1';

function loadLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveLocalJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function sanitizeHttpUrl(url?: string): string {
  return normalizeSocialProfileUrl(url);
}

function sanitizeId(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return clean || `id_${Date.now()}`;
}

function sanitizeInt(val: unknown, max = 2000000000): number {
  const n = Math.round(Number(val) || 0);
  return Math.max(0, Math.min(max, n));
}

function sanitizeText(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val.trim() : '';
  return (s || fallback).slice(0, maxLen);
}

function timestampToMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>(() =>
    loadLocalJson<SocialAccount[]>(LOCAL_ACCOUNTS_KEY, []).filter(
      (a) => a.platform === 'shorts' || a.platform === 'tiktok'
    )
  );
  const [publishedClips, setPublishedClips] = useState<PublishedClipRecord[]>(() =>
    loadLocalJson<PublishedClipRecord[]>(LOCAL_CLIPS_KEY, []).filter(
      (c) => c.platform === 'shorts' || c.platform === 'tiktok'
    )
  );
  const [workspacePrefs, setWorkspacePrefs] = useState<WorkspacePreferences>(() => ({
    id: 'workspace',
    userId: 'local',
    ...DEFAULT_WORKSPACE_PREFS,
    ...loadLocalJson<Partial<WorkspacePreferencesValues>>(LOCAL_PREFS_KEY, {}),
  }));
  const [workspacePrefsLoaded, setWorkspacePrefsLoaded] = useState(true);

  const profileReadyUidRef = useRef<string | null>(null);
  const hasWorkspacePrefsDocRef = useRef<boolean>(false);
  const migratedLocalUidRef = useRef<string | null>(null);
  const workspacePrefsRef = useRef<WorkspacePreferences>(workspacePrefs);
  workspacePrefsRef.current = workspacePrefs;
  const socialAccountsRef = useRef<SocialAccount[]>(socialAccounts);
  socialAccountsRef.current = socialAccounts;
  const publishedClipsRef = useRef<PublishedClipRecord[]>(publishedClips);
  publishedClipsRef.current = publishedClips;

  const ensureUserDocument = useCallback(async (u: User) => {
    const userPath = `users/${u.uid}`;
    const userRef = doc(db, 'users', u.uid);
    try {
      const snap = await getDoc(userRef);
      const email = sanitizeText(u.email, 200, 'creator@example.com');
      const displayName = sanitizeText(u.displayName, 120, email.split('@')[0] || 'Creator');
      const photoUrl = sanitizeHttpUrl(u.photoURL || '');

      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: u.uid,
          email,
          displayName,
          photoUrl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(userRef, {
          email,
          displayName,
          photoUrl,
          updatedAt: serverTimestamp(),
        });
      }
      profileReadyUidRef.current = u.uid;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }, []);

  useEffect(() => {
    let unsubAccounts: (() => void) | null = null;
    let unsubClips: (() => void) | null = null;
    let unsubPrefs: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubAccounts) {
        unsubAccounts();
        unsubAccounts = null;
      }
      if (unsubClips) {
        unsubClips();
        unsubClips = null;
      }
      if (unsubPrefs) {
        unsubPrefs();
        unsubPrefs = null;
      }

      setUser(currentUser);
      setAuthReady(true);

      if (!currentUser) {
        profileReadyUidRef.current = null;
        hasWorkspacePrefsDocRef.current = false;
        migratedLocalUidRef.current = null;

        const localAccs = loadLocalJson<SocialAccount[]>(LOCAL_ACCOUNTS_KEY, []).filter(
          (a) => a.platform === 'shorts' || a.platform === 'tiktok'
        );
        const localClips = loadLocalJson<PublishedClipRecord[]>(LOCAL_CLIPS_KEY, []).filter(
          (c) => c.platform === 'shorts' || c.platform === 'tiktok'
        );
        const localPrefs = loadLocalJson<Partial<WorkspacePreferencesValues>>(
          LOCAL_PREFS_KEY,
          {}
        );

        setSocialAccounts(localAccs);
        setPublishedClips(localClips);
        setWorkspacePrefs({
          id: 'workspace',
          userId: 'local',
          ...DEFAULT_WORKSPACE_PREFS,
          ...localPrefs,
        });
        setWorkspacePrefsLoaded(true);
        setIsLoadingData(false);
        return;
      }

      setIsLoadingData(true);
      try {
        await ensureUserDocument(currentUser);
      } catch (err) {
        console.error('Failed to initialize user profile:', err);
      }

      const accountsPath = `users/${currentUser.uid}/socialAccounts`;
      const accountsQuery = query(
        collection(db, 'users', currentUser.uid, 'socialAccounts'),
        where('userId', '==', currentUser.uid)
      );
      unsubAccounts = onSnapshot(
        accountsQuery,
        (snapshot) => {
          const list: SocialAccount[] = snapshot.docs
            .map((d) => d.data() as SocialAccount)
            .filter((a) => a.platform === 'shorts' || a.platform === 'tiktok');
          list.sort((a, b) => timestampToMs(b.createdAt) - timestampToMs(a.createdAt));
          setSocialAccounts(list);
          setIsLoadingData(false);

          // Automatically merge any manually added local accounts & clips once upon Google sign-in
          if (migratedLocalUidRef.current !== currentUser.uid) {
            migratedLocalUidRef.current = currentUser.uid;
            const localAccounts = loadLocalJson<SocialAccount[]>(LOCAL_ACCOUNTS_KEY, []).filter(
              (a) => a.platform === 'shorts' || a.platform === 'tiktok'
            );
            const localClips = loadLocalJson<PublishedClipRecord[]>(LOCAL_CLIPS_KEY, []).filter(
              (c) => c.platform === 'shorts' || c.platform === 'tiktok'
            );

            if (localAccounts.length > 0 || localClips.length > 0) {
              const existingKeys = new Set(
                list.map((a) => `${a.platform}:${a.handle.toLowerCase()}`)
              );
              const existingAccountIds = new Set(list.map((a) => a.id));
              const platformsWithDefault = new Set(
                list.filter((a) => a.isDefault).map((a) => a.platform)
              );

              const batch = writeBatch(db);
              let writeCount = 0;

              localAccounts.forEach((acc) => {
                const key = `${acc.platform}:${acc.handle.toLowerCase()}`;
                if (existingKeys.has(key) || existingAccountIds.has(acc.id)) return;
                existingKeys.add(key);
                const parsed = parseSocialHandleAndUrl(acc.platform, acc.handle, acc.profileUrl);
                const shouldBeDefault =
                  acc.isDefault && !platformsWithDefault.has(acc.platform);
                if (shouldBeDefault) platformsWithDefault.add(acc.platform);
                const accId = sanitizeId(acc.id);
                batch.set(doc(db, 'users', currentUser.uid, 'socialAccounts', accId), {
                  id: accId,
                  userId: currentUser.uid,
                  platform: acc.platform,
                  handle: sanitizeText(parsed.handle, 100, '@creator'),
                  displayName: sanitizeText(acc.displayName, 120, parsed.displayName),
                  profileUrl: sanitizeHttpUrl(acc.profileUrl) || parsed.profileUrl,
                  avatarUrl: sanitizeHttpUrl(acc.avatarUrl),
                  connectionType: (acc.connectionType || 'linked') as AccountConnectionType,
                  isDefault: Boolean(shouldBeDefault),
                  followersCount: sanitizeInt(acc.followersCount),
                  postsCount: sanitizeInt(acc.postsCount, 10000000),
                  notes: sanitizeText(acc.notes, 300, ''),
                  lastSyncedAt: sanitizeText(acc.lastSyncedAt, 64, new Date().toISOString()),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                writeCount += 1;
              });

              localClips.slice(0, 100).forEach((rec) => {
                const recId = sanitizeId(rec.id);
                batch.set(doc(db, 'users', currentUser.uid, 'publishedClips', recId), {
                  id: recId,
                  userId: currentUser.uid,
                  accountId: sanitizeText(rec.accountId, 128, 'unassigned'),
                  accountHandle: sanitizeText(rec.accountHandle, 100, 'No account linked'),
                  platform: rec.platform,
                  clipId: sanitizeId(rec.clipId || 'clip'),
                  clipTitle: sanitizeText(rec.clipTitle, 200, 'Untitled Short'),
                  sourceVideoTitle: sanitizeText(rec.sourceVideoTitle, 200, ''),
                  filename: sanitizeText(rec.filename, 200, 'clip.mp4'),
                  captionCopy: sanitizeText(rec.captionCopy, 2000, ''),
                  status: (rec.status || 'exported') as ClipPublishStatus,
                  postUrl: sanitizeHttpUrl(rec.postUrl),
                  scheduledFor: sanitizeText(rec.scheduledFor, 64, ''),
                  views: sanitizeInt(rec.views),
                  likes: sanitizeInt(rec.likes),
                  comments: sanitizeInt(rec.comments),
                  shares: sanitizeInt(rec.shares),
                  durationSec: sanitizeInt(rec.durationSec, 600),
                  viralityScore: sanitizeInt(rec.viralityScore, 100),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                writeCount += 1;
              });

              if (writeCount > 0) {
                batch
                  .commit()
                  .then(() => {
                    saveLocalJson(LOCAL_ACCOUNTS_KEY, []);
                    saveLocalJson(LOCAL_CLIPS_KEY, []);
                  })
                  .catch((err) => {
                    console.warn('Could not sync local accounts to cloud yet:', err);
                  });
              } else {
                saveLocalJson(LOCAL_ACCOUNTS_KEY, []);
                saveLocalJson(LOCAL_CLIPS_KEY, []);
              }
            }
          }
        },
        (error) => {
          setIsLoadingData(false);
          handleFirestoreError(error, OperationType.LIST, accountsPath);
        }
      );

      const clipsPath = `users/${currentUser.uid}/publishedClips`;
      const clipsQuery = query(
        collection(db, 'users', currentUser.uid, 'publishedClips'),
        where('userId', '==', currentUser.uid)
      );
      unsubClips = onSnapshot(
        clipsQuery,
        (snapshot) => {
          const list: PublishedClipRecord[] = snapshot.docs
            .map((d) => d.data() as PublishedClipRecord)
            .filter((rec) => rec.platform === 'shorts' || rec.platform === 'tiktok');
          list.sort((a, b) => timestampToMs(b.createdAt) - timestampToMs(a.createdAt));
          setPublishedClips(list);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, clipsPath);
        }
      );

      const prefsPath = `users/${currentUser.uid}/preferences`;
      const prefsQuery = query(
        collection(db, 'users', currentUser.uid, 'preferences'),
        where('userId', '==', currentUser.uid)
      );
      unsubPrefs = onSnapshot(
        prefsQuery,
        (snapshot) => {
          const docSnap =
            snapshot.docs.find((d) => d.id === 'workspace') || snapshot.docs[0];
          if (docSnap) {
            hasWorkspacePrefsDocRef.current = true;
            const raw = docSnap.data() as Partial<WorkspacePreferences>;
            setWorkspacePrefs({
              id: docSnap.id,
              userId: currentUser.uid,
              autoApplyAccounts:
                typeof raw.autoApplyAccounts === 'boolean'
                  ? raw.autoApplyAccounts
                  : DEFAULT_WORKSPACE_PREFS.autoApplyAccounts,
              autoApplyAiFraming:
                typeof raw.autoApplyAiFraming === 'boolean'
                  ? raw.autoApplyAiFraming
                  : DEFAULT_WORKSPACE_PREFS.autoApplyAiFraming,
              autoApplyStyleAcrossClips:
                typeof raw.autoApplyStyleAcrossClips === 'boolean'
                  ? raw.autoApplyStyleAcrossClips
                  : DEFAULT_WORKSPACE_PREFS.autoApplyStyleAcrossClips,
              autoSyncStatsOnOpen:
                typeof raw.autoSyncStatsOnOpen === 'boolean'
                  ? raw.autoSyncStatsOnOpen
                  : DEFAULT_WORKSPACE_PREFS.autoSyncStatsOnOpen,
              captionPreset: (raw.captionPreset ||
                DEFAULT_WORKSPACE_PREFS.captionPreset) as CaptionPreset,
              captionColor:
                typeof raw.captionColor === 'string' && raw.captionColor
                  ? raw.captionColor
                  : DEFAULT_WORKSPACE_PREFS.captionColor,
              captionHighlightStyle: (raw.captionHighlightStyle ||
                DEFAULT_WORKSPACE_PREFS.captionHighlightStyle) as CaptionHighlightStyle,
              videoFilter: (raw.videoFilter ||
                DEFAULT_WORKSPACE_PREFS.videoFilter) as VideoFilterPreset,
              createdAt: raw.createdAt,
              updatedAt: raw.updatedAt,
            });
          } else {
            hasWorkspacePrefsDocRef.current = false;
            setWorkspacePrefs({
              id: 'workspace',
              userId: currentUser.uid,
              ...DEFAULT_WORKSPACE_PREFS,
            });
          }
          setWorkspacePrefsLoaded(true);
        },
        (error) => {
          setWorkspacePrefsLoaded(true);
          handleFirestoreError(error, OperationType.LIST, prefsPath);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubAccounts) unsubAccounts();
      if (unsubClips) unsubClips();
      if (unsubPrefs) unsubPrefs();
    };
  }, [ensureUserDocument]);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err: any) {
      const msg = err?.message || 'Sign-in failed. Please allow popups and try again.';
      setAuthError(msg);
      return null;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const getDefaultAccountForPlatform = useCallback(
    (platform: SocialPlatform): SocialAccount | undefined => {
      const matching = socialAccounts.filter((a) => a.platform === platform);
      return matching.find((a) => a.isDefault) || matching[0];
    },
    [socialAccounts]
  );

  const addSocialAccount = useCallback(
    async (input: AddSocialAccountInput): Promise<SocialAccount> => {
      const currentUser = auth.currentUser;
      const id = sanitizeId(
        `acc_${input.platform}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      );
      const currentAccounts = socialAccountsRef.current;
      const existingOnPlatform = currentAccounts.filter((a) => a.platform === input.platform);
      const shouldBeDefault = input.isDefault ?? existingOnPlatform.length === 0;

      const parsed = parseSocialHandleAndUrl(
        input.platform,
        input.handle,
        input.profileUrl
      );

      const basePayload = {
        id,
        userId: currentUser?.uid || 'local',
        platform: input.platform,
        handle: sanitizeText(parsed.handle, 100, '@creator'),
        displayName: sanitizeText(
          input.displayName,
          120,
          parsed.displayName || parsed.bareHandle || 'Creator Account'
        ),
        profileUrl: sanitizeHttpUrl(input.profileUrl) || parsed.profileUrl,
        avatarUrl: sanitizeHttpUrl(input.avatarUrl),
        connectionType: (input.connectionType || 'linked') as AccountConnectionType,
        isDefault: Boolean(shouldBeDefault),
        followersCount: sanitizeInt(input.followersCount),
        postsCount: sanitizeInt(input.postsCount, 10000000),
        notes: sanitizeText(input.notes, 300, ''),
        lastSyncedAt: sanitizeText(input.lastSyncedAt, 64, new Date().toISOString()),
      };

      // Local Workspace Fallback (instant, zero login required)
      if (!currentUser) {
        const nowIso = new Date().toISOString();
        const localRecord: SocialAccount = {
          ...basePayload,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        const nextAccounts = [
          localRecord,
          ...currentAccounts.map((acc) =>
            shouldBeDefault && acc.platform === input.platform
              ? { ...acc, isDefault: false, updatedAt: nowIso }
              : acc
          ),
        ];
        socialAccountsRef.current = nextAccounts;
        setSocialAccounts(nextAccounts);
        saveLocalJson(LOCAL_ACCOUNTS_KEY, nextAccounts);

        if (shouldBeDefault && workspacePrefsRef.current.autoApplyAccounts) {
          const nextClips = publishedClipsRef.current.map((clip) =>
            clip.platform === input.platform &&
            (!clip.accountId || clip.accountId === 'unassigned')
              ? {
                  ...clip,
                  accountId: id,
                  accountHandle: localRecord.handle,
                  updatedAt: nowIso,
                }
              : clip
          );
          publishedClipsRef.current = nextClips;
          setPublishedClips(nextClips);
          saveLocalJson(LOCAL_CLIPS_KEY, nextClips);
        }

        return localRecord;
      }

      if (profileReadyUidRef.current !== currentUser.uid) {
        await ensureUserDocument(currentUser);
      }

      const payload = {
        ...basePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docPath = `users/${currentUser.uid}/socialAccounts/${id}`;
      try {
        const batch = writeBatch(db);
        if (shouldBeDefault) {
          existingOnPlatform
            .filter((a) => a.isDefault)
            .forEach((other) => {
              batch.update(doc(db, 'users', currentUser.uid, 'socialAccounts', other.id), {
                isDefault: false,
                updatedAt: serverTimestamp(),
              });
            });

          if (workspacePrefsRef.current.autoApplyAccounts) {
            publishedClipsRef.current
              .filter(
                (clip) =>
                  clip.platform === input.platform &&
                  (!clip.accountId || clip.accountId === 'unassigned')
              )
              .slice(0, 400)
              .forEach((clip) => {
                batch.update(doc(db, 'users', currentUser.uid, 'publishedClips', clip.id), {
                  accountId: id,
                  accountHandle: payload.handle,
                  updatedAt: serverTimestamp(),
                });
              });
          }
        }
        batch.set(doc(db, 'users', currentUser.uid, 'socialAccounts', id), payload);
        await batch.commit();
        return payload as SocialAccount;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    },
    [ensureUserDocument]
  );

  const updateSocialAccount = useCallback(
    async (
      accountId: string,
      patch: Partial<Omit<AddSocialAccountInput, 'platform' | 'isDefault'>>
    ) => {
      const currentUser = auth.currentUser;
      const safeId = sanitizeId(accountId);
      const existingAcc = socialAccountsRef.current.find((a) => a.id === safeId);
      const platform: SocialPlatform = existingAcc?.platform || 'shorts';

      const cleanPatch: Record<string, any> = {};
      if (patch.handle !== undefined) {
        const parsed = parseSocialHandleAndUrl(platform, patch.handle, patch.profileUrl);
        cleanPatch.handle = sanitizeText(parsed.handle, 100, '@creator');
        if (patch.profileUrl === undefined && !existingAcc?.profileUrl) {
          cleanPatch.profileUrl = parsed.profileUrl;
        }
      }
      if (patch.displayName !== undefined) {
        cleanPatch.displayName = sanitizeText(patch.displayName, 120, 'Creator Account');
      }
      if (patch.profileUrl !== undefined) {
        cleanPatch.profileUrl = sanitizeHttpUrl(patch.profileUrl);
      }
      if (patch.avatarUrl !== undefined) {
        cleanPatch.avatarUrl = sanitizeHttpUrl(patch.avatarUrl);
      }
      if (patch.connectionType !== undefined) {
        cleanPatch.connectionType = patch.connectionType;
      }
      if (patch.followersCount !== undefined) {
        cleanPatch.followersCount = sanitizeInt(patch.followersCount);
      }
      if (patch.postsCount !== undefined) {
        cleanPatch.postsCount = sanitizeInt(patch.postsCount, 10000000);
      }
      if (patch.notes !== undefined) {
        cleanPatch.notes = sanitizeText(patch.notes, 300, '');
      }
      if (patch.lastSyncedAt !== undefined) {
        cleanPatch.lastSyncedAt = sanitizeText(patch.lastSyncedAt, 64, new Date().toISOString());
      }

      if (!currentUser) {
        const nowIso = new Date().toISOString();
        const nextAccounts = socialAccountsRef.current.map((acc) =>
          acc.id === safeId ? { ...acc, ...cleanPatch, updatedAt: nowIso } : acc
        );
        socialAccountsRef.current = nextAccounts;
        setSocialAccounts(nextAccounts);
        saveLocalJson(LOCAL_ACCOUNTS_KEY, nextAccounts);
        return;
      }

      const docPath = `users/${currentUser.uid}/socialAccounts/${safeId}`;
      try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'socialAccounts', safeId), {
          ...cleanPatch,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      }
    },
    []
  );

  const setDefaultSocialAccount = useCallback(
    async (accountId: string, platform: SocialPlatform) => {
      const currentUser = auth.currentUser;
      const safeId = sanitizeId(accountId);
      const targetAcc = socialAccountsRef.current.find((a) => a.id === safeId);

      if (!currentUser) {
        const nowIso = new Date().toISOString();
        const nextAccounts = socialAccountsRef.current.map((acc) =>
          acc.platform === platform
            ? { ...acc, isDefault: acc.id === safeId, updatedAt: nowIso }
            : acc
        );
        socialAccountsRef.current = nextAccounts;
        setSocialAccounts(nextAccounts);
        saveLocalJson(LOCAL_ACCOUNTS_KEY, nextAccounts);

        if (targetAcc && workspacePrefsRef.current.autoApplyAccounts) {
          const nextClips = publishedClipsRef.current.map((clip) =>
            clip.platform === platform && (!clip.accountId || clip.accountId === 'unassigned')
              ? {
                  ...clip,
                  accountId: targetAcc.id,
                  accountHandle: targetAcc.handle,
                  updatedAt: nowIso,
                }
              : clip
          );
          publishedClipsRef.current = nextClips;
          setPublishedClips(nextClips);
          saveLocalJson(LOCAL_CLIPS_KEY, nextClips);
        }
        return;
      }

      const docPath = `users/${currentUser.uid}/socialAccounts/${safeId}`;
      try {
        const batch = writeBatch(db);
        socialAccountsRef.current
          .filter((a) => a.platform === platform)
          .forEach((acc) => {
            const nextDefault = acc.id === safeId;
            if (acc.isDefault !== nextDefault) {
              batch.update(doc(db, 'users', currentUser.uid, 'socialAccounts', acc.id), {
                isDefault: nextDefault,
                updatedAt: serverTimestamp(),
              });
            }
          });

        if (targetAcc && workspacePrefsRef.current.autoApplyAccounts) {
          publishedClipsRef.current
            .filter(
              (clip) =>
                clip.platform === platform && (!clip.accountId || clip.accountId === 'unassigned')
            )
            .slice(0, 400)
            .forEach((clip) => {
              batch.update(doc(db, 'users', currentUser.uid, 'publishedClips', clip.id), {
                accountId: targetAcc.id,
                accountHandle: targetAcc.handle,
                updatedAt: serverTimestamp(),
              });
            });
        }

        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      }
    },
    []
  );

  const removeSocialAccount = useCallback(async (accountId: string) => {
    const currentUser = auth.currentUser;
    const safeId = sanitizeId(accountId);

    if (!currentUser) {
      const nextAccounts = socialAccountsRef.current.filter((a) => a.id !== safeId);
      socialAccountsRef.current = nextAccounts;
      setSocialAccounts(nextAccounts);
      saveLocalJson(LOCAL_ACCOUNTS_KEY, nextAccounts);
      return;
    }

    const docPath = `users/${currentUser.uid}/socialAccounts/${safeId}`;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'socialAccounts', safeId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  }, []);

  const logClipExport = useCallback(
    async (input: LogClipExportInput): Promise<PublishedClipRecord | null> => {
      const currentUser = auth.currentUser;
      const defaultAccount = workspacePrefsRef.current.autoApplyAccounts
        ? getDefaultAccountForPlatform(input.platform)
        : undefined;
      const id = sanitizeId(
        `cliprec_${input.platform}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      );

      const basePayload = {
        id,
        userId: currentUser?.uid || 'local',
        accountId: sanitizeText(input.accountId || defaultAccount?.id, 128, 'unassigned'),
        accountHandle: sanitizeText(
          input.accountHandle || defaultAccount?.handle,
          100,
          'No account linked'
        ),
        platform: input.platform,
        clipId: sanitizeId(input.clipId || 'clip'),
        clipTitle: sanitizeText(input.clipTitle, 200, 'Untitled Short'),
        sourceVideoTitle: sanitizeText(input.sourceVideoTitle, 200, ''),
        filename: sanitizeText(input.filename, 200, 'clip.mp4'),
        captionCopy: sanitizeText(input.captionCopy, 2000, ''),
        status: (input.status || 'exported') as ClipPublishStatus,
        postUrl: sanitizeHttpUrl(input.postUrl),
        scheduledFor: sanitizeText(input.scheduledFor, 64, ''),
        views: sanitizeInt(input.views),
        likes: sanitizeInt(input.likes),
        comments: sanitizeInt(input.comments),
        shares: sanitizeInt(input.shares),
        durationSec: sanitizeInt(input.durationSec, 600),
        viralityScore: sanitizeInt(input.viralityScore, 100),
      };

      if (!currentUser) {
        const nowIso = new Date().toISOString();
        const localRec: PublishedClipRecord = {
          ...basePayload,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        const nextClips = [localRec, ...publishedClipsRef.current];
        publishedClipsRef.current = nextClips;
        setPublishedClips(nextClips);
        saveLocalJson(LOCAL_CLIPS_KEY, nextClips);
        return localRec;
      }

      if (profileReadyUidRef.current !== currentUser.uid) {
        await ensureUserDocument(currentUser);
      }

      const docPath = `users/${currentUser.uid}/publishedClips/${id}`;
      const payload = {
        ...basePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'publishedClips', id), payload);
        return payload as PublishedClipRecord;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    },
    [ensureUserDocument, getDefaultAccountForPlatform]
  );

  const updatePublishedClip = useCallback(
    async (recordId: string, patch: UpdatePublishedClipPatch) => {
      const currentUser = auth.currentUser;
      const safeId = sanitizeId(recordId);

      const statusOrMetaKeys: Record<string, any> = {};
      if (patch.status !== undefined) statusOrMetaKeys.status = patch.status;
      if (patch.scheduledFor !== undefined) {
        statusOrMetaKeys.scheduledFor = sanitizeText(patch.scheduledFor, 64, '');
      }
      if (patch.accountId !== undefined) {
        statusOrMetaKeys.accountId = sanitizeText(patch.accountId, 128, 'unassigned');
      }
      if (patch.accountHandle !== undefined) {
        statusOrMetaKeys.accountHandle = sanitizeText(patch.accountHandle, 100, '');
      }

      const metricKeys: Record<string, any> = {};
      if (patch.views !== undefined) metricKeys.views = sanitizeInt(patch.views);
      if (patch.likes !== undefined) metricKeys.likes = sanitizeInt(patch.likes);
      if (patch.comments !== undefined) metricKeys.comments = sanitizeInt(patch.comments);
      if (patch.shares !== undefined) metricKeys.shares = sanitizeInt(patch.shares);

      const sharedUrl = patch.postUrl !== undefined ? sanitizeHttpUrl(patch.postUrl) : undefined;
      const sharedCaption =
        patch.captionCopy !== undefined ? sanitizeText(patch.captionCopy, 2000, '') : undefined;

      if (!currentUser) {
        const nowIso = new Date().toISOString();
        const nextClips = publishedClipsRef.current.map((rec) => {
          if (rec.id !== safeId) return rec;
          const nextStatus =
            rec.status === 'published'
              ? 'published'
              : (statusOrMetaKeys.status ?? rec.status);
          return {
            ...rec,
            ...statusOrMetaKeys,
            ...metricKeys,
            status: nextStatus,
            ...(sharedUrl !== undefined ? { postUrl: sharedUrl } : {}),
            ...(sharedCaption !== undefined ? { captionCopy: sharedCaption } : {}),
            updatedAt: nowIso,
          };
        });
        publishedClipsRef.current = nextClips;
        setPublishedClips(nextClips);
        saveLocalJson(LOCAL_CLIPS_KEY, nextClips);
        return;
      }

      const docPath = `users/${currentUser.uid}/publishedClips/${safeId}`;
      const ref = doc(db, 'users', currentUser.uid, 'publishedClips', safeId);

      try {
        const hasStatusChanges = Object.keys(statusOrMetaKeys).length > 0;
        const hasMetricChanges = Object.keys(metricKeys).length > 0;

        if (hasStatusChanges) {
          await updateDoc(ref, {
            ...statusOrMetaKeys,
            ...(sharedUrl !== undefined ? { postUrl: sharedUrl } : {}),
            ...(sharedCaption !== undefined ? { captionCopy: sharedCaption } : {}),
            updatedAt: serverTimestamp(),
          });
        }

        if (
          hasMetricChanges ||
          (!hasStatusChanges && (sharedUrl !== undefined || sharedCaption !== undefined))
        ) {
          await updateDoc(ref, {
            ...metricKeys,
            ...(sharedUrl !== undefined ? { postUrl: sharedUrl } : {}),
            ...(sharedCaption !== undefined ? { captionCopy: sharedCaption } : {}),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      }
    },
    []
  );

  const deletePublishedClip = useCallback(async (recordId: string) => {
    const currentUser = auth.currentUser;
    const safeId = sanitizeId(recordId);

    if (!currentUser) {
      const nextClips = publishedClipsRef.current.filter((r) => r.id !== safeId);
      publishedClipsRef.current = nextClips;
      setPublishedClips(nextClips);
      saveLocalJson(LOCAL_CLIPS_KEY, nextClips);
      return;
    }

    const docPath = `users/${currentUser.uid}/publishedClips/${safeId}`;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'publishedClips', safeId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  }, []);

  const updateWorkspacePrefs = useCallback(
    async (patch: Partial<WorkspacePreferencesValues>) => {
      const currentUser = auth.currentUser;
      const sanitizedPatch: Record<string, any> = {};
      if (patch.autoApplyAccounts !== undefined) {
        sanitizedPatch.autoApplyAccounts = Boolean(patch.autoApplyAccounts);
      }
      if (patch.autoApplyAiFraming !== undefined) {
        sanitizedPatch.autoApplyAiFraming = Boolean(patch.autoApplyAiFraming);
      }
      if (patch.autoApplyStyleAcrossClips !== undefined) {
        sanitizedPatch.autoApplyStyleAcrossClips = Boolean(patch.autoApplyStyleAcrossClips);
      }
      if (patch.autoSyncStatsOnOpen !== undefined) {
        sanitizedPatch.autoSyncStatsOnOpen = Boolean(patch.autoSyncStatsOnOpen);
      }
      if (patch.captionPreset !== undefined) {
        sanitizedPatch.captionPreset = sanitizeText(
          patch.captionPreset,
          64,
          DEFAULT_WORKSPACE_PREFS.captionPreset
        );
      }
      if (patch.captionColor !== undefined) {
        sanitizedPatch.captionColor = sanitizeText(
          patch.captionColor,
          32,
          DEFAULT_WORKSPACE_PREFS.captionColor
        );
      }
      if (patch.captionHighlightStyle !== undefined) {
        sanitizedPatch.captionHighlightStyle = sanitizeText(
          patch.captionHighlightStyle,
          32,
          DEFAULT_WORKSPACE_PREFS.captionHighlightStyle
        );
      }
      if (patch.videoFilter !== undefined) {
        sanitizedPatch.videoFilter = sanitizeText(
          patch.videoFilter,
          32,
          DEFAULT_WORKSPACE_PREFS.videoFilter
        );
      }

      if (Object.keys(sanitizedPatch).length === 0) return;

      // Optimistically reflect locally immediately
      const nextPrefsObj = { ...workspacePrefsRef.current, ...sanitizedPatch };
      workspacePrefsRef.current = nextPrefsObj;
      setWorkspacePrefs(nextPrefsObj);

      if (!currentUser) {
        const { id: _id, userId: _uid, createdAt: _c, updatedAt: _u, ...valuesOnly } = nextPrefsObj;
        saveLocalJson(LOCAL_PREFS_KEY, valuesOnly);
        return;
      }

      if (profileReadyUidRef.current !== currentUser.uid) {
        await ensureUserDocument(currentUser);
      }

      const prefId = workspacePrefsRef.current.id || 'workspace';
      const docPath = `users/${currentUser.uid}/preferences/${prefId}`;
      const prefRef = doc(db, 'users', currentUser.uid, 'preferences', prefId);

      try {
        if (!hasWorkspacePrefsDocRef.current) {
          const cur = workspacePrefsRef.current;
          const fullPayload = {
            id: prefId,
            userId: currentUser.uid,
            autoApplyAccounts:
              sanitizedPatch.autoApplyAccounts ??
              cur.autoApplyAccounts ??
              DEFAULT_WORKSPACE_PREFS.autoApplyAccounts,
            autoApplyAiFraming:
              sanitizedPatch.autoApplyAiFraming ??
              cur.autoApplyAiFraming ??
              DEFAULT_WORKSPACE_PREFS.autoApplyAiFraming,
            autoApplyStyleAcrossClips:
              sanitizedPatch.autoApplyStyleAcrossClips ??
              cur.autoApplyStyleAcrossClips ??
              DEFAULT_WORKSPACE_PREFS.autoApplyStyleAcrossClips,
            autoSyncStatsOnOpen:
              sanitizedPatch.autoSyncStatsOnOpen ??
              cur.autoSyncStatsOnOpen ??
              DEFAULT_WORKSPACE_PREFS.autoSyncStatsOnOpen,
            captionPreset:
              sanitizedPatch.captionPreset ??
              cur.captionPreset ??
              DEFAULT_WORKSPACE_PREFS.captionPreset,
            captionColor:
              sanitizedPatch.captionColor ??
              cur.captionColor ??
              DEFAULT_WORKSPACE_PREFS.captionColor,
            captionHighlightStyle:
              sanitizedPatch.captionHighlightStyle ??
              cur.captionHighlightStyle ??
              DEFAULT_WORKSPACE_PREFS.captionHighlightStyle,
            videoFilter:
              sanitizedPatch.videoFilter ?? cur.videoFilter ?? DEFAULT_WORKSPACE_PREFS.videoFilter,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(prefRef, fullPayload);
          hasWorkspacePrefsDocRef.current = true;
        } else {
          await updateDoc(prefRef, {
            ...sanitizedPatch,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, docPath);
      }
    },
    [ensureUserDocument]
  );

  const autoApplyPrimaryAccountsToClips = useCallback(async (): Promise<number> => {
    const currentUser = auth.currentUser;
    const candidates = publishedClipsRef.current.filter((rec) => {
      if (rec.accountId && rec.accountId !== 'unassigned') return false;
      return Boolean(getDefaultAccountForPlatform(rec.platform));
    });

    if (candidates.length === 0) return 0;

    if (!currentUser) {
      const nowIso = new Date().toISOString();
      let updatedCount = 0;
      const nextClips = publishedClipsRef.current.map((rec) => {
        if (rec.accountId && rec.accountId !== 'unassigned') return rec;
        const defAcc = getDefaultAccountForPlatform(rec.platform);
        if (!defAcc) return rec;
        updatedCount += 1;
        return {
          ...rec,
          accountId: defAcc.id,
          accountHandle: defAcc.handle,
          updatedAt: nowIso,
        };
      });
      publishedClipsRef.current = nextClips;
      setPublishedClips(nextClips);
      saveLocalJson(LOCAL_CLIPS_KEY, nextClips);
      return updatedCount;
    }

    try {
      let updatedCount = 0;
      for (let i = 0; i < candidates.length; i += 400) {
        const chunk = candidates.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((rec) => {
          const defAcc = getDefaultAccountForPlatform(rec.platform);
          if (!defAcc) return;
          batch.update(doc(db, 'users', currentUser.uid, 'publishedClips', rec.id), {
            accountId: defAcc.id,
            accountHandle: defAcc.handle,
            updatedAt: serverTimestamp(),
          });
          updatedCount += 1;
        });
        await batch.commit();
      }
      return updatedCount;
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `users/${currentUser.uid}/publishedClips`
      );
    }
  }, [getDefaultAccountForPlatform]);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        isSigningIn,
        authError,
        isLoadingData,
        isLocalWorkspace: !user,
        socialAccounts,
        publishedClips,
        workspacePrefs,
        workspacePrefsLoaded,
        signInWithGoogle,
        signOutUser,
        getDefaultAccountForPlatform,
        addSocialAccount,
        updateSocialAccount,
        setDefaultSocialAccount,
        removeSocialAccount,
        logClipExport,
        updatePublishedClip,
        deletePublishedClip,
        updateWorkspacePrefs,
        autoApplyPrimaryAccountsToClips,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
