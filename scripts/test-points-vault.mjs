// Points vault (src/utils/pointsVault.js) + the lock fixes on feat/points-vault: 1-week DeviceActivity cap chain (nativeSegment /
// ScheduleChain), turn_off blocked while a missed-goal lock is unpaid, sessionGoal met = target > 0, progressOf by lock.ids.
// Pure + source checks (Swift is not compiled here; device test still needed). ZZTEST data only.
import assert from 'assert'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.join(here, '..'); const req = createRequire(import.meta.url);
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const core = req(path.join(root, 'netlify/functions/lib/eightHourCore.js'));
const V = await import(path.join(root, 'src/utils/pointsVault.js'));
const SG = await import(path.join(root, 'src/utils/sessionGoal.js'));
const D = await import(path.join(root, 'src/utils/appLockDebt.js'));
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; }; const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); pass++; };
const H = 3600000, DAY = 24 * H, MIN = 60000; const now = Date.parse('2026-11-03T15:00:00Z');

// ── A1: 1-week cap chain ──
eq(core.NATIVE_SPAN_MAX_MS, 6.5 * DAY, 'segment cap 6.5 days');
let seg = core.nativeSegment(now - H, now + 14 * DAY, now);
ok(seg.endMs - seg.startMs <= 7 * DAY - H && seg.endMs - seg.startMs >= 15 * MIN, '14-day hold: first segment under a week');
eq(seg.startMs, now - MIN, 'start backdated one minute (past start fires intervalDidStart now)'); ok(!seg.last, 'not the last segment');
let t = now, segs = 0, until = now + 14 * DAY; for (; segs < 10; segs++) { const s = core.nativeSegment(now - H, until, t); if (!s) break; ok(s.endMs - s.startMs <= core.NATIVE_SPAN_MAX_MS, 'each segment <= 6.5d'); if (s.last) { segs++; break; } t = s.endMs; }
eq(segs, 3, '14 days = 3 chained segments ending exactly at the real end');
seg = core.nativeSegment(now + 2 * H, now + 10 * H, now); eq(seg, { startMs: now + 2 * H, endMs: now + 10 * H, last: true }, 'future short hold unchanged');
seg = core.nativeSegment(now - H, now + 5 * MIN, now); eq(seg.endMs - seg.startMs, 15 * MIN, '< 15 min left: window (until-15m .. until)');
eq(core.nativeSegment(0, now + 30000, now), null, 'under a minute left: nothing to arm');
const shared = src('ios/App/Shared/LockShared.swift'), plugin = src('ios/App/App/ClingLockPlugin.swift'), mon = src('ios/App/ClingLockMonitor/ClingLockMonitor.swift');
ok(/maxSpanMs: Double = 6\.5 \* 24 \* 3600 \* 1000/.test(shared), 'Swift ScheduleChain uses the same 6.5-day cap');
const arm = plugin.slice(plugin.indexOf('func armDebtHold'), plugin.indexOf('func clearDebtHold'));
ok(!/DebtHold\.clear\(\)/.test(arm) && /armSegment/.test(arm), 'armDebtHold: segmented, a failed arm never clears the hold');
ok(/applyShield\(\)[\s\S]*if let err = err/.test(arm), 'armDebtHold: shield raised for a started hold even when arming failed');
const sl = plugin.slice(plugin.indexOf('func startLock'), plugin.indexOf('func stopLock'));
ok(/ScheduleChain\.segment/.test(sl) && /keepShieldIfHeld[\s\S]*clearShield/.test(sl), 'startLock: segmented; on failure keeps the shield while a debt holds');
ok(/DebtHold\.segEnd\(\)/.test(mon) && /armSegment/.test(mon), 'monitor re-arms the debt chain at a segment end');
ok(/ScheduleChain\.lockSegKey/.test(mon), 'monitor re-arms the lock-in chain at a segment end');

