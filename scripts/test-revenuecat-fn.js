// Run: node scripts/test-revenuecat-fn.js  (RevenueCat webhook/sync with mocked RC REST + Firestore; no network, no secrets)
const path = require('path'); const assert = require('assert');
const wh = require(path.join(__dirname, '../netlify/functions/revenuecat-webhook.js'));
const sy = require(path.join(__dirname, '../netlify/functions/revenuecat-sync.js'));
const { entitlementUpdate, decideWrite, candidateUids, authOk } = require(path.join(__dirname, '../netlify/functions/lib/revenuecat.js'));
(async () => {
  let n = 0; const t = async (name, f) => { await f(); n++; console.log('ok -', name); };
  process.env.REVENUECAT_WEBHOOK_SECRET = 'whsec_test'; process.env.REVENUECAT_SECRET_KEY = 'sk_test';
  const NOW = new Date('2026-11-01T12:00:00Z'); const UID = 'abcDEF1234567890abcdEFGH1234';
  const day = (d) => new Date(NOW.getTime() + d * 86400e3).toISOString();
  const subOf = (ent, subs = {}) => ({ subscriber: { entitlements: ent ? { pro: ent } : {}, subscriptions: subs } });
  const mkDeps = (subscriber, docs = { [UID]: { isPro: false } }) => {
    const writes = []; const calls = [];
    return { writes, calls, now: NOW,
      fetch: async (url, opts) => { calls.push({ url, opts }); return { ok: true, json: async () => subscriber }; },
      io: { read: async (u) => docs[u] || null, write: async (u, d) => { writes.push({ u, d }); docs[u] = { ...docs[u], ...d }; } } };
  };
  const ev = (event, auth = 'Bearer whsec_test') => ({ httpMethod: 'POST', headers: auth ? { authorization: auth } : {}, body: JSON.stringify({ event }) });

  await t('entitlementUpdate: monthly active', () => { const u = entitlementUpdate(subOf({ product_identifier: 'clingnote_pro_monthly', expires_date: day(20) }).subscriber, NOW); assert.equal(u.isPro, true); assert.equal(u.plan, 'monthly'); assert.equal(u.proExpiresAt.toISOString(), day(20)); assert.equal(u.proSource, 'revenuecat'); });
  await t('entitlementUpdate: yearly trial/active', () => { const u = entitlementUpdate(subOf({ product_identifier: 'clingnote_pro_yearly', expires_date: day(3) }, { clingnote_pro_yearly: { period_type: 'trial', is_sandbox: true, store: 'app_store' } }).subscriber, NOW); assert.equal(u.plan, 'yearly'); assert.equal(u.iapEnvironment, 'sandbox'); });
  await t('entitlementUpdate: lifetime (no expiry) -> plan lifetime, proExpiresAt null', () => { const u = entitlementUpdate(subOf({ product_identifier: 'clingnote_pro_lifetime', expires_date: null }).subscriber, NOW); assert.equal(u.isPro, true); assert.equal(u.plan, 'lifetime'); assert.equal(u.proExpiresAt, null); });
  await t('entitlementUpdate: expired / absent -> not pro', () => { assert.equal(entitlementUpdate(subOf({ product_identifier: 'clingnote_pro_monthly', expires_date: day(-1) }).subscriber, NOW).isPro, false); assert.equal(entitlementUpdate({}, NOW).isPro, false); });
  await t('entitlementUpdate: billing-retry grace keeps access', () => { const u = entitlementUpdate(subOf({ product_identifier: 'clingnote_pro_monthly', expires_date: day(-1), grace_period_expires_date: day(5) }).subscriber, NOW); assert.equal(u.isPro, true); assert.equal(u.proExpiresAt.toISOString(), day(5)); });
  await t('decideWrite: never revokes Stripe-sourced Pro; never downgrades longer Stripe Pro', () => {
    const stripeDoc = { isPro: true, plan: 'yearly', proSource: 'stripe', proExpiresAt: new Date(day(200)) };
    assert.equal(decideWrite(stripeDoc, { isPro: false, plan: null, proExpiresAt: null }, NOW), null);
    assert.equal(decideWrite(stripeDoc, entitlementUpdate(subOf({ product_identifier: 'clingnote_pro_monthly', expires_date: day(20) }).subscriber, NOW), NOW), null);
    assert.ok(decideWrite({ isPro: true, plan: 'monthly', proSource: 'stripe', proExpiresAt: new Date(day(2)) }, entitlementUpdate(subOf({ product_identifier: 'clingnote_pro_lifetime', expires_date: null }).subscriber, NOW), NOW));
  });
  await t('decideWrite: revokes RC-sourced Pro on expiry; no-op for free user', () => {
    const r = decideWrite({ isPro: true, plan: 'monthly', proSource: 'revenuecat' }, { isPro: false, plan: null, proExpiresAt: new Date(day(-1)) }, NOW); assert.equal(r.isPro, false);
    assert.equal(decideWrite({ isPro: false }, { isPro: false, plan: null, proExpiresAt: null }, NOW), null);
  });
  await t('auth: wrong/missing header -> 401, nothing fetched', async () => {
    const d = mkDeps(subOf(null)); assert.equal((await wh._handler(ev({ type: 'INITIAL_PURCHASE', app_user_id: UID }, null), d)).statusCode, 401); assert.equal((await wh._handler(ev({ type: 'INITIAL_PURCHASE', app_user_id: UID }, 'Bearer nope'), d)).statusCode, 401); assert.equal(d.calls.length, 0);
    const saved = process.env.REVENUECAT_WEBHOOK_SECRET; delete process.env.REVENUECAT_WEBHOOK_SECRET; assert.equal(authOk({ authorization: 'Bearer undefined' }, undefined), false); process.env.REVENUECAT_WEBHOOK_SECRET = saved;
  });
  await t('GET not allowed; TEST event ok', async () => { assert.equal((await wh._handler({ httpMethod: 'GET', headers: {} }, {})).statusCode, 405); assert.equal((await wh._handler(ev({ type: 'TEST' }), mkDeps(subOf(null)))).statusCode, 200); });
  await t('INITIAL_PURCHASE: re-verifies via REST with Bearer secret key, then writes (payload not trusted)', async () => {
    const d = mkDeps(subOf({ product_identifier: 'clingnote_pro_yearly', expires_date: day(365) }));
    const r = await wh._handler(ev({ type: 'INITIAL_PURCHASE', app_user_id: UID, product_id: 'clingnote_pro_lifetime', environment: 'SANDBOX' }), d);
    assert.equal(r.statusCode, 200); assert.equal(d.calls.length, 1); assert.ok(d.calls[0].url.endsWith(`/v1/subscribers/${UID}`)); assert.equal(d.calls[0].opts.headers.Authorization, 'Bearer sk_test');
    assert.equal(d.writes.length, 1); assert.equal(d.writes[0].d.plan, 'yearly'); assert.equal(d.writes[0].d.isPro, true);
  });
  await t('idempotent: same event twice -> same state', async () => {
    const docs = { [UID]: { isPro: false } }; const body = ev({ id: 'e1', type: 'RENEWAL', app_user_id: UID });
    const s = subOf({ product_identifier: 'clingnote_pro_monthly', expires_date: day(30) });
    await wh._handler(body, mkDeps(s, docs)); const snap = JSON.stringify(docs); await wh._handler(body, mkDeps(s, docs)); assert.equal(JSON.stringify(docs), snap);
  });
  await t('EXPIRATION: RC says expired -> revoke RC-granted Pro', async () => {
    const d = mkDeps(subOf({ product_identifier: 'clingnote_pro_monthly', expires_date: day(-1) }), { [UID]: { isPro: true, plan: 'monthly', proSource: 'revenuecat' } });
    await wh._handler(ev({ type: 'EXPIRATION', app_user_id: UID }), d); assert.equal(d.writes[0].d.isPro, false);
  });
  await t('webhook says EXPIRATION but RC still active (stale) -> stays Pro', async () => {
    const d = mkDeps(subOf({ product_identifier: 'clingnote_pro_monthly', expires_date: day(10) }), { [UID]: { isPro: true, plan: 'monthly', proSource: 'revenuecat' } });
    await wh._handler(ev({ type: 'EXPIRATION', app_user_id: UID }), d); assert.ok(d.writes.every((w) => w.d.isPro === true));
  });
  await t('anonymous ids / unknown users / path-like ids ignored; TRANSFER syncs both sides', async () => {
    assert.deepEqual(candidateUids({ app_user_id: '$RCAnonymousID:abc', aliases: ['../../x', UID] }), [UID]);
    const other = 'zzzzYYYY1111xxxxWWWW2222'; assert.deepEqual(candidateUids({ type: 'TRANSFER', transferred_from: [UID], transferred_to: [other] }).sort(), [UID, other].sort());
    const d = mkDeps(subOf(null), {}); const r = await wh._handler(ev({ type: 'INITIAL_PURCHASE', app_user_id: UID }), d); assert.equal(r.statusCode, 200); assert.equal(d.calls.length, 0); assert.equal(d.writes.length, 0);
  });
  await t('RC lookup failure -> 500 so RevenueCat retries', async () => {
    const d = mkDeps(subOf(null)); d.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) }); assert.equal((await wh._handler(ev({ type: 'RENEWAL', app_user_id: UID }), d)).statusCode, 500);
  });
  await t('sync endpoint: needs Firebase token, only syncs caller uid', async () => {
    const verify = async (tok) => { if (tok !== 'good') throw new Error('bad'); return { uid: UID }; };
    const d = mkDeps(subOf({ product_identifier: 'clingnote_pro_monthly', expires_date: day(30) }));
    assert.equal((await sy._handler({ httpMethod: 'POST', headers: {} }, { ...d, verify })).statusCode, 401);
    const r = await sy._handler({ httpMethod: 'POST', headers: { authorization: 'Bearer good' }, body: JSON.stringify({ uid: 'attacker1234567' }) }, { ...d, verify });
    assert.equal(r.statusCode, 200); assert.deepEqual(JSON.parse(r.body), { isPro: true, plan: 'monthly' }); assert.ok(d.calls[0].url.includes(UID)); assert.equal(d.writes[0].u, UID);
  });
  await t('client code never writes entitlement fields', () => {
    const fs = require('fs'); const src = fs.readFileSync(path.join(__dirname, '../src/utils/iap.js'), 'utf8'); assert.ok(!/setDoc|updateDoc|isPro\s*:/.test(src));
  });
  console.log(`\n${n} passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
