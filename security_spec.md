# Firestore Security Specification

## Data Invariants
1. Every document under `/users/{userId}` and its subcollections (`socialAccounts`, `publishedClips`) is strictly scoped to the verified owner (`request.auth.uid == userId` and `request.auth.token.email_verified == true`).
2. Users cannot list `/users` or read any other user's profile, connected social accounts, or publishing records.
3. Subcollection writes require the parent `/users/{userId}` document to exist (or be created atomically in the same batch) and forbid modifying immutable ownership or timestamp fields (`id`, `userId`, `uid`, `clipId`, `createdAt`).
4. All `createdAt` and `updatedAt` timestamps must match `request.time` (server timestamp).
5. All URL fields (`profileUrl`, `avatarUrl`, `photoUrl`, `postUrl`) only allow empty strings or `http://` / `https://` URLs within strict length limits.
6. Once a `publishedClips` record reaches `status == 'published'`, it cannot regress to `'exported'` or `'scheduled'`.

## Adversarial Test Cases ("Dirty Dozen")
1. Cross-user `get` on `/users/other_uid/socialAccounts/acc_1` -> `PERMISSION_DENIED`
2. Cross-user `list` on `/users/other_uid/publishedClips` -> `PERMISSION_DENIED`
3. Unverified email (`email_verified: false`) writing to `/users/uid/socialAccounts/acc_1` -> `PERMISSION_DENIED`
4. Shadow field injection (`isAdmin: true`) on `socialAccounts` create -> `PERMISSION_DENIED`
5. Shadow field injection (`extraKey: 'x'`) on `publishedClips` update -> `PERMISSION_DENIED`
6. Forged `userId` (`userId: 'victim_uid'`) under `/users/attacker_uid/socialAccounts/acc_1` -> `PERMISSION_DENIED`
7. Malicious document ID exceeding 128 chars or containing invalid symbols (`../bad`) -> `PERMISSION_DENIED`
8. Spoofed client timestamp (`createdAt` != `request.time`) -> `PERMISSION_DENIED`
9. Mutating immutable `createdAt` or `userId` on update -> `PERMISSION_DENIED`
10. Regressing terminal `status: 'published'` back to `'exported'` -> `PERMISSION_DENIED`
11. XSS URI injection (`javascript:alert(1)`) in `postUrl` or `profileUrl` -> `PERMISSION_DENIED`
12. Negative view/follower counter (`views: -5` or `followersCount: -1`) -> `PERMISSION_DENIED`
