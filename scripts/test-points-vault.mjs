import fs from 'node:fs';
// Points vault: formula prices from the user's own usage, ascending unlock order, no task gate. Generic labels only.
import assert from 'node:assert/strict';
import * as V from '../src/utils/pointsVault.js';
import * as S from '../src/utils/usageSnapshot.js';
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };
const today = '2026-11-03'; const week = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
const daysOf = (mins) => Object.fromEntries(week.map((d) => [d, { ...mins }])); // same minutes every day -> avg = bucket
t('sample prices hit round5(30 + 2 × minutes), and a negative reading is not a price', () => {
  for (const [m, p] of [[0, 30], [15, 60], [30, 90], [60, 150], [120, 270]]) assert.equal(V.priceOf(m), p, `${m} min`);
  assert.equal(V.priceOf(-4), null); assert.equal(V.priceOf(Number.NaN), null);
});
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
t('no recorded minutes stay unpriced and do not take the 60-minute or median fill', () => {
  const r = V.priceApps([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }, { id: 'n', label: 'N' }], daysOf({ a: 10, b: 30, c: 120 }), today);
  const n = r.find((x) => x.id === 'n');
  assert.equal(n.awaiting, true); assert.equal(n.price, null); assert.equal(n.boss, false);
  assert.ok(r.filter((x) => !x.awaiting).every((x) => x.price != null));
  const none = V.priceApps([{ id: 'n', label: 'N' }, { id: 'm', label: 'M' }], {}, today);
  assert.ok(none.every((x) => x.awaiting && x.price == null && x.tasks == null));
  const view = V.vaultView({ apps: none.map((x) => ({ id: x.id, label: x.label })), days: {}, todayYmd: today, points: 300, accessOpen: true, nowMs: 0 });
  assert.equal(view.awaiting, 2); assert.equal(view.text, '🔒 Vault · no Screen Time report yet');
  assert.ok(view.items.every((x) => x.buyable === false));
});
t('measured buckets set the ladder; crossing a price does not spend the points', () => {
  const apps = [{ id: 'low', label: 'Low' }, { id: 'mid', label: 'Mid' }, { id: 'high', label: 'High' }, { id: 'none', label: 'None' }];
  const days = daysOf({ low: 15, mid: 30, high: 60 });
  const rows = V.priceApps(apps, days, today);
  assert.deepEqual(rows.map((x) => [x.id, x.price, !!x.boss, !!x.awaiting]), [['low', 60, false, false], ['mid', 90, false, false], ['high', 225, true, false], ['none', null, false, true]]);
  const v = V.vaultView({ apps, days, todayYmd: today, points: 70, accessOpen: true, nowMs: 0 });
  assert.equal(v.points, 70); assert.equal(v.items.find((a) => a.id === 'low').open, true); assert.equal(v.items.find((a) => a.id === 'none').open, false);
  assert.equal(v.items.find((a) => a.id === 'mid').open, false);
  const again = V.vaultView({ apps, days, todayYmd: today, points: v.points, accessOpen: true, nowMs: 0 });
  assert.equal(again.points, 70); assert.equal(again.items.find((a) => a.id === 'low').open, true);
});
t('no task gate: points open every reached app, cheapest first; copy', () => {
  const apps = [{ id: 'a', label: 'App A' }, { id: 'b', label: 'App B' }, { id: 'c', label: 'App C' }];
  const days = daysOf({ a: 10, b: 60, c: 120 });
  let v = V.vaultView({ apps, days, todayYmd: today, points: 40, accessOpen: true, nowMs: 0 });
  assert.equal(v.openCount, 0, '40 pts is not enough for the cheapest app');
  assert.equal(v.text, '🔒 Vault · 0 of 3 open · 10 pts to go · next app at 50 pts (~3 tasks)');
  v = V.vaultView({ apps, days, todayYmd: today, points: 50, accessOpen: true, nowMs: 0 });
  assert.equal(v.openCount, 1); assert.equal(v.items[0].label, 'App A'); assert.equal(v.items[1].open, false);
  assert.equal(v.text, '🔓 Vault · 1 of 3 open · 100 pts to go · next app at 150 pts (~8 tasks)');
  assert.equal(V.costText(150), '150 pts · ~8 tasks'); assert.equal(V.unlockText('App A'), 'Vault unlocked: App A 🎉');
  v = V.vaultView({ apps, days, todayYmd: today, points: 150, accessOpen: true, nowMs: 0 });
  assert.equal(v.openCount, 2); assert.equal(v.items[2].open, false); assert.equal(v.points, 150);
  v = V.vaultView({ apps, days, todayYmd: today, points: 150, debt: true, accessOpen: true, nowMs: 0 }); assert.equal(v.openCount, 0);
});
t('25 pts opens nothing; 35 opens only the cheapest', () => {
  const apps = [0, 15, 30, 60, 120].map((m) => ({ id: 'm' + m, label: m + ' min' }));
  const days = daysOf({ m0: 0, m15: 15, m30: 30, m60: 60, m120: 120 });
  const prices = (pts) => V.vaultView({ apps, days, todayYmd: today, points: pts, accessOpen: true, nowMs: 0 });
  let v = prices(25);
  assert.deepEqual(v.items.map((a) => a.price), [30, 60, 90, 150, 405]);
  assert.equal(v.openCount, 0);
  assert.equal(v.text, '🔒 Vault · 0 of 5 open · 5 pts to go · next app at 30 pts (~2 tasks)');
  v = prices(35);
  assert.deepEqual(v.items.filter((a) => a.open).map((a) => a.id), ['m0']);
  assert.equal(v.items.find((a) => a.id === 'm15').open, false); assert.equal(v.points, 35);
});
t('frozen daily prices win over new usage', () => {
  const apps = [{ id: 'a', label: 'App A' }]; const priced = [{ id: 'a', label: 'App A', price: 50, tasks: 3 }];
  const offered = V.vaultView({ apps, days: daysOf({ a: 240 }), todayYmd: today, priced, points: 50, accessOpen: true, nowMs: 0 });
  assert.equal(offered.openCount, 1); assert.equal(offered.items[0].price, 50); assert.equal(offered.points, 50);
  assert.equal(V.vaultView({ apps, days: daysOf({ a: 240 }), todayYmd: today, priced, points: 40, accessOpen: true, nowMs: 0 }).openCount, 0);
});
t('one celebration per app per day', () => { const v = { items: [{ id: 'a', open: true }, { id: 'b', open: true }, { id: 'c', open: false }] };
  assert.deepEqual(V.newUnlocks(v, ['a']).map((x) => x.id), ['b']); assert.equal(V.newUnlocks(v, ['a', 'b']).length, 0); });
