// Run: node scripts/test-friend-unlock-fn.js — friend-approved early unlock function with an in-memory Firestore fake (ZZTEST data only, no network).
const assert = require('assert');
const F = require('../netlify/functions/lib/friendUnlock');
const { rawHandler, handler } = require('../netlify/functions/friend-unlock');
const fs = require('fs'); const path = require('path');
const makeDb = () => {
  const store = new Map();
  const snap = (p) => ({ exists: store.has(p), data: () => store.get(p) });
  const docRef = (p) => ({ path: p, get: async () => snap(p), set: async (v, o) => { store.set(p, o && o.merge ? { ...(store.get(p) || {}), ...v } : { ...v }); } });
  return { store, doc: docRef, runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o) }) };
};
let now = Date.UTC(2026, 9, 31, 14, 0);
const deps = (db) => ({ db, now: () => now, verify: async (tok) => { if (!tok.startsWith('idtok-')) throw new Error('bad'); return { uid: tok.slice(6) }; } });
const asUser = (db, uid, body) => rawHandler({ httpMethod: 'POST', headers: { authorization: `Bearer idtok-${uid}` }, body: JSON.stringify(body) }, {}, deps(db));
const pub = (db, body) => rawHandler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) }, {}, deps(db));
const view = (db, token) => rawHandler({ httpMethod: 'GET', headers: {}, queryStringParameters: { token } }, {}, deps(db));
const J = (r) => JSON.parse(r.body);
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
(async () => {
  await t('helpers: token shape, hash, minutes, expiry view', () => {
    const tok = F.newToken(); assert(F.validTokenShape(tok)); assert.strictEqual(F.hashToken(tok).length, 64); assert(!F.validTokenShape('../x'));
    assert.strictEqual(F.normMinutes(30), 30); assert.strictEqual(F.normMinutes(999), 20);
    assert.strictEqual(F.view({ status: 'pending', expiresAt: 5 }, 10).status, 'expired'); assert(!F.canDecide({ status: 'pending', expiresAt: 5 }, 10));
  });
  const db = makeDb(); db.store.set('publicProfiles/zztest-owner', { name: 'ZZTEST Owner' });
  let tok;
  await t('request is refused while the optional friend approval is off (default)', async () => {
    assert.strictEqual((await asUser(db, 'zztest-owner', { action: 'request', friendName: 'ZZTEST Sam', minutes: 10 })).statusCode, 403);
    assert(![...db.store.keys()].some((k) => k.startsWith('unlockRequests/')));
  });
  db.store.set('users/zztest-owner', { gamePlan: { friendUnlock: true } });
  await t('request needs sign-in and a friend; stores only the hash', async () => {
    assert.strictEqual((await pub(db, { action: 'request', friendName: 'Sam' })).statusCode, 401);
    assert.strictEqual((await asUser(db, 'zztest-owner', { action: 'request', friendName: '' })).statusCode, 400);
    const r = await asUser(db, 'zztest-owner', { action: 'request', friendName: 'ZZTEST Sam', minutes: 10, reason: 'call mom' }); assert.strictEqual(r.statusCode, 200);
    const j = J(r); tok = j.token; assert(/\/friend-unlock\.html\?t=/.test(j.url)); assert(j.url.endsWith(tok));
    const keys = [...db.store.keys()].filter((k) => k.startsWith('unlockRequests/')); assert.deepStrictEqual(keys, [`unlockRequests/${F.hashToken(tok)}`]);
    assert(!JSON.stringify(db.store.get(keys[0])).includes(tok), 'raw token never stored');
    const d = db.store.get(keys[0]); assert.strictEqual(d.uid, 'zztest-owner'); assert.strictEqual(d.status, 'pending'); assert.strictEqual(d.minutes, 10);
    assert.strictEqual(+d.expiresAt - now, 2 * 3600 * 1000);
  });
  await t('friend view (public GET) shows name/minutes/reason, no uid', async () => {
    const v = J(await view(db, tok)); assert.strictEqual(v.ownerName, 'ZZTEST Owner'); assert.strictEqual(v.minutes, 10); assert.strictEqual(v.status, 'pending'); assert.strictEqual(v.reason, 'call mom'); assert(!('uid' in v));
    assert.strictEqual((await view(db, 'A'.repeat(24))).statusCode, 404); assert.strictEqual((await view(db, '')).statusCode, 404);
  });
  await t('owner polls status; another user cannot', async () => {
    assert.strictEqual(J(await asUser(db, 'zztest-owner', { action: 'status', token: tok })).status, 'pending');
    assert.strictEqual((await asUser(db, 'zztest-other', { action: 'status', token: tok })).statusCode, 404);
  });
  await t('approve once; a later deny cannot flip it', async () => {
    assert.strictEqual(J(await pub(db, { token: tok, action: 'approve' })).status, 'approved');
    assert.strictEqual(J(await pub(db, { token: tok, action: 'deny' })).status, 'approved');
    assert.strictEqual(J(await asUser(db, 'zztest-owner', { action: 'status', token: tok })).status, 'approved');
  });
  await t('deny path, expiry, and a new request replaces the old one', async () => {
    const a = J(await asUser(db, 'zztest-owner', { action: 'request', friendName: 'ZZTEST Sam', minutes: 20 })).token;
    assert.strictEqual(J(await pub(db, { token: a, action: 'deny' })).status, 'denied');
    const b = J(await asUser(db, 'zztest-owner', { action: 'request', friendName: 'ZZTEST Sam', minutes: 30 })).token;
    const c = J(await asUser(db, 'zztest-owner', { action: 'request', friendName: 'ZZTEST Sam', minutes: 30 })).token;
    assert.strictEqual(J(await view(db, b)).status, 'replaced'); assert.strictEqual(J(await pub(db, { token: b, action: 'approve' })).status, 'replaced');
    now += 2 * 3600 * 1000 + 1; assert.strictEqual(J(await view(db, c)).status, 'expired'); assert.strictEqual(J(await pub(db, { token: c, action: 'approve' })).status, 'expired');
  });
  await t('bad input: unknown action, bad JSON, method', async () => {
    assert.strictEqual((await asUser(db, 'zztest-owner', { action: 'nope' })).statusCode, 400);
    assert.strictEqual((await rawHandler({ httpMethod: 'POST', headers: {}, body: '{' }, {}, deps(db))).statusCode, 400);
    assert.strictEqual((await rawHandler({ httpMethod: 'DELETE', headers: {} }, {}, deps(db))).statusCode, 405);
    assert.strictEqual(typeof handler, 'function');
  });
  await t('rules deny clients; static page posts approve/deny to the function', () => {
    const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8'); assert(/match \/unlockRequests\/\{hash\} \{ allow read, write: if false; \}/.test(rules));
    const page = fs.readFileSync(path.join(__dirname, '../public/friend-unlock.html'), 'utf8');
    assert(page.includes('/.netlify/functions/friend-unlock')); assert(page.includes("decide('approve')") && page.includes("decide('deny')")); assert(page.includes('no-referrer'));
  });
  console.log(`\n${n} friend-unlock fn tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
