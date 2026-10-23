// Account deletion (App Store 5.1.1(v) + GDPR style erasure). Server-side, Firebase Admin SDK.
// Pure plan + executor so the logic is unit-testable with fakes (scripts/test-delete-account-fn.js). No secrets are read here
// except the optional Apple Sign-in key used for token revocation (APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_CLIENT_ID).
const crypto = require('crypto');

const UID_RE = /^[A-Za-z0-9]{6,128}$/;
// Doc-id ownership model of the app (see firestore.rules):
const DOC_COLLECTIONS = ['publicProfiles', 'streaks', 'userSettings', 'userRanks', 'badges', 'discipline']; // id === uid
const PREFIX_COLLECTIONS = ['weeklyRoutines', 'wontDoTasks', 'dailyReports'];                               // id === `${uid}_...`
const FIELD_COLLECTIONS = [['posts', 'userId'], ['rooms', 'user_id'], ['meals', 'userId'], ['icsTokens', 'uid']];
const STORAGE_PREFIXES = (uid) => [`avatars/${uid}`, `task_images/${uid}_`, `task_files/${uid}_`];

const monthKeys = (now = new Date(), from = '2024-01') => {
  const out = []; let [y, m] = from.split('-').map(Number);
  const end = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1; // include next month for tz slack
  while (y * 12 + (m - 1) <= end) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
};

// Pure: everything we erase for a uid, as declarative steps.
const buildDeletionPlan = (uid, now = new Date()) => {
  if (!UID_RE.test(String(uid || ''))) throw Object.assign(new Error('Bad uid'), { status: 400 });
  const steps = [{ kind: 'recursive', path: `users/${uid}` }]; // users/{uid} + subcollections (nofap/...)
  DOC_COLLECTIONS.forEach((c) => steps.push({ kind: 'doc', path: `${c}/${uid}` }));
  monthKeys(now).forEach((mk) => { steps.push({ kind: 'doc', path: `monthlyStats/${mk}/users/${uid}` }); steps.push({ kind: 'doc', path: `monthlyStats/${mk}/private/${uid}` }); });
  PREFIX_COLLECTIONS.forEach((c) => steps.push({ kind: 'idPrefix', collection: c, prefix: `${uid}_` }));
  FIELD_COLLECTIONS.forEach(([c, f]) => steps.push({ kind: 'where', collection: c, field: f, value: uid }));
  STORAGE_PREFIXES(uid).forEach((p) => steps.push({ kind: 'storagePrefix', prefix: p }));
  return steps;
};

// Real executor on top of firebase-admin. Each step is independent; failures are collected, never swallowed silently.
const makeAdminIo = (admin, bucketName) => {
  const db = admin.firestore();
  const FieldPath = admin.firestore.FieldPath;
  const deleteQuery = async (q) => { for (;;) { const s = await q.limit(400).get(); if (s.empty) return; const b = db.batch(); s.docs.forEach((d) => b.delete(d.ref)); await b.commit(); if (s.size < 400) return; } };
  return {
    recursive: (path) => db.recursiveDelete(db.doc(path)),
    doc: (path) => db.doc(path).delete(),
    idPrefix: (collection, prefix) => deleteQuery(db.collection(collection).where(FieldPath.documentId(), '>=', prefix).where(FieldPath.documentId(), '<', prefix + '\uf8ff')),
    where: (collection, field, value) => deleteQuery(db.collection(collection).where(field, '==', value)),
    storagePrefix: (prefix) => admin.storage().bucket(bucketName).deleteFiles({ prefix, force: true }),
    readUser: async (uid) => { const s = await db.doc(`users/${uid}`).get(); return s.exists ? s.data() : null; },
  };
};

const runPlan = async (steps, io) => {
  const failed = [];
  for (const s of steps) {
    try {
      if (s.kind === 'recursive') await io.recursive(s.path);
      else if (s.kind === 'doc') await io.doc(s.path);
      else if (s.kind === 'idPrefix') await io.idPrefix(s.collection, s.prefix);
      else if (s.kind === 'where') await io.where(s.collection, s.field, s.value);
      else if (s.kind === 'storagePrefix') await io.storagePrefix(s.prefix);
    } catch (e) {
      // a missing storage object / empty prefix is not a failure
      if (s.kind === 'storagePrefix' && (e.code === 404 || /not found/i.test(e.message || ''))) continue;
      failed.push({ step: s.kind + ':' + (s.path || s.collection || s.prefix), error: String(e.message || e).slice(0, 120) });
    }
  }
  return failed;
};

// ---- Apple "Sign in with Apple" token revocation (needs a server-side Apple key; skipped when not configured) ----
const b64u = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const appleConfig = (env = process.env) => {
  const { APPLE_TEAM_ID: teamId, APPLE_KEY_ID: keyId, APPLE_PRIVATE_KEY: key, APPLE_CLIENT_ID: clientId } = env;
  if (!teamId || !keyId || !key || !clientId) return null;
  return { teamId, keyId, clientId, privateKey: key.includes('BEGIN') ? key : Buffer.from(key, 'base64').toString('utf8') };
};
const appleClientSecret = (cfg, nowSec = Math.floor(Date.now() / 1000)) => {
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: cfg.keyId, typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: cfg.teamId, iat: nowSec, exp: nowSec + 300, aud: 'https://appleid.apple.com', sub: cfg.clientId }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: cfg.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64u(sig)}`;
};
// Returns 'revoked' | 'skipped-not-configured' | 'skipped-no-code' | 'failed'
const revokeAppleToken = async (authorizationCode, { env = process.env, fetchImpl = fetch } = {}) => {
  const cfg = appleConfig(env);
  if (!cfg) return 'skipped-not-configured';
  if (!authorizationCode) return 'skipped-no-code';
  try {
    const secret = appleClientSecret(cfg);
    const form = (o) => new URLSearchParams(o).toString();
    const hdr = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const t = await fetchImpl('https://appleid.apple.com/auth/token', { method: 'POST', headers: hdr, body: form({ client_id: cfg.clientId, client_secret: secret, code: authorizationCode, grant_type: 'authorization_code' }) });
    const tok = await t.json().catch(() => ({}));
    if (!t.ok || !(tok.refresh_token || tok.access_token)) return 'failed';
    const useRefresh = !!tok.refresh_token;
    const r = await fetchImpl('https://appleid.apple.com/auth/revoke', { method: 'POST', headers: hdr, body: form({ client_id: cfg.clientId, client_secret: secret, token: useRefresh ? tok.refresh_token : tok.access_token, token_type_hint: useRefresh ? 'refresh_token' : 'access_token' }) });
    return r.ok ? 'revoked' : 'failed';
  } catch (e) { return 'failed'; }
};

module.exports = { UID_RE, buildDeletionPlan, makeAdminIo, runPlan, revokeAppleToken, appleConfig, appleClientSecret, monthKeys, STORAGE_PREFIXES };