t('points release every app they have reached, and leave the next one shielded', () => {
  const apps = [{ id: 'a', label: 'App A' }, { id: 'b', label: 'App B' }];
  const days = daysOf({ a: 10, b: 60 });
  let view = V.vaultView({ apps, days, todayYmd: today, points: 80, accessOpen: true, nowMs: 1000 });
  assert.equal(view.items[0].open, true); assert.equal(view.items[1].open, false); assert.equal(view.points, 80);
  assert.ok(view.items[0].price < view.items[1].price);
  const plan = V.releasePlan({ view, already: [], nowMs: 1000, liveUntil: 0 });
  assert.deepEqual(plan.fresh, ['a']); assert.deepEqual(plan.ids, ['a']); assert.ok(plan.untilMs >= 1000 + 120000);
  const shield = V.vaultTimerPlan({ accessOpen: true, view, nativeLive: false, nowMs: 1000, accessUntil: 1000 + 36 * 60000 });
  assert.equal(shield.action, 'allow'); assert.deepEqual(shield.ids, ['a']); assert.equal(shield.untilMs, 1000 + 36 * 60000);
  const extend = V.vaultTimerPlan({ accessOpen: true, view, nativeLive: true, nativeIds: ['a'], nowMs: 1000, liveUntil: 1000 + 5 * 60000, accessUntil: 1000 + 36 * 60000 });
  assert.equal(extend.action, 'allow'); assert.equal(extend.untilMs, 1000 + 36 * 60000);
  assert.equal(V.releasePlan({ view, already: ['a'], nowMs: 1000 }), null);
  assert.equal(V.releasePlan({ view: { ...view, debt: true }, already: [], nowMs: 1000 }), null);
  const both = V.vaultView({ apps, days, todayYmd: today, points: 400, accessOpen: true, nowMs: 1000 });
  assert.equal(both.openCount, 2); assert.equal(both.points, 400);
  const held = V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 200, accessOpen: true, nowMs: 1000, wait: { untilMs: 5000, text: 'wait' } });
  assert.equal(held.openCount, 0); assert.equal(V.releasePlan({ view: held, nowMs: 1000 }), null);
});
t('a new lock-in session clears the old list; points still open only the apps they reach', () => {
  const same = V.vaultSessionReset({ sessionKey: '2026-11-05#0:1000', storedKey: '2026-11-05#0:1000', bought: ['a'] });
  assert.equal(same.reset, false); assert.deepEqual(same.bought, ['a']);
  assert.equal(V.vaultSessionReset({ sessionKey: '', storedKey: '2026-11-05#0:1000', bought: ['a'] }).reset, false);
  const next = V.vaultSessionReset({ sessionKey: '2026-11-05#1:9000', storedKey: '2026-11-05#0:1000', bought: ['a', 'b'] });
  assert.equal(next.reset, true); assert.deepEqual(next.bought, []); assert.equal(next.sessionKey, '2026-11-05#1:9000');
  const apps = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
  const view = V.vaultView({ apps, days: daysOf({ a: 10, b: 60 }), todayYmd: today, points: 80, bought: next.bought, accessOpen: true, nowMs: 9000 });
  assert.deepEqual(view.items.filter((a) => a.open).map((a) => a.id), ['a']);
  const shield = V.vaultTimerPlan({ accessOpen: true, view, nativeLive: true, nativeIds: ['a', 'b'], nowMs: 9000 });
  assert.equal(shield.action, 'allow'); assert.deepEqual(shield.ids, ['a']);
  const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  const plug = fs.readFileSync(new URL('../ios/App/App/ClingLockPlugin.swift', import.meta.url), 'utf8');
  assert.match(home, /await relockVaultForSession\(\)/);
  assert.match(home, /vaultSessionReset\(\{ sessionKey: vaultSessionId\(\)/);
  assert.match(plug, /sessionBegin[\s\S]{0,400}VaultAllow\.clearActive\(\)/);
});
t('no running timer closes a live vault; a running timer opens apps the points have reached', () => {
  const low = V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 20, accessOpen: true, nowMs: 1000 });
  assert.equal(low.openCount, 0);
  assert.equal(V.vaultTimerPlan({ accessOpen: true, view: low, nativeLive: false, nowMs: 1000 }).action, null);
  const earned = V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 200, accessOpen: true, nowMs: 1000 });
  assert.equal(earned.openCount, 1); assert.equal(earned.points, 200);
  const view = V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 200, accessOpen: true, windows: [{ startMs: 0, endMs: 5000 }], nowMs: 1000 });
  assert.equal(view.live, true); assert.equal(view.items[0].open, true);
  assert.equal(V.vaultTimerPlan({ accessOpen: false, view, nativeLive: true, nowMs: 1000 }).action, 'close');
  assert.equal(V.vaultAccessOpen({ sessionEnded: true, focusRunning: true }), false);
  assert.equal(V.vaultAccessOpen({ focusPaused: true, sessionRunning: true }), false);
  assert.equal(V.vaultAccessOpen({ sessionRunning: true }), true);
  assert.equal(V.focusTimerRunning([{ timerActive: true, timerEndTime: new Date(5000).toISOString() }], 1000), true);
  assert.equal(V.focusTimerRunning([{ timerActive: true, timerPausedAt: 'x', timerEndTime: new Date(5000).toISOString() }], 1000), false);
  const again = V.vaultTimerPlan({ accessOpen: true, view: { ...view, live: false }, nativeLive: false, nowMs: 1000 });
  assert.equal(again.action, 'allow'); assert.deepEqual(again.ids, ['a']); assert.ok(again.untilMs >= 1000 + 120000);
  const off = V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 200, accessOpen: false, nowMs: 1000 });
  assert.equal(off.items[0].open, false);
  assert.equal(V.shieldBecauseTimerOff({ enabled: true, selectionCount: 2, sessionEnded: true, now: 1000 }).want, true);
  assert.equal(V.shieldBecauseTimerOff({ enabled: true, selectionCount: 2, sessionEnded: true, goalMet: true, now: 1000 }), null);
});
t('vault rows carry the chosen app icon through frozen prices', () => {
  const priced = [{ id: 'a', label: 'App A', price: 50, tasks: 3, min: 10 }];
  const v = V.vaultView({ apps: [{ id: 'a', label: 'App A', icon: 'data:image/png;base64,abc' }], priced, points: 40, todayYmd: today, nowMs: 0 });
  assert.equal(v.items[0].icon, 'data:image/png;base64,abc'); assert.equal(v.items[0].open, false);
  assert.equal(V.vaultView({ apps: [{ id: 'a', label: 'App A', icon: 'data:image/png;base64,abc' }], priced, points: 50, accessOpen: true, todayYmd: today, nowMs: 0 }).items[0].open, true);
});
t('time: 10 pts = 5 min, start plan', () => { assert.equal(V.timeEarnedMin(95), 45);
  const v = V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 200, accessOpen: true, nowMs: 1000 });
  assert.deepEqual(V.startPlan(v, 1000).ids, ['a']);
  assert.equal(V.startPlan(V.vaultView({ apps: [{ id: 'a', label: 'A' }], days: daysOf({ a: 10 }), todayYmd: today, points: 20, accessOpen: true, nowMs: 1000 }), 1000), null); });
