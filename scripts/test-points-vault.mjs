import fs from 'node:fs';
// Points vault: formula prices from the user's own usage, ascending unlock order, no task gate. Generic labels only.
import assert from 'node:assert/strict';
import * as V from '../src/utils/pointsVault.js';
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };
const today = '2026-11-03'; const week = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
const daysOf = (mins) => Object.fromEntries(week.map((d) => [d, { ...mins }])); // same minutes every day -> avg = bucket
t('sample prices hit the formula', () => { for (const [m, p] of [[0, 80], [15, 110], [30, 140], [60, 200], [120, 320]]) assert.equal(V.priceOf(m), p, `${m} min`); });
t('boss = heaviest, round5(x1.5), capped 600', () => {
  const r = V.priceApps([{ id: 'a', label: 'App A' }, { id: 'b', label: 'App B' }], daysOf({ a: 30, b: 180 }), today);
  assert.deepEqual(r.map((x) => [x.label, x.price, x.boss]), [['App A', 140, false], ['App B', 600, true]]);
  const big = V.priceApps([{ id: 'x', label: 'App X' }], daysOf({ x: 240 }), today); assert.equal(big[0].price, 600);
});
t('minutes use the bucket lower bound and the 7-day average', () => {
  assert.equal(V.bucketMin(44), 30); assert.equal(V.bucketMin(9), 0); assert.equal(V.bucketMin(95), 90);
  const d = daysOf({}); d['2026-11-02'] = { a: 70 }; assert.equal(V.avgUsage(d, 'a', today), 60 / 7);
});
t('order follows each user\u2019s usage, not names', () => {
  const apps = ['App 1', 'App 2', 'App 3', 'App 4'].map((label, i) => ({ id: `id${i}`, label }));
  const u1 = V.priceApps(apps, daysOf({ id0: 120, id1: 10, id2: 60, id3: 30 }), today).map((a) => a.label);
  const u2 = V.priceApps(apps, daysOf({ id0: 10, id1: 120, id2: 30, id3: 60 }), today).map((a) => a.label);
  assert.deepEqual(u1, ['App 2', 'App 4', 'App 3', 'App 1']); assert.deepEqual(u2, ['App 1', 'App 3', 'App 4', 'App 2']);
});
t('tie for heaviest -> first in usage order is the boss', () => { const r = V.priceApps([{ id: 'a', label: 'App A' }, { id: 'b', label: 'App B' }], daysOf({ a: 60, b: 60 }), today);
  assert.equal(r.find((x) => x.boss).label, 'App A'); });
