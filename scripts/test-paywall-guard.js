// node scripts/test-paywall-guard.js — paywall guard: free = tasks (+ basics), everything else ClingNote Pro, gated in UI routes and server functions.
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const sr = require('./lib/srcRequire');
const P = sr.load('utils/pro.js');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const free = { isPro: false }; const pro = { isPro: true, plan: 'pro_yearly', proExpiresAt: new Date(Date.now() + 864e5).toISOString() };
const expired = { isPro: true, plan: 'pro_monthly', proExpiresAt: '2020-01-01T00:00:00Z' }; const life = { isPro: true, plan: 'lifetime', proExpiresAt: '2020-01-01T00:00:00Z' };
ok(P.ENFORCE_PAYWALL === true, 'paywall enforced');
for (const f of P.FREE_FEATURES) ok(P.canUse(free, f) && P.canUse(null, f), `free: ${f}`);
for (const f of ['tasks', 'editTask', 'completeTask', 'settings', 'account']) ok(P.FREE_FEATURES.includes(f), `${f} is free`);
for (const f of [...P.PRO_FEATURES, 'someFutureFeature']) { ok(!P.canUse(free, f) && !P.canUse(null, f) && !P.canUse(expired, f), `free blocked: ${f}`); ok(P.canUse(pro, f) && P.canUse(life, f), `Pro allowed: ${f}`); }
// Router: every Pro screen carries meta.proFeature; the basics and the paywall stay open.
const router = R('src/router/index.js');
const metaOf = (p) => { const i = router.indexOf(`path: '${p}',`); assert(i >= 0, p); return router.slice(i, router.indexOf('}', router.indexOf('meta:', i)) + 1); };
for (const p of ['/upcoming', '/community', '/rankings', '/discipline', '/discipline/log', '/pals', '/manage', '/manage/:ownerUid', '/addiction']) ok(/proFeature: '\w+'/.test(metaOf(p)), `route ${p} is Pro`);
for (const p of ['/home', '/settings', '/onboarding', '/login']) { const i = router.indexOf(`path: '${p}'`); if (i >= 0) ok(!/proFeature/.test(router.slice(i, router.indexOf('}', router.indexOf('meta:', i)) + 1)) || !router.slice(i, i + 300).includes('meta:'), `route ${p} free`); }
ok(/path: '\/paywall'/.test(router), '/paywall route exists (App Review)');
ok(/data-test="pw-restore"/.test(R('src/components/paywall/PaywallPanel.vue')), 'Restore Purchases on the paywall');
// Server: every function behind a Pro feature checks Pro.
for (const f of ['ai', 'calendar', 'calendar-token', 'eight-hour-day', 'manager-pal', 'friend-unlock', 'tts', 'community-notify', 'widget-complete']) ok(/requirePro|assertPro|isProDoc/.test(R(`netlify/functions/${f}.js`)), `server ${f} checks Pro`);
(async () => {
  const { assertPro } = require('../netlify/functions/lib/requirePro');
  const db = (d) => ({ doc: () => ({ get: async () => ({ exists: !!d, data: () => d }) }) });
  await assert.rejects(assertPro(db(free), 'zztest-free'), (e) => e.status === 402); n++;
  await assert.rejects(assertPro(db(null), 'zztest-none'), (e) => e.status === 402); n++;
  await assert.rejects(assertPro(db(expired), 'zztest-exp'), (e) => e.status === 402); n++;
  await assertPro(db(pro), 'zztest-pro'); await assertPro(db(life), 'zztest-life'); n += 2;
  console.log(`paywall guard: ${n} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