t('one batched unlock celebration, native first then web fallback', () => {
  const a = [{ id: 'x', label: 'Any App', price: 50, icon: 'data:image/png;base64,xx' }, { id: 'y', label: 'Other', price: 90 }];
  assert.equal(V.unlockCelebration([]), null); assert.equal(V.unlockCelebration([a[0]]).title, 'Vault unlocked: Any App 🎉');
  const c = V.unlockCelebration(a); assert.equal(c.title, 'Vault unlocked: 2 apps 🎉'); assert.equal(c.sub, '90 pts reached'); assert.equal(c.ms, 1800); assert.equal(c.apps[0].icon, 'data:image/png;base64,xx'); assert.deepEqual(c.apps.map((x) => x.label), ['Any App', 'Other']);
  const items = [{ id: 'a', open: true }, { id: 'b', open: true }, { id: 'c', open: false }];
  assert.deepEqual(V.freshUnlocks(['a'], items, []).map((x) => x.id), ['b']);
  assert.deepEqual(V.freshUnlocks([], items, ['a', 'b']).map((x) => x.id), []);
  assert.equal(V.freshUnlocks(['a', 'b'], items, []).length, 0);
  assert.equal(V.webFallback(a, { shown: 0 }).length, 2); assert.equal(V.webFallback(a, null).length, 2);
  assert.deepEqual(V.webFallback(a, { shown: 1, missing: ['y'] }).map((x) => x.id), ['y']); assert.equal(V.webFallback(a, { shown: 2, missing: [] }).length, 0); });
