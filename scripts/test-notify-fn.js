// Run: node scripts/test-notify-fn.js  (send-notification Netlify Function with mocked auth + fetch; no network, no secrets)
const path = require('path'); const assert = require('assert');
const fn = require(path.join(__dirname, '../netlify/functions/send-notification.js'));
const { buildPayload, authHeader } = require(path.join(__dirname, '../netlify/functions/lib/notify.js'));
(async () => {
  let n = 0; const t = async (name, f) => { await f(); n++; console.log('ok -', name); };
  process.env.ONESIGNAL_APP_ID = 'test-app'; process.env.ONESIGNAL_REST_API_KEY = 'test-key'; delete process.env.ONESIGNAL_ALLOW_BROADCAST;
  const verify = async (tok) => { if (tok !== 'good') throw new Error('bad'); return { uid: 'u1' }; };
  let sent = null; const fetchOk = async (url, opts) => { sent = { url, opts, body: JSON.parse(opts.body) }; return { ok: true, json: async () => ({ id: 'n1' }) }; };
  const ev = (body, auth = 'Bearer good', method = 'POST') => ({ httpMethod: method, headers: auth ? { authorization: auth } : {}, body: JSON.stringify(body) });
  await t('rejects missing token', async () => { const r = await fn.handler(ev({ message: 'x' }, null), {}, { verify, fetch: fetchOk }); assert.equal(r.statusCode, 401); });
  await t('rejects invalid token', async () => { const r = await fn.handler(ev({ message: 'x' }, 'Bearer nope'), {}, { verify, fetch: fetchOk }); assert.equal(r.statusCode, 401); });
  await t('GET not allowed', async () => assert.equal((await fn.handler(ev({}, 'Bearer good', 'GET'), {}, { verify, fetch: fetchOk })).statusCode, 405));
  await t('self push targets only the caller uid; client-supplied targets ignored', async () => {
    const r = await fn.handler(ev({ title: 'T', message: 'Hi', include_player_ids: ['someone-else'], uid: 'attacker' }), {}, { verify, fetch: fetchOk });
    assert.equal(r.statusCode, 200); assert.deepEqual(sent.body.include_aliases, { external_id: ['u1'] }); assert.equal(sent.body.include_player_ids, undefined); assert.equal(sent.body.included_segments, undefined);
    assert.equal(sent.opts.headers.Authorization, 'Basic test-key'); assert.equal(sent.body.app_id, 'test-app');
  });
  await t('broadcast disabled by default', async () => assert.equal((await fn.handler(ev({ kind: 'broadcast', message: 'x' }), {}, { verify, fetch: fetchOk })).statusCode, 403));
  await t('broadcast when enabled', async () => { process.env.ONESIGNAL_ALLOW_BROADCAST = 'true'; const r = await fn.handler(ev({ kind: 'broadcast', message: 'x' }), {}, { verify, fetch: fetchOk }); assert.equal(r.statusCode, 200); assert.deepEqual(sent.body.included_segments, ['Subscribed Users']); delete process.env.ONESIGNAL_ALLOW_BROADCAST; });
  await t('server key missing -> 500, no call', async () => { delete process.env.ONESIGNAL_REST_API_KEY; sent = null; const r = await fn.handler(ev({ message: 'x' }), {}, { verify, fetch: fetchOk }); assert.equal(r.statusCode, 500); assert.equal(sent, null); process.env.ONESIGNAL_REST_API_KEY = 'test-key'; });
  await t('payload validation (empty, clip, sendAfter, url allowlist)', async () => {
    assert.throws(() => buildPayload({ appId: 'a', uid: 'u', message: '  ' }));
    const p = buildPayload({ appId: 'a', uid: 'u', message: 'x'.repeat(999), sendAfter: new Date(Date.now() + 3600e3).toISOString(), url: 'https://evil.example/x' });
    assert.equal(p.contents.en.length, 300); assert.ok(p.send_after); assert.equal(p.url, undefined);
    assert.throws(() => buildPayload({ appId: 'a', uid: 'u', message: 'x', sendAfter: new Date(Date.now() + 40 * 86400e3).toISOString() }));
  });
  await t('v2 keys use Key scheme', async () => { assert.equal(authHeader('os_v2_app_x'), 'Key os_v2_app_x'); });
  await t('no REST key or OneSignal API call left in client code', async () => {
    const fs = require('fs'); const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    for (const f of walk(path.join(__dirname, '../src')).filter((x) => /\.(js|vue)$/.test(x))) {
      const c = fs.readFileSync(f, 'utf8');
      assert.ok(!/onesignal\.com\/api/.test(c), `OneSignal API call in ${f}`);
      assert.ok(!/os_v2_app_|Basic [A-Za-z0-9+/=]{30,}|Bearer [A-Za-z0-9]{40,}/.test(c), `key-like string in ${f}`);
    }
  });
  // Resolve firebase-admin the way lib/firebaseAdmin.js does (netlify/functions/node_modules first), so the stub replaces the module it actually loads.
  const libDir = path.join(__dirname, '../netlify/functions/lib'); let hasFirebaseAdmin = true; try { require.resolve('firebase-admin', { paths: [libDir] }); } catch (e) { hasFirebaseAdmin = false; }
  if (!hasFirebaseAdmin) console.log('skip - notify.getAdmin shared helper case: firebase-admin is not installed (run `npm ci` in the repo root and in netlify/functions)');
  else await t('notify.getAdmin uses the shared firebaseAdmin helper (all credential env var names)', async () => {
    const notify = require(path.join(__dirname, '../netlify/functions/lib/notify.js')); const shared = require(path.join(__dirname, '../netlify/functions/lib/firebaseAdmin.js'));
    assert.strictEqual(notify.getAdmin, shared.getAdmin, 'one init helper');
    const keys = ['FIREBASE_SERVICE_ACCOUNT', 'GOOGLE_APPLICATION_CREDENTIALS_BASE64', 'GOOGLE_APPLICATION_CREDENTIALS_BASE']; const saved = {}; keys.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; });
    const fakePath = require.resolve('firebase-admin', { paths: [libDir] }); const savedMod = require.cache[fakePath]; const inits = [];
    try {
      for (const k of keys) {
        delete require.cache[require.resolve(path.join(__dirname, '../netlify/functions/lib/firebaseAdmin.js'))];
        require.cache[fakePath] = { id: fakePath, filename: fakePath, loaded: true, exports: { apps: [], credential: { cert: (c) => ({ cert: c }) }, initializeApp: (o) => { inits.push(o); } } };
        const fresh = require(path.join(__dirname, '../netlify/functions/lib/firebaseAdmin.js'));
        assert.throws(() => fresh.getAdmin(), /not configured/, 'no creds -> clear error');
        const json = JSON.stringify({ project_id: 'p', client_email: 'e', private_key: 'k' });
        process.env[k] = k === 'FIREBASE_SERVICE_ACCOUNT' ? json : Buffer.from(json).toString('base64');
        delete require.cache[require.resolve(path.join(__dirname, '../netlify/functions/lib/firebaseAdmin.js'))];
        require(path.join(__dirname, '../netlify/functions/lib/firebaseAdmin.js')).getAdmin(); delete process.env[k];
      }
      assert.equal(inits.length, 3, 'initialised with each of the 3 env var names');
    } finally { keys.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }); if (savedMod) require.cache[fakePath] = savedMod; else delete require.cache[fakePath]; }
  });
  console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