// ── A2: turn_off blocked by an unpaid debt ──
const debt = { sessionKey: '2026-11-02#0', sinceMs: now - 3 * H, target: 60, earned: 20 };
ok(D.turnOffBlocked({ debt, now }), 'active debt blocks turning the lock off');
ok(!D.turnOffBlocked({ debt: null, now }), 'no debt: turn off allowed');
ok(!D.turnOffBlocked({ debt, now: now + 15 * DAY }), 'past the safety cap: allowed');
ok(!D.turnOffBlocked({ debt, now, live: { startMs: now - H, endMs: now + H, target: 40, earned: 40 } }), 'a later session that hit its goal pays it');
ok(D.turnOffBlocked({ debt, now, live: { startMs: now - H, endMs: now + H, target: 0, earned: 0 } }), 'a goal-less session does not pay it');
ok(/action === 'turn_off'\) \{ if \(turnOffBlocked/.test(src('src/views/HomeView.vue')), 'assistant turn_off checks the debt first');

// ── A3: sessionGoal met needs a goal ──
eq(SG.sessionGoal([], { n: 1, sessions: 1, endMs: now }).met, false, 'no tasks = no goal = not met');
eq(SG.sessionGoal([{ title: 'ZZTEST a', size: 's', completed: true, completedAt: now - MIN }], { n: 1, sessions: 1, endMs: now }).met, true, 'goal reached = met');
eq(SG.sessionGoal([{ title: 'ZZTEST a', size: 's' }], { n: 1, sessions: 1, endMs: now }).met, false, 'goal open = not met');

// ── A4: progressOf matches lock.ids ──
const dayKey = '2026-11-03'; const tk = (id, title, done) => ({ id, title: 'ZZTEST ' + title, completed: done, createdAt: 'zz-' + id });
const tasks0 = [tk('a', 'A', false), tk('b', 'B', true), tk('c', 'C', false)];
const lock = { dayKey, ids: ['id:a', 'id:b', 'id:c'], points: [10, 20, 40] };
eq(core.progressOf(lock, tasks0).earned, 20, 'ids: B done = 20');
eq(core.progressOf(lock, [tk('x', 'new', false), tasks0[2], tasks0[1], tasks0[0]]).earned, 20, 'reordered / inserted task does not shift points');
eq(core.progressOf({ dayKey, points: [10, 20, 40] }, tasks0).earned, 20, 'old lock without ids: position fallback');

// ── B: vault ──
const apps = [{ id: 'p', label: 'PUBG' }, { id: 'i', label: 'Instagram' }, { id: 'y', label: 'YouTube' }, { id: 'n', label: 'News' }, { id: 'r', label: 'Reddit' }, { id: 'q', label: 'NoData' }];
const days = {}; for (let i = 1; i <= 7; i++) days[`2026-10-${String(26 + i).padStart(2, '0')}`.replace('2026-10-32', '2026-11-01').replace('2026-10-33', '2026-11-02')] = { p: 240, i: 60, y: 30, r: 15 };
days['2026-11-01'].n = 15; days['2026-11-03'] = { n: 240 }; // today never counts toward the average
eq(V.avgUsage(days, 'p', '2026-11-03'), 240, 'avg over observed days'); eq(V.avgUsage(days, 'n', '2026-11-03'), 15 / 7, 'absent on other observed days = 0'); eq(V.avgUsage(days, 'q', '2026-11-03'), null, 'never seen = no data'); eq(V.avgUsage({}, 'n', '2026-11-03'), null, 'no data = null');
const priced = V.priceApps(apps, days, '2026-11-03');
eq(priced[0].label, 'News', 'least used first'); eq(priced[0].price, 30, 'least used is cheapest');
eq(priced.map((a) => a.label).slice(-2), ['PUBG', 'NoData'], 'heaviest and no-data apps last'); eq(priced[priced.length - 1].price, 220, 'last = top price');
ok(priced.every((a, i) => !i || a.price >= priced[i - 1].price), 'prices never drop along the list');
ok(V.priceApps([{ id: 'z', label: 'Z' }], {}, '2026-11-03')[0].price === 220, 'single app without data priced heavy');
eq(V.timeEarnedMin(95), 45, '95 pts = 9 x 5 min'); eq(V.timeEarnedMin(9), 0, 'under 10 pts = 0');
let v = V.vaultView({ apps, days, todayYmd: '2026-11-03', points: 80, tasksDone: 1, nowMs: now });
ok(!v.gate.met && v.openCount === 0 && /finish 2 more tasks/.test(v.text), 'gate: < 3 tasks keeps it shut'); eq(V.gateLine(v.gate), 'Finish 2 more tasks to open the vault.', 'gate line');
v = V.vaultView({ apps, days, todayYmd: '2026-11-03', points: 80, tasksDone: 3, nowMs: now });
eq(v.openCount, 2, '80 pts opens the 30 and 60 apps'); eq(v.text, '🔓 Vault · 2 of 6 open · next at 100 pts', 'row text'); eq(v.leftMin, 40, '80 pts = 40 min');
ok(v.canStart, 'can start app time');
v = V.vaultView({ apps, days, todayYmd: '2026-11-03', points: 80, tasksDone: 3, debt: true, nowMs: now });
ok(v.openCount === 0 && !v.canStart && /closed until a session/.test(v.text), 'debt: no vault');
const plan = V.startPlan(V.vaultView({ apps, days, todayYmd: '2026-11-03', points: 80, tasksDone: 3, nowMs: now }), now);
eq(plan.ids.sort(), ['n', 'r'], 'start plan opens the open apps'); eq(plan.untilMs, now + 40 * MIN, 'window = time left');
let w = [{ startMs: now, endMs: now + 40 * MIN }];
v = V.vaultView({ apps, days, todayYmd: '2026-11-03', points: 80, tasksDone: 3, windows: w, nowMs: now + 10 * MIN });
ok(v.live && v.liveLeftMin === 30 && /30 min left/.test(v.text) && !v.canStart, 'running: minutes left on the line');
eq(v.points, 80, 'spending time never reduces points'); eq(v.openCount, 2, '...or what is open');
w = V.stopWindows(w, now + 10 * MIN); v = V.vaultView({ apps, days, todayYmd: '2026-11-03', points: 80, tasksDone: 3, windows: w, nowMs: now + 20 * MIN });
eq(v.leftMin, 30, 'stop early keeps the rest'); ok(!v.live, 'stopped');
v = V.vaultView({ apps, days, todayYmd: '2026-11-03', points: 250, tasksDone: 4, nowMs: now }); eq(v.text, '🔓 Vault · 6 of 6 open · all open', 'all open');
ok(/VaultAllow\.allowed/.test(shared) && /DebtHold\.isActive/.test(shared.slice(shared.indexOf('enum VaultAllow'))), 'native: vault subtracted from shields, never during a debt');
ok(/clingVault/.test(mon) && /eventDidReachThreshold/.test(mon), 'monitor re-shields at vault end and records usage thresholds');
eq(V.USAGE_THRESHOLDS, [15, 30, 60, 120, 240], 'usage thresholds'); ok(/thresholds = \[15, 30, 60, 120, 240\]/.test(shared), 'Swift thresholds match');
ok((src('src/components/home/GamePlanRow.vue').match(/data-test="vault-toggle"/g) || []).length === 1, 'one slim vault line in the game plan row');
console.log(`points vault + lock fixes: ${pass} checks passed`);
