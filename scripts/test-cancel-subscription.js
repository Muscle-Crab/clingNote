// Run: node scripts/test-cancel-subscription.js  (cancel-subscription function with fakes; no network, no secrets)
const path = require('path'); const assert = require('assert'); const fs = require('fs');
const fn = require(path.join(__dirname, '../netlify/functions/cancel-subscription.js'));
const wh = require(path.join(__dirname, '../netlify/functions/stripe-webhook.js'));
(async () => {
  let n = 0; const t = async (name, f) => { await f(); n++; console.log('ok -', name); };
  const UID = 'uidAAAA111122223333'; const OTHER = 'uidBBBB444455556666'; const END = 1893456000;
  const req = (auth = 'Bearer tok', body = {}, method = 'POST') => ({ httpMethod: method, headers: auth ? { authorization: auth } : {}, body: JSON.stringify(body) });
  const mk = (over = {}) => { const calls = []; const sub = { id: 'sub_1', status: 'active', customer: 'cus_1', metadata: { uid: UID, plan: 'monthly' }, current_period_end: END, cancel_at_period_end: false, ...(over.sub || {}) };
    return { calls, verify: async (tok) => { if (tok !== 'tok') throw new Error('bad'); return { uid: UID }; },
      readUser: async (id) => { calls.push('read:' + id); return 'user' in over ? over.user : { isPro: true, stripeSubscriptionId: 'sub_1', stripeCustomerId: 'cus_1', proSource: 'stripe' }; },
      stripe: { subscriptions: { retrieve: async (id) => { calls.push('retrieve:' + id); return sub; }, update: async (id, p) => { calls.push('update:' + id + ':' + JSON.stringify(p)); return { ...sub, ...p }; },
        cancel: async () => { calls.push('HARD-CANCEL'); }, del: async () => { calls.push('HARD-CANCEL'); } } } }; };
  const run = (d, r = req()) => fn._handler(r, d);

  await t('405 for GET, 401 without / with a bad token; nothing read or cancelled', async () => {
    const d = mk(); assert.equal((await run(d, req('Bearer tok', {}, 'GET'))).statusCode, 405);
    assert.equal((await run(d, req(null, { userId: UID }))).statusCode, 401);
    assert.equal((await run(d, req('Bearer nope', { userId: UID }))).statusCode, 401);
    assert.equal(d.calls.length, 0);
  });
  await t('a body userId that is not the caller is refused (403) before anything is read', async () => {
    const d = mk(); const r = await run(d, req('Bearer tok', { userId: OTHER })); assert.equal(r.statusCode, 403); assert.equal(d.calls.length, 0);
  });
  await t('happy path: uid from the token, cancel at period end (not an immediate delete), endsAt returned', async () => {
    const d = mk(); const r = await run(d, req('Bearer tok', {})); assert.equal(r.statusCode, 200); const b = JSON.parse(r.body);
    assert.equal(b.ok, true); assert.equal(b.cancelAtPeriodEnd, true); assert.equal(b.endsAt, new Date(END * 1000).toISOString());
    assert.deepEqual(d.calls, ['read:' + UID, 'retrieve:sub_1', 'update:sub_1:{"cancel_at_period_end":true}']);
  });
  await t('a matching body userId is accepted', async () => { assert.equal((await run(mk(), req('Bearer tok', { userId: UID }))).statusCode, 200); });
  await t('subscription belonging to someone else (metadata uid mismatch, customer mismatch) -> 403, never cancelled', async () => {
    const d = mk({ sub: { metadata: { uid: OTHER }, customer: 'cus_other' } }); const r = await run(d); assert.equal(r.statusCode, 403);
    assert.ok(!d.calls.some((c) => c.startsWith('update') || c === 'HARD-CANCEL'));
    const d2 = mk({ sub: { metadata: { uid: OTHER } } }); assert.equal((await run(d2)).statusCode, 403); // same customer id but metadata names another uid
    const d3 = mk({ sub: { metadata: {}, customer: 'cus_other' } }); assert.equal((await run(d3)).statusCode, 403);
  });
  await t('subscription with no metadata but the user\'s own customer id is accepted (legacy subs)', async () => { assert.equal((await run(mk({ sub: { metadata: {} } }))).statusCode, 200); });
  await t('Apple-managed subscription -> 400 managed-by-apple, Stripe never touched', async () => {
    const d = mk({ user: { isPro: true, proSource: 'revenuecat', stripeSubscriptionId: 'sub_1' } }); const r = await run(d);
    assert.equal(r.statusCode, 400); assert.equal(JSON.parse(r.body).code, 'managed-by-apple'); assert.ok(!d.calls.some((c) => c.includes('sub_1')));
  });
  await t('no user doc -> 404; no subscription id (e.g. lifetime) -> 400', async () => {
    assert.equal((await run(mk({ user: null }))).statusCode, 404);
    const r = await run(mk({ user: { isPro: true, plan: 'lifetime' } })); assert.equal(r.statusCode, 400); assert.equal(JSON.parse(r.body).code, 'no-subscription');
  });
  await t('idempotent: already cancelling -> 200 without a second update', async () => {
    const d = mk({ sub: { cancel_at_period_end: true } }); const r = await run(d); const b = JSON.parse(r.body);
    assert.equal(r.statusCode, 200); assert.equal(b.already, true); assert.ok(!d.calls.some((c) => c.startsWith('update')));
  });
  await t('Stripe failure -> 500 with a generic message (no internals leaked)', async () => {
    const d = mk(); d.stripe.subscriptions.update = async () => { throw new Error('sk_test_SECRET boom'); }; const r = await run(d);
    assert.equal(r.statusCode, 500); assert.ok(!/sk_|boom/.test(r.body));
  });
  await t('webhook records cancelAtPeriodEnd while active and clears it when the subscription is deleted', async () => {
    const o = { id: 'sub_1', status: 'active', metadata: { uid: UID, plan: 'monthly' }, cancel_at_period_end: true, current_period_end: END, customer: 'cus_1' };
    const a = await wh.buildUpdate({ type: 'customer.subscription.updated', data: { object: o } }); assert.equal(a.update.cancelAtPeriodEnd, true); assert.equal(a.update.isPro, true);
    const d = await wh.buildUpdate({ type: 'customer.subscription.deleted', data: { object: { ...o, status: 'canceled' } } }); assert.equal(d.update.isPro, false); assert.equal(d.update.cancelAtPeriodEnd, false);
  });
  await t('client sends the Firebase ID token and reads isPro (not the dead hasPaid / current_period_end fields); rules protect cancelAtPeriodEnd', () => {
    const v = fs.readFileSync(path.join(__dirname, '../src/views/Subs.vue'), 'utf8');
    assert.ok(/Authorization: `Bearer \$\{token\}`/.test(v) && /getIdToken\(\)/.test(v), 'Subs.vue must send the ID token');
    assert.ok(!/data\.hasPaid|current_period_end/.test(v), 'Subs.vue must not read legacy fields');
    assert.ok(/data\.isPro/.test(v) && /proExpiresAt/.test(v));
    assert.ok(/'cancelAtPeriodEnd'/.test(fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8')));
  });
  console.log(`\n${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