t('no data -> median of the others, or 60 min', () => {
  const r = V.priceApps([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }, { id: 'n', label: 'N' }], daysOf({ a: 10, b: 30, c: 120 }), today);
  assert.equal(r.find((x) => x.id === 'n').price, 140);
  assert.equal(V.priceApps([{ id: 'n', label: 'N' }], {}, today)[0].price, 300); // 60 min -> 200, alone = boss x1.5
});
t('no task gate: points make the next app buyable, cheapest first; copy', () => {
  const apps = [{ id: 'a', label: 'App A' }, { id: 'b', label: 'App B' }, { id: 'c', label: 'App C' }];
  const days = daysOf({ a: 10, b: 60, c: 120 });
  let v = V.vaultView({ apps, days, todayYmd: today, points: 65, accessOpen: true, nowMs: 0 });
  assert.equal(v.openCount, 0, '65 pts is not enough for the cheapest app'); assert.equal(v.items[0].buyable, false);
  v = V.vaultView({ apps, days, todayYmd: today, points: 100, accessOpen: true, nowMs: 0 });
  assert.equal(v.openCount, 0); assert.equal(v.items[0].buyable, true); assert.equal(v.items[1].buyable, false);
  assert.equal(v.text, '🔒 Vault · 0 of 3 open · buy next for 100 pts (~5 tasks)');
  const sale = V.buyApp(v, 'a'); assert.equal(sale.ok, true); assert.equal(V.buyApp(v, 'b').ok, false);
  v = V.vaultView({ apps, days, todayYmd: today, points: 100, bought: sale.bought, accessOpen: true, nowMs: 0 });
  assert.equal(v.openCount, 1); assert.equal(v.items[0].label, 'App A'); assert.equal(v.items[1].open, false);
  assert.equal(v.text, '🔓 Vault · 1 of 3 open · 100 pts to go · next app at 200 pts (~10 tasks)');
  assert.equal(V.costText(200), '200 pts · ~10 tasks'); assert.equal(V.unlockText('App A'), 'Vault unlocked: App A 🎉');
  v = V.vaultView({ apps, days, todayYmd: today, points: 200, debt: true, accessOpen: true, nowMs: 0 }); assert.equal(v.openCount, 0); assert.equal(v.items[0].buyable, false);
});
t('65 pts with a 105 goal buys nothing; 105 buys only the cheapest', () => {
  const apps = [0, 15, 30, 60, 120].map((m) => ({ id: 'm' + m, label: m + ' min' }));
  const days = daysOf({ m0: 0, m15: 15, m30: 30, m60: 60, m120: 120 });
  const prices = (pts) => V.vaultView({ apps, days, todayYmd: today, points: pts, accessOpen: true, nowMs: 0 });
  let v = prices(65);
  assert.deepEqual(v.items.map((a) => a.price), [80, 110, 140, 200, 480]);
  assert.equal(v.items.filter((a) => a.buyable || a.open).length, 0);
  assert.equal(v.text, '🔒 Vault · 0 of 5 open · 15 pts to go · next app at 80 pts (~4 tasks)');
  v = prices(105);
  assert.equal(v.items.filter((a) => a.buyable).map((a) => a.id).join(), 'm0');
  assert.equal(v.openCount, 0);
  v = V.vaultView({ apps, days, todayYmd: today, points: 105, bought: ['m0'], accessOpen: true, nowMs: 0 });
  assert.deepEqual(v.items.filter((a) => a.open).map((a) => a.id), ['m0']);
  assert.equal(v.items.find((a) => a.id === 'm15').buyable, false);
});
t('frozen daily prices win over new usage', () => {
  const apps = [{ id: 'a', label: 'App A' }]; const priced = [{ id: 'a', label: 'App A', price: 50, tasks: 3 }];
  const offered = V.vaultView({ apps, days: daysOf({ a: 240 }), todayYmd: today, priced, points: 50, accessOpen: true, nowMs: 0 });
  assert.equal(offered.openCount, 0); assert.equal(offered.items[0].buyable, true); assert.equal(offered.items[0].price, 50);
  assert.equal(V.vaultView({ apps, days: daysOf({ a: 240 }), todayYmd: today, priced, points: 50, bought: ['a'], accessOpen: true, nowMs: 0 }).openCount, 1);
});
t('one celebration per app per day', () => { const v = { items: [{ id: 'a', open: true }, { id: 'b', open: true }, { id: 'c', open: false }] };
  assert.deepEqual(V.newUnlocks(v, ['a']).map((x) => x.id), ['b']); assert.equal(V.newUnlocks(v, ['a', 'b']).length, 0); });
