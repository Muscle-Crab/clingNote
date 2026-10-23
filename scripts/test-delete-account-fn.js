// Run: node scripts/test-delete-account-fn.js  (account deletion function with fakes; no network, no secrets)
const path = require('path'); const assert = require('assert'); const crypto = require('crypto');
const fn = require(path.join(__dirname, '../netlify/functions/delete-account.js'));
const lib = require(path.join(__dirname, '../netlify/functions/lib/accountDeletion.js'));
(async () => {
  let n = 0; const t = async (name, f) => { await f(); n++; console.log('ok -', name); };
  const UID = 'abcDEF1234567890abcdEFGH1234'; const NOW = new Date('2026-11-01T12:00:00Z'); const nowSec = Math.floor(NOW.getTime() / 1000);
  const req = (auth = 'Bearer tok', body = {}, method = 'POST') => ({ httpMethod: method, headers: auth ? { authorization: auth } : {}, body: JSON.stringify(body) });
  const mk = (over = {}) => { const log = []; return { log, now: NOW,
    verify: async () => ({ uid: UID, auth_time: nowSec - 30 }),
    io: { recursive: async (p) => log.push('rec:' + p), doc: async (p) => log.push('doc:' + p), idPrefix: async (c, p) => log.push('pre:' + c + ':' + p), where: async (c, f, v) => log.push('where:' + c + ':' + f + ':' + v), storagePrefix: async (p) => log.push('st:' + p), scrubComments: async (u) => log.push('scrub:' + u), postMedia: async (u) => log.push('media:' + u), readUser: async () => ({ proSource: 'revenuecat' }) },
    deleteAuth: async (u) => log.push('auth:' + u), env: {}, ...over }; };

  await t('plan covers every user-owned collection + storage and rejects bad uids', () => {
    const steps = lib.buildDeletionPlan(UID, NOW).map((s) => s.kind + ':' + (s.path || s.collection || s.prefix));
    ['recursive:users/' + UID, 'doc:publicProfiles/' + UID, 'doc:streaks/' + UID, 'doc:userSettings/' + UID, 'doc:discipline/' + UID, 'doc:userRanks/' + UID, 'doc:badges/' + UID,
      'doc:monthlyStats/2026-11/users/' + UID, 'doc:monthlyStats/2026-11/private/' + UID, 'doc:monthlyStats/2024-01/users/' + UID,
      'idPrefix:weeklyRoutines', 'idPrefix:wontDoTasks', 'idPrefix:dailyReports', 'where:posts', 'where:rooms', 'where:meals', 'where:icsTokens',
      'storagePrefix:avatars/' + UID, 'storagePrefix:task_images/' + UID + '_', 'storagePrefix:task_files/' + UID + '_',
      'storagePrefix:mealImages/' + UID + '_', 'storagePrefix:uploads/' + UID + '_', 'scrubComments:undefined', 'postMedia:undefined'].forEach((x) => assert.ok(steps.includes(x), 'missing ' + x));
    assert.throws(() => lib.buildDeletionPlan('../users/x', NOW)); assert.throws(() => lib.buildDeletionPlan('', NOW));
  });
  await t('405 / 401 without or with bad token; nothing deleted', async () => {
    const d = mk(); assert.equal((await fn._handler(req('Bearer x', {}, 'GET'), d)).statusCode, 405);
    assert.equal((await fn._handler(req(null), d)).statusCode, 401);
    assert.equal((await fn._handler(req('Bearer bad'), mk({ verify: async () => { throw new Error('x'); } }))).statusCode, 401); assert.equal(d.log.length, 0);
  });
  await t('stale sign-in -> 401 reauth-required, nothing deleted', async () => {
    const d = mk({ verify: async () => ({ uid: UID, auth_time: nowSec - 3600 }) }); const r = await fn._handler(req(), d);
    assert.equal(r.statusCode, 401); assert.equal(JSON.parse(r.body).code, 'reauth-required'); assert.equal(d.log.length, 0);
  });
  await t('happy path: data deleted, Auth user deleted LAST, uid from token not body', async () => {
    const d = mk(); const r = await fn._handler(req('Bearer tok', { uid: 'someoneElse12345', appleAuthorizationCode: '' }), d); assert.equal(r.statusCode, 200);
    const b = JSON.parse(r.body); assert.equal(b.ok, true); assert.equal(b.apple, 'skipped-not-configured'); assert.ok(/Apple ID settings/.test(b.iapNote));
    assert.equal(d.log[d.log.length - 1], 'auth:' + UID); assert.ok(d.log.includes('rec:users/' + UID)); assert.ok(!d.log.some((l) => l.includes('someoneElse')));
  });
  await t('partial failure -> 500 and Auth user is NOT deleted (retry stays possible)', async () => {
    const d = mk(); d.io.doc = async (p) => { if (p.startsWith('streaks')) throw new Error('boom'); };
    const r = await fn._handler(req(), d); assert.equal(r.statusCode, 500); assert.ok(!d.log.some((l) => l.startsWith('auth:')));
  });
  await t('stripe subscription cancelled when present; failure does not block deletion', async () => {
    const calls = []; const d = mk({ stripe: { subscriptions: { cancel: async (id) => { calls.push(id); } } } }); d.io.readUser = async () => ({ stripeSubscriptionId: 'sub_1' });
    const b = JSON.parse((await fn._handler(req(), d)).body); assert.deepEqual(calls, ['sub_1']); assert.equal(b.stripe, 'cancelled');
    const d2 = mk({ stripe: { subscriptions: { cancel: async () => { throw new Error('x'); } } } }); d2.io.readUser = async () => ({ subscriptionId: 'sub_2' });
    assert.equal(JSON.parse((await fn._handler(req(), d2)).body).stripe, 'failed');
  });
  await t('Apple revocation: signs ES256 client_secret, exchanges code, revokes refresh token; skipped w/o config or code', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const env = { APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567', APPLE_CLIENT_ID: 'app.clingnote.ios', APPLE_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
    const calls = []; const fetchImpl = async (url, o) => { calls.push({ url, body: new URLSearchParams(o.body) }); return { ok: true, json: async () => ({ refresh_token: 'r1' }) }; };
    assert.equal(await lib.revokeAppleToken('code1', { env, fetchImpl }), 'revoked');
    assert.equal(calls[0].url, 'https://appleid.apple.com/auth/token'); assert.equal(calls[1].url, 'https://appleid.apple.com/auth/revoke');
    assert.equal(calls[1].body.get('token'), 'r1'); assert.equal(calls[1].body.get('token_type_hint'), 'refresh_token');
    const [h, p, s] = calls[0].body.get('client_secret').split('.'); const dec = (x) => JSON.parse(Buffer.from(x, 'base64').toString());
    assert.equal(dec(h).alg, 'ES256'); assert.equal(dec(p).iss, 'TEAM123456'); assert.equal(dec(p).sub, 'app.clingnote.ios'); assert.equal(dec(p).aud, 'https://appleid.apple.com');
    assert.ok(crypto.verify('sha256', Buffer.from(h + '.' + p), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')));
    assert.equal(await lib.revokeAppleToken('code1', { env: {}, fetchImpl }), 'skipped-not-configured'); assert.equal(await lib.revokeAppleToken('', { env, fetchImpl }), 'skipped-no-code');
    assert.equal(await lib.revokeAppleToken('c', { env, fetchImpl: async () => ({ ok: false, json: async () => ({}) }) }), 'failed');
  });
  await t('comment scrub removes only the user\'s comments/replies/reaction/read marker from other people\'s posts', () => {
    const O = 'otherUser1234567890abcdefgh12';
    const post = { comments: [{ id: 'a', userId: UID, message: 'x' }, { id: 'b', userId: O, message: 'y', replies: [{ id: 'r1', userId: UID }, { id: 'r2', userId: O }] }, { id: 'c', userId: O }], reactions: { [UID]: 'like', [O]: 'love' }, readComments: { [UID]: ['a'], [O]: ['b'] } };
    const r = lib.scrubPostData(JSON.parse(JSON.stringify(post)), UID);
    assert.deepEqual(r.update.comments.map((c) => c.id), ['b', 'c']); assert.deepEqual(r.update.comments[0].replies.map((x) => x.id), ['r2']);
    assert.deepEqual(r.update.reactions, { [O]: 'love' }); assert.equal(r.dropReadComments, true);
    assert.equal(lib.scrubPostData({ comments: [{ id: 'c', userId: O }], reactions: { [O]: 'x' }, readComments: { [O]: [] } }, UID), null); assert.equal(lib.scrubPostData({}, UID), null);
  });
  await t('storage path is derived from a post mediaUrl (only uploads/ is deleted by the executor)', () => {
    assert.equal(lib.storagePathFromUrl('https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/uploads%2Fmy%20pic.png?alt=media&token=t'), 'uploads/my pic.png');
    assert.equal(lib.storagePathFromUrl(''), null); assert.equal(lib.storagePathFromUrl('https://example.com/a.png'), null);
  });
  await t('OneSignal + RevenueCat: skipped without keys, correct REST DELETE with keys, failure never blocks', async () => {
    const calls = []; const f = (status) => async (url, o) => { calls.push({ url, o }); return { ok: status < 300, status }; };
    assert.equal(await lib.deleteOneSignalUser(UID, { env: {}, fetchImpl: f(200) }), 'skipped-not-configured'); assert.equal(await lib.deleteRevenueCatSubscriber(UID, { env: {}, fetchImpl: f(200) }), 'skipped-not-configured'); assert.equal(calls.length, 0);
    assert.equal(await lib.deleteOneSignalUser(UID, { env: { ONESIGNAL_REST_API_KEY: 'os_v2_app_k', ONESIGNAL_APP_ID: 'APP1' }, fetchImpl: f(200) }), 'deleted');
    assert.equal(calls[0].url, 'https://api.onesignal.com/apps/APP1/users/by/external_id/' + UID); assert.equal(calls[0].o.method, 'DELETE'); assert.equal(calls[0].o.headers.Authorization, 'Key os_v2_app_k');
    assert.equal(await lib.deleteRevenueCatSubscriber(UID, { env: { REVENUECAT_SECRET_KEY: 'sk_x' }, fetchImpl: f(200) }), 'deleted');
    assert.equal(calls[1].url, 'https://api.revenuecat.com/v1/subscribers/' + UID); assert.equal(calls[1].o.method, 'DELETE'); assert.equal(calls[1].o.headers.Authorization, 'Bearer sk_x');
    assert.equal(await lib.deleteRevenueCatSubscriber(UID, { env: { REVENUECAT_SECRET_KEY: 'k' }, fetchImpl: f(404) }), 'not-found'); assert.equal(await lib.deleteOneSignalUser(UID, { env: { ONESIGNAL_REST_API_KEY: 'k' }, fetchImpl: f(500) }), 'failed');
    assert.equal(await lib.deleteOneSignalUser(UID, { env: { ONESIGNAL_REST_API_KEY: 'k' }, fetchImpl: async () => { throw new Error('net'); } }), 'failed');
    const d = mk({ env: { ONESIGNAL_REST_API_KEY: 'k', REVENUECAT_SECRET_KEY: 'k' }, fetch: f(500) }); const r = await fn._handler(req(), d); const b = JSON.parse(r.body);
    assert.equal(r.statusCode, 200); assert.equal(b.onesignal, 'failed'); assert.equal(b.revenuecat, 'failed'); assert.equal(d.log[d.log.length - 1], 'auth:' + UID);
  });
  console.log(`\n${n} delete-account tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
