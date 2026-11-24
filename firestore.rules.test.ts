/**
 * Firestore Security Rules Adversarial Payload Specification ("Dirty Dozen")
 * Mirrors security_spec.md invariants verified against firestore.rules.
 */

export const DIRTY_DOZEN_PAYLOADS = [
  {
    name: 'cross_user_read_social_account',
    path: '/users/victim_uid/socialAccounts/acc_1',
    operation: 'get',
    auth: { uid: 'attacker_uid', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'cross_user_list_published_clips',
    path: '/users/victim_uid/publishedClips',
    operation: 'list',
    auth: { uid: 'attacker_uid', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'unverified_email_create_account',
    path: '/users/user_1/socialAccounts/acc_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'shadow_field_injection_create',
    path: '/users/user_1/socialAccounts/acc_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { id: 'acc_1', userId: 'user_1', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'shadow_field_injection_update',
    path: '/users/user_1/publishedClips/rec_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { views: 100, extraKey: 'x' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'forged_user_id_in_payload',
    path: '/users/attacker_uid/socialAccounts/acc_1',
    operation: 'create',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: { id: 'acc_1', userId: 'victim_uid' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'invalid_document_id_pattern',
    path: '/users/user_1/socialAccounts/bad$id',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'spoofed_client_timestamp',
    path: '/users/user_1/socialAccounts/acc_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'immutable_owner_mutation_on_update',
    path: '/users/user_1/publishedClips/rec_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { userId: 'other_user' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'terminal_status_regression_from_published',
    path: '/users/user_1/publishedClips/rec_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { status: 'exported' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'xss_javascript_url_in_post_url',
    path: '/users/user_1/publishedClips/rec_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { postUrl: 'javascript:alert(1)' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'negative_metrics_poisoning',
    path: '/users/user_1/publishedClips/rec_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { views: -50 },
    expected: 'PERMISSION_DENIED',
  },
];