t('buying one app releases only that app on the shield', () => {
  const apps = [{ id: 'a', label: 'App A' }, { id: 'b', label: 'App B' }];
  let view = V.vaultView({ apps, days: daysOf({ a: 10, b: 60 }), todayYmd: today, points: 400, accessOpen: true, nowMs: 1000 });
  assert.equal(view.items[0].open, false); assert.equal(view.items[0].buyable, true); assert.equal(view.items[1].buyable, false);
  assert.ok(view.items[0].price < view.items[1].price); assert.equal(V.buyApp(view, 'b').ok, false);
  const sale = V.buyApp(view, 'a'); assert.deepEqual(sale.bought, ['a']);
  view = V.vaultView({ apps, days: daysOf({ a: 10, b: 60 }), todayYmd: today, points: 400, bought: sale.bought, accessOpen: true, nowMs: 1000 });
  assert.equal(view.items[0].open, true); assert.equal(view.items[1].open, false);
  const plan = V.releasePlan({ view, already: [], nowMs: 1000, liveUntil: 0 });
  assert.deepEqual(plan.fresh, ['a']); assert.deepEqual(plan.ids, ['a']); assert.ok(plan.untilMs >= 1000 + 120000);
  const shield = V.vaultTimerPlan({ accessOpen: true, view, nativeLive: false, nowMs: 1000, accessUntil: 1000 + 36 * 60000 });
  assert.equal(shield.action, 'allow'); assert.deepEqual(shield.ids, ['a']); assert.equal(shield.untilMs, 1000 + 36 * 60000);
  const extend = V.vaultTimerPlan({ accessOpen: true, view, nativeLive: true, nativeIds: ['a'], nowMs: 1000, liveUntil: 1000 + 5 * 60000, accessUntil: 1000 + 36 * 60000 });
  assert.equal(extend.action, 'allow'); assert.equal(extend.untilMs, 1000 + 36 * 60000);
  assert.equal(V.releasePlan({ view, already: ['a'], nowMs: 1000 }), null);
  assert.equal(V.releasePlan({ view: { ...view, debt: true }, already: [], nowMs: 1000 }), null);
  const held = V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 200, accessOpen: true, nowMs: 1000, wait: { untilMs: 5000, text: 'wait' } });
  assert.equal(held.openCount, 0); assert.equal(held.items[0].buyable, false); assert.equal(V.releasePlan({ view: held, nowMs: 1000 }), null);
});
t('no running timer closes a live vault; a running timer reopens only what was bought', () => {
  const earned = V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 200, accessOpen: true, nowMs: 1000 });
  assert.equal(earned.openCount, 0); assert.equal(earned.items[0].buyable, true);
  assert.equal(V.vaultTimerPlan({ accessOpen: true, view: earned, nativeLive: false, nowMs: 1000 }).action, null);
  const view = V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 200, bought: ['a'], accessOpen: true, windows: [{ startMs: 0, endMs: 5000 }], nowMs: 1000 });
  assert.equal(view.live, true); assert.equal(view.items[0].open, true);
  assert.equal(V.vaultTimerPlan({ accessOpen: false, view, nativeLive: true, nowMs: 1000 }).action, 'close');
  assert.equal(V.vaultAccessOpen({ sessionEnded: true, focusRunning: true }), false);
  assert.equal(V.vaultAccessOpen({ focusPaused: true, sessionRunning: true }), false);
  assert.equal(V.vaultAccessOpen({ sessionRunning: true }), true);
  assert.equal(V.focusTimerRunning([{ timerActive: true, timerEndTime: new Date(5000).toISOString() }], 1000), true);
  assert.equal(V.focusTimerRunning([{ timerActive: true, timerPausedAt: 'x', timerEndTime: new Date(5000).toISOString() }], 1000), false);
  const again = V.vaultTimerPlan({ accessOpen: true, view: { ...view, live: false }, nativeLive: false, nowMs: 1000 });
  assert.equal(again.action, 'allow'); assert.deepEqual(again.ids, ['a']); assert.ok(again.untilMs >= 1000 + 120000);
  const off = V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 200, bought: ['a'], accessOpen: false, nowMs: 1000 });
  assert.equal(off.items[0].open, false); assert.equal(off.items[0].bought, true); assert.equal(off.items[0].buyable, false);
  assert.equal(V.shieldBecauseTimerOff({ enabled: true, selectionCount: 2, sessionEnded: true, now: 1000 }).want, true);
  assert.equal(V.shieldBecauseTimerOff({ enabled: true, selectionCount: 2, sessionEnded: true, goalMet: true, now: 1000 }), null);
});
t('vault rows carry the chosen app icon through frozen prices', () => {
  const priced = [{ id: 'a', label: 'App A', price: 50, tasks: 3, min: 10 }];
  const v = V.vaultView({ apps: [{ id: 'a', label: 'App A', icon: 'data:image/png;base64,abc' }], priced, points: 50, todayYmd: today, nowMs: 0 });
  assert.equal(v.items[0].icon, 'data:image/png;base64,abc'); assert.equal(v.items[0].open, false);
  assert.equal(V.vaultView({ apps: [{ id: 'a', label: 'App A', icon: 'data:image/png;base64,abc' }], priced, points: 50, bought: ['a'], accessOpen: true, todayYmd: today, nowMs: 0 }).items[0].open, true);
});
t('time: 10 pts = 5 min, start plan', () => { assert.equal(V.timeEarnedMin(95), 45);
  const v = V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 200, bought: ['a'], accessOpen: true, nowMs: 1000 });
  assert.deepEqual(V.startPlan(v, 1000).ids, ['a']);
  assert.equal(V.startPlan(V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 200, accessOpen: true, nowMs: 1000 }), 1000), null); });
