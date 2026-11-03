import fs from 'node:fs';
// Points vault: formula prices from the user's own usage, ascending unlock order, no task gate. Generic labels only.
import assert from 'node:assert/strict';
import * as V from '../src/utils/pointsVault.js';
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };
const today = '2026-11-03'; const week = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
const daysOf = (mins) => Object.fromEntries(week.map((d) => [d, { ...mins }])); // same minutes every day -> avg = bucket
t('sample prices hit the formula', () => { for (const [m, p] of [[10, 50], [30, 90], [60, 150], [90, 210], [120, 270]]) assert.equal(V.priceOf(m), p, `${m} min`); });
t('boss = heaviest, round5(x1.5), capped 600', () => {
  const r = V.priceApps([{ id: 'a', label: 'App A' }, { id: 'b', label: 'App B' }], daysOf({ a: 30, b: 180 }), today);
  assert.deepEqual(r.map((x) => [x.label, x.price, x.boss]), [['App A', 90, false], ['App B', 585, true]]);
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
  assert.equal(r.find((x) => x.id === 'n').price, 90);
  assert.equal(V.priceApps([{ id: 'n', label: 'N' }], {}, today)[0].price, 225); // 60 min -> 150, alone = boss x1.5
});
t('no task gate: points alone open apps in ascending order; copy', () => {
  const apps = [{ id: 'a', label: 'App A' }, { id: 'b', label: 'App B' }, { id: 'c', label: 'App C' }];
  const days = daysOf({ a: 10, b: 60, c: 120 });
  let v = V.vaultView({ apps, days, todayYmd: today, points: 60, nowMs: 0 });
  assert.equal(v.openCount, 1); assert.equal(v.items[0].label, 'App A'); assert.equal(v.text, '🔓 Vault · 1 of 3 open · next app at 150 pts (~8 tasks)');
  assert.equal(V.costText(150), '150 pts · ~8 tasks'); assert.equal(V.unlockText('App A'), 'Vault unlocked: App A 🎉');
  v = V.vaultView({ apps, days, todayYmd: today, points: 150, debt: true, nowMs: 0 }); assert.equal(v.openCount, 0);
});
t('frozen daily prices win over new usage', () => {
  const apps = [{ id: 'a', label: 'App A' }]; const priced = [{ id: 'a', label: 'App A', price: 50, tasks: 3 }];
  assert.equal(V.vaultView({ apps, days: daysOf({ a: 240 }), todayYmd: today, priced, points: 50, nowMs: 0 }).openCount, 1);
});
t('one celebration per app per day', () => { const v = { items: [{ id: 'a', open: true }, { id: 'b', open: true }, { id: 'c', open: false }] };
  assert.deepEqual(V.newUnlocks(v, ['a']).map((x) => x.id), ['b']); assert.equal(V.newUnlocks(v, ['a', 'b']).length, 0); });
t('time: 10 pts = 5 min, start plan', () => { assert.equal(V.timeEarnedMin(95), 45);
  const v = V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 100, nowMs: 1000 });
  assert.deepEqual(V.startPlan(v, 1000).ids, ['a']); });
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