t('vault entry is a lock mark; app rows keep their own icons', () => {
  const row = fs.readFileSync(new URL('../src/components/home/GamePlanRow.vue', import.meta.url), 'utf8');
  const mark = fs.readFileSync(new URL('../src/components/vault/VaultMark.vue', import.meta.url), 'utf8');
  const apps = fs.readFileSync(new URL('../src/components/vault/VaultApps.vue', import.meta.url), 'utf8');
  assert.match(row, /data-test="vault-toggle"/);
  assert.match(row, /aria-label="vaultOpen \? 'Close the vault' : 'Open the vault'"/);
  assert.match(row, /<VaultMark :open="vaultOpen" \/>/);
  assert.match(row, /data-test="vault-text"/);
  assert.match(mark, /data-test="vault-mark"/);
  assert.match(mark, /<rect /);
  assert.match(mark, /<circle /);
  assert.ok(!/width="1[0-9]{2,}|height="1[0-9]{2,}/.test(mark));
  assert.match(apps, /data-test="vault-shelf"/);
  assert.match(apps, /data-test="vault-app-icon"/);
  assert.match(apps, /data-test="vault-lock"/);
  assert.match(apps, /data-unnamed/);
  assert.match(apps, /prefers-reduced-motion/);
  assert.match(apps, /grid-template-columns: 1fr 1fr/);
  assert.ok(!/VaultMark|vault-mark/.test(apps));
  assert.ok(!/15 min|Unlock for/.test(apps + row));
  assert.ok(!/\b(30|40|50|80) points\b/.test(apps + row));
  const door = fs.readFileSync(new URL('../src/components/vault/VaultDoor.vue', import.meta.url), 'utf8');
  assert.match(row, /data-test="vault-door"/);
  assert.match(row, /data-test="vault-gauge"/);
  assert.match(row, /data-test="vault-points"/);
  assert.match(row, /data-test="vault-earn"/);
  assert.match(row, /Complete tasks\. Earn your access\./);
  assert.match(row, /data-test="vault-break"/);
  assert.match(row, /data-test="vault-next"/);
  assert.match(door, /v-for="n in 8"/);
  assert.match(door, /app-icon-robot\.png/);
  assert.match(door, /prefers-reduced-motion/);
  assert.ok(!/instagram|tiktok|youtube|pubg/i.test(door + mark));
  const pop = fs.readFileSync(new URL('../src/components/home/PointsCelebration.vue', import.meta.url), 'utf8');
  const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  assert.match(pop, /data-test="vault-pop-dismiss"/);
  assert.match(pop, /prefers-reduced-motion/);
  assert.match(pop, />Open</);
  assert.ok(!/15 min/.test(pop));
  assert.match(home, /vaultUnlockArmed/);
  assert.match(home, /freshUnlocks\(/);
  const tabs = fs.readFileSync(new URL('../src/components/shell/AppTabBar.vue', import.meta.url), 'utf8');
  assert.match(tabs, /label: 'Home'/);
  assert.match(tabs, /label: 'Profile'/);
  assert.ok(!/label: 'Vault'/.test(tabs));
});
t('native overlay: plugin method registered, real icons via Label(token), no web icon fetch', () => {
  const sw = fs.readFileSync(new URL('../ios/App/App/ClingLockPlugin.swift', import.meta.url), 'utf8');
  assert.ok(/CAPPluginMethod\(name: "celebrateVault"/.test(sw)); assert.ok(/@objc func celebrateVault/.test(sw)); assert.ok(/Label\(a\.token\)\.labelStyle\(\.iconOnly\)/.test(sw));
  assert.ok(/celebrateVault: safe\('ClingLock'/.test(fs.readFileSync(new URL('../src/native/clingNative.js', import.meta.url), 'utf8'))); });
t('the supplied Screen Time report prices unique selected labels and leaves the rest unpriced', () => {
  const report = S.sentReport('2026-11-06T12:00:00.000Z');
  assert.equal(report.period, null);
  assert.deepEqual(report.rows.map((r) => [r.label, r.minutes]), [
    ['PUBG MOBILE', 1150], ['WhatsApp', 473], ['TikTok', 464], ['YouTube', 411], ['Grok Bot', 380], ['ClingNote', 342],
    ['Maps', 110], ['X', 86], ['Messages', 70], ['Camera', 57], ['Instagram', 54], ['Photos', 47], ['TestFlight', 45], ['ChatGPT', 37],
  ]);
  assert.ok(report.rows.every((r) => r.icon == null));
  assert.match(S.reportNote(report), /the Screen Time report you sent/);
  assert.match(S.reportNote(report), /Saved 2026-11-06/);
  assert.match(S.reportNote(report), /did not show its time period/);
  assert.doesNotMatch(fs.readFileSync(new URL('../src/utils/usageSnapshot.js', import.meta.url), 'utf8'), /firestore|setDoc|netlify|fetch\(/i);
  const apps = [
    { id: 'ig', label: 'Instagram', icon: 'data:image/png;base64,ig' },
    { id: 'yt', label: 'YouTube' },
    { id: 'tt', label: 'TikTok' },
    { id: 'wa', label: 'WhatsApp' },
    { id: 'pg', label: 'PUBG MOBILE' },
    { id: 'fb', label: 'Facebook' },
    { id: 'ph', label: 'App' },
    { id: 'm1', label: 'Messages' },
    { id: 'm2', label: 'Messages' },
  ];
  const days = daysOf({ ig: 240, fb: 60, ph: 60, m1: 60, m2: 60 });
  const rows = V.priceApps(apps, days, today, { report });
  assert.deepEqual(rows.filter((r) => r.price != null).map((r) => [r.id, r.min, r.price, !!r.boss, !!r.exact]), [
    ['ig', 54, 140, false, true], ['yt', 411, 600, false, true], ['tt', 464, 600, false, true], ['wa', 473, 600, false, true], ['pg', 1150, 600, true, true],
  ]);
  for (const id of ['fb', 'ph', 'm1', 'm2']) { const row = rows.find((r) => r.id === id); assert.equal(row.price, null); assert.equal(row.exact, false); assert.equal(row.noReading, true); assert.equal(V.weeklyText(row), 'No reading'); }
  assert.equal(rows.find((r) => r.id === 'ig').thresholdMin, 240);
  assert.equal(rows.find((r) => r.id === 'ig').icon, undefined);
  const pair = V.priceApps([{ id: 'msg', label: 'Messages' }, { id: 'pg2', label: 'PUBG MOBILE' }], {}, today, { report });
  const msg = pair.find((r) => r.id === 'msg');
  assert.equal(msg.min, 70); assert.equal(msg.price, 170); assert.equal(msg.exact, true); assert.equal(msg.boss, false);
  const dupReport = S.sentReport(''); dupReport.rows.push({ label: 'Instagram', minutes: 1 });
  assert.equal(V.priceApps([{ id: 'ig', label: 'Instagram' }], {}, today, { report: dupReport })[0].price, null);
  const v190 = V.vaultView({ apps, days, todayYmd: today, points: 190, report, accessOpen: true, nowMs: 0 });
  assert.equal(v190.points, 190);
  assert.deepEqual(v190.items.filter((a) => a.open).map((a) => a.id), ['ig']);
  assert.equal(v190.items.find((a) => a.id === 'ig').icon, 'data:image/png;base64,ig');
  assert.match(v190.reportNote, /the Screen Time report you sent/);
  const v600 = V.vaultView({ apps, days, todayYmd: today, points: 600, report, accessOpen: true, nowMs: 0 });
  assert.deepEqual(v600.items.filter((a) => a.open).map((a) => a.id), ['ig', 'yt', 'tt', 'wa', 'pg']);
  assert.equal(v600.points, 600);
  assert.equal(v600.items.find((a) => a.id === 'fb').open, false);
  const mem = { bag: new Map(), getItem(k) { return this.bag.has(k) ? this.bag.get(k) : null; }, setItem(k, v) { this.bag.set(k, v); } };
  const saved = S.adoptSentReport(mem, '2026-11-06T12:00:00.000Z');
  assert.equal(saved.rows.length, 14);
  assert.equal(S.adoptSentReport(mem, '2099-01-01T00:00:00.000Z').adoptedAt, '2026-11-06T12:00:00.000Z');
  const replaced = S.replaceSnapshot(mem, [{ label: 'Instagram', minutes: 54 }, { label: 'App', minutes: 60 }], '2026-11-06T13:00:00.000Z');
  assert.deepEqual(replaced.rows, [{ label: 'Instagram', minutes: 54 }]);
});
t('the real report prices observed minutes from least used up to PUBG, and an unknown app has no reading', () => {
  const report = S.sentReport('2026-11-06T12:00:00.000Z');
  assert.equal(report.period, null);
  const apps = report.rows.map((r) => ({ id: r.label, label: r.label })).concat([{ id: 'fb', label: 'Facebook' }]);
  const rows = V.priceApps(apps, {}, today, { report });
  assert.deepEqual(rows.filter((r) => r.price != null).map((r) => [r.label, r.min, r.price]), [
    ['ChatGPT', 37, 105], ['TestFlight', 45, 120], ['Photos', 47, 125], ['Instagram', 54, 140], ['Camera', 57, 145],
    ['Messages', 70, 170], ['X', 86, 200], ['Maps', 110, 250], ['ClingNote', 342, 600], ['Grok Bot', 380, 600],
    ['YouTube', 411, 600], ['TikTok', 464, 600], ['WhatsApp', 473, 600], ['PUBG MOBILE', 1150, 600],
  ]);
  assert.equal(rows[0].label, 'ChatGPT'); assert.equal(rows[rows.length - 2].label, 'PUBG MOBILE'); assert.equal(rows.at(-2).boss, true);
  const fb = rows.find((r) => r.id === 'fb');
  assert.equal(fb.noReading, true); assert.equal(fb.price, null); assert.equal(V.weeklyText(fb), 'No reading');
  assert.match(V.priceWhy(rows.find((r) => r.label === 'ChatGPT')), /37m/);
  assert.match(V.priceWhy(rows.find((r) => r.label === 'ChatGPT')), /not a daily average/);
  const text = S.formatOwnerReport(report);
  assert.match(text, /^ChatGPT 37m\n/); assert.match(text, /PUBG MOBILE 19h 10m$/);
  const parsed = S.parseOwnerReport(text);
  assert.equal(parsed.ok, true); assert.equal(parsed.period, null); assert.equal(parsed.rows.length, 14);
  assert.equal(parsed.rows.find((r) => r.label === 'PUBG MOBILE').minutes, 1150);
  assert.equal(parsed.rows.find((r) => r.label === 'WhatsApp').minutes, 473);
  assert.equal(parsed.rows.find((r) => r.label === 'Maps').minutes, 110);
  const withDays = S.parseOwnerReport(`period: 7 days\n${text}`);
  assert.equal(withDays.period.days, 7);
  const divided = V.priceApps([{ id: 'cg', label: 'ChatGPT' }, { id: 'pg', label: 'PUBG MOBILE' }], {}, today, { report: { ...report, period: withDays.period, rows: report.rows } });
  assert.equal(divided.find((r) => r.id === 'cg').min, 37); assert.equal(divided.find((r) => r.id === 'cg').price, 40);
  assert.equal(divided.find((r) => r.id === 'pg').min, 1150);
  assert.equal(S.parseOwnerReport('Facebook\nNope -5').ok, false);
  const none = V.priceApps([{ id: 'fb', label: 'Facebook' }, { id: 'ig', label: 'Instagram' }], daysOf({ fb: 60, ig: 60 }), today);
  assert.ok(none.every((r) => r.price != null && r.noReading === false));
  const missing = V.vaultView({ apps: [{ id: 'fb', label: 'Facebook' }], days: {}, todayYmd: today, points: 400, accessOpen: true, nowMs: 0 });
  assert.equal(missing.items[0].price, null); assert.equal(missing.reportNote, '');
  const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  const swift = fs.readFileSync(new URL('../ios/App/App/ClingLockPlugin.swift', import.meta.url), 'utf8');
  assert.match(home, /parseOwnerReport/); assert.match(home, /saveVaultReport/);
  assert.match(swift, /vault\.report\.v1/); assert.match(swift, /func saveVaultReport/); assert.match(swift, /func readVaultReport/);
  const save = swift.slice(swift.indexOf('func saveVaultReport'), swift.indexOf('func startUsage'));
  assert.doesNotMatch(save, /UsageLog\.record|forKey: "usage\.daily\.v1"/);
  assert.match(swift.slice(swift.indexOf('func startUsage'), swift.indexOf('func vaultUsage')), /UsageLog\.ensure/);
});
t('today\'s requirement caps 600 and keeps no-reading cards in a stable order', () => {
  const report = S.sentReport('');
  const apps = [
    { id: 'ig', label: 'Instagram' }, { id: 'yt', label: 'YouTube' }, { id: 'tt', label: 'TikTok' },
    { id: 'fb', label: 'Facebook' }, { id: 'pg', label: 'PUBG MOBILE' },
    { id: 'tok-b', label: 'App' }, { id: 'tok-a', label: 'App' },
  ];
  const shuffled = [apps[6], apps[5], apps[4], apps[3], apps[2], apps[1], apps[0]];
  const priced = (list, cap) => V.priceApps(list, {}, today, { report, priceCap: cap });
  const a = priced(apps, 165); const b = priced(shuffled, 165);
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id));
  assert.equal(a.find((x) => x.id === 'ig').price, 140);
  assert.equal(a.find((x) => x.id === 'yt').price, 165);
  assert.equal(a.find((x) => x.id === 'tt').price, 165);
  assert.equal(a.find((x) => x.id === 'pg').price, 165);
  assert.equal(a.find((x) => x.id === 'fb').price, null);
  assert.equal(a.find((x) => x.id === 'fb').noReading, true);
  assert.equal(a.find((x) => x.id === 'tok-a').price, null);
  assert.equal(a.find((x) => x.id === 'tok-b').noReading, true);
  assert.ok(a.findIndex((x) => x.id === 'tok-a') < a.findIndex((x) => x.id === 'tok-b'));
  const open = a.filter((x) => x.price != null);
  assert.equal(open[open.length - 1].id, 'pg');
  assert.equal(open[open.length - 1].boss, true);
  const view = V.vaultView({ apps, days: {}, todayYmd: today, points: 165, report, priceCap: 165, accessOpen: true, nowMs: 0 });
  assert.equal(view.items.find((x) => x.id === 'yt').price, 165);
  assert.equal(view.items.find((x) => x.id === 'yt').open, true);
  assert.equal(view.items.find((x) => x.id === 'ig').open, true);
  assert.equal(view.items.find((x) => x.id === 'fb').open, false);
  const at200 = priced(apps, 200);
  assert.equal(at200.find((x) => x.id === 'ig').price, 140);
  assert.equal(at200.find((x) => x.id === 'yt').price, 200);
  const threshold = V.priceApps([{ id: 'a', label: 'A' }], daysOf({ a: 240 }), today, { priceCap: 165 });
  assert.ok(threshold[0].price <= 165);
  const uncapped = V.vaultView({ apps: [{ id: 'yt', label: 'YouTube' }], priced: [{ id: 'yt', label: 'YouTube', price: 600, min: 411 }], points: 165, priceCap: 165, accessOpen: true, todayYmd: today, nowMs: 0 });
  assert.equal(uncapped.items[0].price, 165);
  assert.equal(uncapped.items[0].open, true);
  const appsVue = fs.readFileSync(new URL('../src/components/vault/VaultApps.vue', import.meta.url), 'utf8');
  assert.match(appsVue, /:key="a.id"/);
  assert.doesNotMatch(appsVue, /a\.id \+ \(a\.open/);
  const swift = fs.readFileSync(new URL('../ios/App/Shared/LockShared.swift', import.meta.url), 'utf8');
  assert.match(swift, /next\.sort \{ \$0\.id < \$1\.id \}/);
});
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
{ // onboarding vault step: no history is unpriced; recorded days still explain the price
  const r = V.priceApps([{ id: 'a', label: 'TikTok' }, { id: 'b', label: 'Instagram' }, { id: 'c', label: 'App' }], {}, '2026-11-03');
  assert.ok(r.every((x) => x.awaiting && x.price == null));
  assert.equal(V.weeklyText(r[0]), 'No Screen Time report yet');
  assert.match(V.priceWhy(r.find((x) => x.id === 'c')), /^Waiting for this app's Screen Time/);
  const d = { '2026-11-01': { a: 120, b: 30 }, '2026-11-02': { a: 90, b: 30 } }; const r2 = V.priceApps([{ id: 'a', label: 'TikTok' }, { id: 'b', label: 'Instagram' }], d, '2026-11-03');
  const ig = r2.find((x) => x.id === 'b'); assert.equal(ig.price, 90); assert.equal(V.weeklyText(ig), '~4 h/week (threshold, not exact)'); assert.match(V.priceWhy(ig), /^Recorded thresholds average about 4 hours a week on Instagram, so it costs 90 points, about 5 tasks\./);
  const { createRequire } = await import('node:module'); const { buildRequest } = createRequire(import.meta.url)('../netlify/functions/lib/aiPrompts.js');
  const q = buildRequest('vault_why', { apps: [{ id: 'a', label: 'TikTok', hoursPerWeek: 11, price: 315, tasks: 16, estimate: true, boss: true }] });
  assert.ok(q.body.messages[1].content.includes('"price":315') && /estimate/.test(q.body.messages[0].content));
  assert.throws(() => buildRequest('vault_why', { apps: [] }));
  console.log('ok   onboarding vault step: estimates, weekly text, price why, AI prompt');
}