t('one batched unlock celebration, native first then web fallback', () => {
  const a = [{ id: 'x', label: 'Any App', price: 50 }, { id: 'y', label: 'Other', price: 90 }];
  assert.equal(V.unlockCelebration([]), null); assert.equal(V.unlockCelebration([a[0]]).title, 'Vault unlocked: Any App 🎉');
  const c = V.unlockCelebration(a); assert.equal(c.title, 'Vault unlocked: 2 apps 🎉'); assert.equal(c.sub, '90 pts reached'); assert.deepEqual(c.apps.map((x) => x.label), ['Any App', 'Other']);
  assert.equal(V.webFallback(a, { shown: 0 }).length, 2); assert.equal(V.webFallback(a, null).length, 2);
  assert.deepEqual(V.webFallback(a, { shown: 1, missing: ['y'] }).map((x) => x.id), ['y']); assert.equal(V.webFallback(a, { shown: 2, missing: [] }).length, 0); });
t('native overlay: plugin method registered, real icons via Label(token), no web icon fetch', () => {
  const sw = fs.readFileSync(new URL('../ios/App/App/ClingLockPlugin.swift', import.meta.url), 'utf8');
  assert.ok(/CAPPluginMethod\(name: "celebrateVault"/.test(sw)); assert.ok(/@objc func celebrateVault/.test(sw)); assert.ok(/Label\(a\.token\)\.labelStyle\(\.iconOnly\)/.test(sw));
  assert.ok(/celebrateVault: safe\('ClingLock'/.test(fs.readFileSync(new URL('../src/native/clingNative.js', import.meta.url), 'utf8'))); });
const src = (await import('node:fs')).readFileSync(new URL('../src/utils/pointsVault.js', import.meta.url), 'utf8');
t('no hardcoded app names in the logic', () => { assert.ok(!/pubg|instagram|youtube|tiktok/i.test(src)); });
console.log(`points vault: ${n} passed`);

// Vault pop-out web fallback: main social platforms get brand-colored SVG tiles; unknown apps keep the letter tile.
{
  const { socialIcon } = await import('../src/utils/socialIcons.js');
  for (const l of ['Instagram', 'TikTok', 'X', 'YouTube', 'Facebook', 'twitter']) { const s = socialIcon(l); if (!s || !s.bg || !/<(path|rect|circle)/.test(s.svg)) throw new Error('brand icon ' + l); }
  if (socialIcon('Duolingo') !== null) throw new Error('unknown app should fall back to letter tile');
  console.log('ok   vault pop-out social brand icons');
}
{ // onboarding vault step: typical estimates with no history, weekly text, price explanation, AI prompt
  const { typicalMin } = await import('../src/utils/typicalUsage.js');
  const r = V.priceApps([{ id: 'a', label: 'TikTok' }, { id: 'b', label: 'Instagram' }, { id: 'c', label: 'App' }], {}, '2026-11-03', typicalMin);
  assert.equal(V.priceApps([{ id: 'a', label: 'TikTok' }], {}, '2026-11-03')[0].min, V.NO_DATA_MIN);
  const tk = r.find((x) => x.id === 'a'); assert.equal(tk.min, 90); assert.ok(tk.boss && tk.noData); assert.equal(tk.price, Math.min(600, V.round5(V.priceOf(90) * 1.5)));
  assert.equal(r.find((x) => x.id === 'c').min, V.NO_DATA_MIN);
  assert.match(V.weeklyText(tk), /^~11 h\/week \(estimate, updates after a few days\)$/);
  assert.match(V.priceWhy(r.find((x) => x.id === 'c')), /^Most people spend about 7 hours a week on this app, so/);
  const d = { '2026-11-01': { a: 120, b: 30 }, '2026-11-02': { a: 90, b: 30 } }; const r2 = V.priceApps([{ id: 'a', label: 'TikTok' }, { id: 'b', label: 'Instagram' }], d, '2026-11-03');
  const ig = r2.find((x) => x.id === 'b'); assert.equal(ig.price, 140); assert.equal(V.weeklyText(ig), '~4 h/week'); assert.equal(V.priceWhy(ig), 'You spend about 4 hours a week on Instagram, so it costs 140 points, about 7 tasks.');
  const { createRequire } = await import('node:module'); const { buildRequest } = createRequire(import.meta.url)('../netlify/functions/lib/aiPrompts.js');
  const q = buildRequest('vault_why', { apps: [{ id: 'a', label: 'TikTok', hoursPerWeek: 11, price: 315, tasks: 16, estimate: true, boss: true }] });
  assert.ok(q.body.messages[1].content.includes('"price":315') && /estimate/.test(q.body.messages[0].content));
  assert.throws(() => buildRequest('vault_why', { apps: [] }));
  console.log('ok   onboarding vault step: estimates, weekly text, price why, AI prompt');
}
