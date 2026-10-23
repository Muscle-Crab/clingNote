// Run: node scripts/test-push-fn.js  (push-send function: auth, own-tokens-only, invalid-token cleanup; no network, no secrets)
const path = require('path'); const assert = require('assert');
const fn = require(path.join(__dirname, '../netlify/functions/push-send.js'));
(async () => {
  let n = 0; const t = async (name, f) => { await f(); n++; console.log('ok -', name); };
  const verify = async (tok) => { if (tok !== 'good') throw new Error('bad'); return { uid: 'u1' }; };
  const docs = { 'users/u1': { fcmTokens: ['t1', 't2', 't3'] }, 'users/u2': { fcmTokens: ['other'] }, 'users/empty': {} };
  let updates = []; let sent = null;
  const db = { doc: (p) => ({ get: async () => ({ exists: !!docs[p], data: () => docs[p] }), update: async (u) => updates.push({ p, u }) }) };
  const FieldValue = { arrayRemove: (...a) => ({ remove: a }) };
  const messaging = { sendEachForMulticast: async (m) => { sent = m; return { successCount: 1, failureCount: 2, responses: [{ success: true }, { success: false, error: { code: 'messaging/registration-token-not-registered' } }, { success: false, error: { code: 'messaging/internal-error' } }] }; } };
  const ev = (body, auth = 'Bearer good', method = 'POST') => ({ httpMethod: method, headers: auth ? { authorization: auth } : {}, body: JSON.stringify(body) });
  const deps = { verify, db, messaging, FieldValue };
  await t('missing/invalid token -> 401', async () => { assert.equal((await fn.handler(ev({}, null), {}, deps)).statusCode, 401); assert.equal((await fn.handler(ev({}, 'Bearer nope'), {}, deps)).statusCode, 401); });
  await t('GET -> 405', async () => assert.equal((await fn.handler(ev({}, 'Bearer good', 'GET'), {}, deps)).statusCode, 405));
  await t('sends only to the caller own tokens; client tokens/uid ignored', async () => {
    const r = await fn.handler(ev({ tokens: ['evil'], token: 'evil', uid: 'u2', title: 'Hi', body: 'There' }), {}, deps);
    assert.equal(r.statusCode, 200); assert.deepEqual(sent.tokens, ['t1', 't2', 't3']); assert.equal(sent.data.title, 'Hi');
    assert.equal(JSON.parse(r.body).sent, 1);
  });
  await t('dead tokens removed (and only dead ones)', async () => { assert.deepEqual(updates[0], { p: 'users/u1', u: { fcmTokens: { remove: ['t2'] } } }); });
  await t('no tokens -> 404 and no send', async () => { sent = null; const r = await fn.handler(ev({}, 'Bearer good'), {}, { ...deps, verify: async () => ({ uid: 'empty' }) }); assert.equal(r.statusCode, 404); assert.equal(sent, null); });
  await t('url must be a same-site path; text is clipped', async () => { await fn.handler(ev({ url: 'https://evil.example', body: 'x'.repeat(999) }), {}, deps); assert.equal(sent.data.url, '/home'); assert.equal(sent.data.body.length, 240); await fn.handler(ev({ url: '//evil.example' }), {}, deps); assert.equal(sent.data.url, '/home'); await fn.handler(ev({ url: '/upcoming' }), {}, deps); assert.equal(sent.data.url, '/upcoming'); });
  console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
