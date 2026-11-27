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
    return { writes, calls, docs, now: NOW,
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
    const d = mkDeps(subOf(null), {}); const r = await wh._handler(ev({ type: 'INITIAL_PURCHASE', app_user_id: UID }), d); assert.equal(r.statusCode, 200); assert.equal(d.calls.length, 1); assert.equal(d.writes.length, 0);
  });
  await t('RC lookup failure -> 500 so RevenueCat retries', async () => {
    const d = mkDeps(subOf(null)); d.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) }); assert.equal((await wh._handler(ev({ type: 'RENEWAL', app_user_id: UID }), d)).statusCode, 500);
  });
  await t('sync endpoint: needs Firebase token, only syncs caller uid', async () => {
    const verify = async (tok) => { if (tok !== 'good') throw new Error('bad'); return { uid: UID }; };
    const d = mkDeps(subOf({ product_identifier: 'clingnote_pro_monthly', expires_date: day(30) }));
    assert.equal((await sy._handler({ httpMethod: 'POST', headers: {} }, { ...d, verify })).statusCode, 401);
    const r = await sy._handler({ httpMethod: 'POST', headers: { authorization: 'Bearer good' }, body: JSON.stringify({ uid: 'attacker1234567' }) }, { ...d, verify });
    assert.equal(r.statusCode, 200); assert.deepEqual(JSON.parse(r.body), { isPro: true, plan: 'monthly', wrote: true }); assert.ok(d.calls[0].url.includes(UID)); assert.equal(d.writes[0].u, UID);
  });
  await t('sync with an existing free doc writes isPro and does not reset Lock In', async () => {
    const verify = async () => ({ uid: UID });
    const d = mkDeps(subOf({ product_identifier: 'clingnote_pro_yearly', expires_date: day(300) }), { [UID]: { isPro: false, lockInEnabled: false, name: 'Ada' } });
    const r = await sy._handler({ httpMethod: 'POST', headers: { authorization: 'Bearer good' } }, { ...d, verify });
    assert.equal(r.statusCode, 200);
    assert.equal(r.headers['Content-Type'], 'application/json');
    assert.equal(JSON.parse(r.body).isPro, true);
    assert.equal(d.writes.length, 1);
    assert.equal(d.writes[0].d.isPro, true);
    assert.equal(d.writes[0].d.plan, 'yearly');
    assert.equal(d.writes[0].d.lockInEnabled, undefined);
    assert.equal(d.docs[UID].lockInEnabled, false);
    assert.equal(d.docs[UID].name, 'Ada');
  });
  await t('sync with no doc and no Apple entitlement does not create a user', async () => {
    const verify = async () => ({ uid: UID });
    const d = mkDeps(subOf(null), {});
    const r = await sy._handler({ httpMethod: 'POST', headers: { authorization: 'Bearer good' } }, { ...d, verify });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(JSON.parse(r.body), { isPro: false, plan: null, wrote: false });
    assert.equal(d.writes.length, 0);
  });
  await t('sync with no user doc still writes Pro and turns Lock In on', async () => {
    const verify = async () => ({ uid: UID });
    const d = mkDeps(subOf({ product_identifier: 'clingnote_pro_monthly', expires_date: day(30) }), {});
    const r = await sy._handler({ httpMethod: 'POST', headers: { authorization: 'Bearer good' } }, { ...d, verify });
    assert.equal(r.statusCode, 200);
    assert.equal(d.writes.length, 1);
    assert.equal(d.writes[0].d.isPro, true);
    assert.equal(d.writes[0].d.plan, 'monthly');
    assert.equal(d.writes[0].d.lockInEnabled, true);
    const { isProDoc } = require(path.join(__dirname, '../netlify/functions/lib/requirePro'));
    assert.equal(isProDoc(d.writes[0].d, NOW), true);
  });
  await t('sync with no RevenueCat secret returns Server not configured and writes nothing', async () => {
    const saved = process.env.REVENUECAT_SECRET_KEY;
    delete process.env.REVENUECAT_SECRET_KEY;
    try {
      const verify = async () => ({ uid: UID });
      const d = mkDeps(subOf({ product_identifier: 'clingnote_pro_monthly', expires_date: day(30) }), {});
      const r = await sy._handler({ httpMethod: 'POST', headers: { authorization: 'Bearer good' } }, { ...d, verify });
      assert.equal(r.statusCode, 500);
      const body = JSON.parse(r.body);
      assert.equal(body.error, 'Server not configured');
      assert.equal(d.writes.length, 0);
      assert.equal(d.calls.length, 0);
      assert.ok(!/sk_|REVENUECAT_SECRET/.test(r.body));
    } finally { if (saved === undefined) delete process.env.REVENUECAT_SECRET_KEY; else process.env.REVENUECAT_SECRET_KEY = saved; }
  });
  await t('gates agree: RevenueCat Pro unlocks Home; a free account stays locked', async () => {
    const { accessPro, isPro } = await import(path.join(__dirname, '../src/utils/pro.js'));
    const free = { isPro: false, plan: 'free' };
    const monthly = { isPro: true, plan: 'monthly', proExpiresAt: day(30) };
    const expired = { isPro: true, plan: 'monthly', proExpiresAt: day(-5) };
    assert.equal(accessPro(free, false), false, 'unpaid');
    assert.equal(accessPro(null, false), false, 'no doc');
    assert.equal(accessPro(free, true), true, 'Profile-style RC Pro must unlock Home, Points, Upcoming, Community');
    assert.equal(accessPro(monthly, false), true, 'server Pro');
    assert.equal(accessPro(expired, false), false, 'expired server Pro is not Pro');
    assert.equal(accessPro(expired, true), true, 'live RC entitlement covers an expired server row');
    assert.equal(isPro(free), false);
  });
  await t('client: purchase sync is not swallowed, and a 402 retries after sync says Pro', () => {
    const fs = require('fs');
    const iap = fs.readFileSync(path.join(__dirname, '../src/utils/iap.js'), 'utf8');
    const eh = fs.readFileSync(path.join(__dirname, '../src/composables/useEightHour.js'), 'utf8');
    const login = fs.readFileSync(path.join(__dirname, '../src/views/Login.vue'), 'utf8');
    const doc = fs.readFileSync(path.join(__dirname, '../src/utils/userDoc.js'), 'utf8');
    const pro = fs.readFileSync(path.join(__dirname, '../src/composables/usePro.js'), 'utf8');
    const apple = fs.readFileSync(path.join(__dirname, '../src/utils/appleAuth.js'), 'utf8');
    assert.ok(/await syncEntitlement\(user\)/.test(iap) && /syncError/.test(iap) && /entitled: active/.test(iap));
    assert.ok(/await identifyIapUser\(user\)/.test(iap) && iap.indexOf('await identifyIapUser(user)') < iap.indexOf('purchasePackage'), 'purchase logs into the Firebase uid before the sheet');
    assert.ok(/addCustomerInfoUpdateListener\(null,/.test(iap), 'listener is the callback form');
    assert.ok(/r\.status === 402 && !retried/.test(eh) && /syncEntitlement/.test(eh) && /synced\.isPro === true/.test(eh), '402 retries the original request only after the server says Pro');
    assert.ok(/Server not configured/.test(eh), 'a missing RevenueCat secret is not shown as Pro required');
    assert.ok(/accessPro\(/.test(pro), 'Home and Profile share one Pro answer');
    assert.ok(/ensureIapUser\(auth\.currentUser\)/.test(fs.readFileSync(path.join(__dirname, '../src/components/shell/AppTabBar.vue'), 'utf8')));
    assert.ok(/browserLocalPersistence/.test(fs.readFileSync(path.join(__dirname, '../src/firebaseConfig.js'), 'utf8')));
    assert.ok(/isPro: false/.test(login) && /plan: 'free'/.test(login));
    assert.ok(/lockInEnabled: true/.test(login) && /lockInEnabled: true/.test(doc));
    assert.ok(/settleNewUser/.test(login) && /user doc create failed/.test(login), 'a failed users doc write does not fail sign-in');
    assert.ok(!/proNow\.value = false/.test(pro), 'clearing the Firestore cache must not clear RevenueCat Pro');
    assert.ok(/sha256Hex/.test(apple) && !/crypto\.subtle/.test(apple), 'Apple nonce hash does not need crypto.subtle');
    assert.ok(/lockInEnabled === true/.test(fs.readFileSync(path.join(__dirname, '../src/utils/lockIn.js'), 'utf8')));
  });
  await t('customerInfo wrapper and Apple nonce hash', async () => {
    const { customerInfoOf } = await import(path.join(__dirname, '../src/utils/customerInfo.js'));
    const { sha256Hex } = await import(path.join(__dirname, '../src/utils/sha256.js'));
    const info = { entitlements: { active: { pro: { productIdentifier: 'clingnote_pro_monthly' } } } };
    assert.equal(customerInfoOf({ customerInfo: info }), info);
    assert.equal(customerInfoOf(info), info);
    assert.equal(customerInfoOf({ customerInfo: {} }), null);
    assert.equal(customerInfoOf(null), null);
    assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const subtle = Buffer.from(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode('clingnote-nonce'))).toString('hex');
    assert.equal(sha256Hex('clingnote-nonce'), subtle);
  });
  await t('client code never writes entitlement fields', () => {
    const fs = require('fs'); const src = fs.readFileSync(path.join(__dirname, '../src/utils/iap.js'), 'utf8'); assert.ok(!/setDoc|updateDoc|isPro\s*:/.test(src));
  });
  console.log(`\n${n} passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
