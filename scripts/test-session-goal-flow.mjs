// Session goal releases every vault app. The end prompt, a manual end, the timer handoff,
// same-day completions, and the day reset are pure rules the home screen follows.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as V from '../src/utils/pointsVault.js';
import { sentReport } from '../src/utils/usageSnapshot.js';
import { endPrompt, promptChoice, manualEndAllowed, timerExpiry, sameDayHandoff, dayRolloverReset } from '../src/utils/sessionFlow.js';

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };
const mem = () => ({ bag: new Map(), getItem(k) { return this.bag.has(k) ? this.bag.get(k) : null; }, setItem(k, v) { this.bag.set(k, v); } });
const today = '2026-11-11';
const report = sentReport('2026-11-06T12:00:00.000Z');
const apps = [
  { id: 'ig', label: 'Instagram' }, { id: 'yt', label: 'YouTube' }, { id: 'tt', label: 'TikTok' },
  { id: 'fb', label: 'Facebook' }, { id: 'pg', label: 'PUBG MOBILE' }, { id: 'x', label: 'X' },
];

t('session goal opens every app, including a higher price and no Screen Time reading', () => {
  const hit = V.vaultView({ apps, days: {}, todayYmd: today, points: 190, report, priceCap: 190, accessOpen: true, nowMs: 1000 });
  assert.equal(hit.goalMet, true);
  assert.equal(hit.items.every((a) => a.open), true);
  assert.equal(hit.items.find((a) => a.id === 'fb').noReading, true);
  assert.equal(hit.items.find((a) => a.id === 'fb').open, true);
  assert.ok(hit.items.find((a) => a.id === 'yt').min > 190);
  assert.equal(hit.items.find((a) => a.id === 'yt').open, true);
  assert.match(hit.text, /all open/);
  const plan = V.vaultTimerPlan({ accessOpen: true, view: hit, nativeLive: false, nowMs: 1000, accessUntil: V.releaseUntilMs(1000, true) });
  assert.equal(plan.action, 'allow');
  for (const id of ['fb', 'yt', 'x', 'pg']) assert.ok(plan.ids.includes(id), id);
  const until = V.releaseUntilMs(new Date(2026, 10, 11, 19, 24).getTime(), true);
  assert.equal(until, new Date(2026, 10, 12).getTime());
});

t('below the session goal, only a reached price opens', () => {
  const low = V.vaultView({ apps, days: {}, todayYmd: today, points: 189, report, priceCap: 190, accessOpen: true, nowMs: 1000 });
  assert.equal(low.goalMet, false);
  assert.equal(low.items.every((a) => a.open), false);
  assert.equal(low.items.find((a) => a.id === 'ig').open, true);
  assert.equal(low.items.find((a) => a.id === 'yt').open, false);
  assert.equal(low.items.find((a) => a.id === 'fb').open, false);
  assert.equal(low.items.find((a) => a.id === 'x').open, false);
  const none = V.vaultView({ apps, days: {}, todayYmd: today, points: 600, report, accessOpen: true, nowMs: 1000 });
  assert.equal(none.goalMet, false, 'no session goal does not release unread apps');
  assert.equal(none.items.find((a) => a.id === 'fb').open, false);
});

t('goal reached shows the end-or-continue prompt; keep leaves it running; end is always available', () => {
  const ask = endPrompt({ met: true, running: true, sessionKey: '2026-11-11#0:1', choice: '' });
  assert.equal(ask.show, true);
  assert.equal(ask.canEnd, true);
  assert.equal(endPrompt({ met: false, running: true, sessionKey: 'k' }).show, false);
  assert.equal(endPrompt({ met: true, running: false, sessionKey: 'k' }).show, false);
  const kept = endPrompt({ met: true, running: true, sessionKey: 'k', choice: 'keep' });
  assert.equal(kept.show, false);
  assert.equal(kept.canEnd, true);
  assert.deepEqual(promptChoice('keep'), { endNow: false, keepRunning: true });
  assert.deepEqual(promptChoice('end'), { endNow: true, keepRunning: false });
  assert.equal(manualEndAllowed({ running: true }), true);
  assert.equal(manualEndAllowed({ running: false }), false);
  assert.equal(endPrompt({ met: false, running: true, sessionKey: 'k' }).canEnd, true);
});

t('the timer ending does not start the next session; the user may tap Start once the wait allows it', () => {
  const running = timerExpiry({ now: 1000, endMs: 5000, running: true, canStart: true, sessionKey: 's', skipKey: '' });
  assert.equal(running.ended, false);
  assert.equal(running.startNext, false);
  assert.equal(running.userStart, false);
  const due = timerExpiry({ now: 5000, endMs: 5000, running: false, canStart: true, sessionKey: 's', skipKey: '' });
  assert.equal(due.ended, true);
  assert.equal(due.startNext, false);
  assert.equal(due.userStart, true);
  assert.equal(due.reason, 'timer');
  const endedByHand = timerExpiry({ now: 5000, endMs: 5000, running: false, canStart: true, sessionKey: 's', skipKey: 's' });
  assert.equal(endedByHand.startNext, false);
  assert.equal(endedByHand.userStart, false);
  assert.equal(endedByHand.reason, 'manual');
  const wait = timerExpiry({ now: 5000, endMs: 5000, running: false, canStart: false, cooldownUntil: 9000, sessionKey: 's' });
  assert.equal(wait.startNext, false);
  assert.equal(wait.userStart, false);
  assert.equal(wait.reason, 'cooldown');
  assert.equal(wait.waitUntil, 9000);
  const after = timerExpiry({ now: 9000, endMs: 5000, running: false, canStart: true, cooldownUntil: 9000, sessionKey: 's' });
  assert.equal(after.startNext, false);
  assert.equal(after.userStart, true);
});

t('completed tasks stay complete on the next session of the same day', () => {
  const tasks = [
    { id: 'a', title: 'Write', type: 'one-time', completed: true, completedAt: '2026-11-11T15:00:00' },
    { id: 'b', title: 'Call', type: 'recurring', completed: true, completedAt: '2026-11-11T16:00:00' },
    { id: 'c', title: 'Later', completed: false },
  ];
  const hand = sameDayHandoff(mem(), {
    tasks,
    fromLock: { dayKey: '2026-11-11', index: 0, startMs: 1000 },
    toLock: { dayKey: '2026-11-11', index: 1, startMs: 9000 },
    dayPoints: 190,
    nextTarget: 40,
  });
  assert.deepEqual(hand.stillComplete, ['Write', 'Call']);
  assert.equal(tasks[0].completed, true);
  assert.equal(tasks[1].completed, true);
  assert.equal(hand.sessionPoints, 0);
  assert.equal(hand.unlocked, false);
  const src = fs.readFileSync(new URL('../netlify/functions/eight-hour-day.js', import.meta.url), 'utf8');
  assert.match(src, /if \(later\) rows = rows\.filter\(\(\{ t \}\) => !t\.completed\)/);
  assert.match(src, /const clear = !later && staleRecurring/);
});

t('a new day zeros points, resets completions and locks, and asks for a fresh session', () => {
  const tasks = [
    { type: 'one-time', title: 'once', completed: true, completedAt: new Date(2026, 10, 5, 10).toISOString() },
    { type: 'recurring', title: 'rec', completed: true, completedAt: new Date(2026, 10, 5, 9).toISOString() },
    { type: 'recurring', title: 'open', completed: false },
  ];
  const same = dayRolloverReset(tasks, 4, new Date(2026, 10, 12, 0, 5), '2026-11-12', '2026-11-12');
  assert.equal(same.rolled, false);
  assert.equal(same.tasks.length, 3);
  assert.equal(same.tasks[1].completed, true);
  const next = dayRolloverReset(tasks, 4, new Date(2026, 10, 12, 0, 5), '2026-11-11', '2026-11-12');
  assert.equal(next.rolled, true);
  assert.equal(next.points, 0);
  assert.equal(next.locksReset, true);
  assert.equal(next.startFresh, true);
  assert.deepEqual(next.tasks.map((t) => t.title), ['rec', 'open']);
  assert.equal(next.tasks[0].completed, false);
  assert.equal(next.tasks[0].completedAt, null);
  assert.equal(tasks[1].completed, true, 'the stored list is copied, not mutated');
});

t('home, native shield, and the end action are wired', () => {
  const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  const plug = fs.readFileSync(new URL('../ios/App/App/ClingLockPlugin.swift', import.meta.url), 'utf8');
  const shared = fs.readFileSync(new URL('../ios/App/Shared/LockShared.swift', import.meta.url), 'utf8');
  const monitor = fs.readFileSync(new URL('../ios/App/ClingLockMonitor/ClingLockMonitor.swift', import.meta.url), 'utf8');
  const fn = fs.readFileSync(new URL('../netlify/functions/eight-hour-day.js', import.meta.url), 'utf8');
  const prompt = fs.readFileSync(new URL('../src/components/home/SessionEndPrompt.vue', import.meta.url), 'utf8');
  assert.match(home, /persistGoalRelease/);
  assert.match(home, /markGoalRelease/);
  assert.match(home, /SessionEndPrompt/);
  assert.match(home, /endSessionManual/);
  assert.match(home, /keepSessionGoing/);
  assert.match(home, /maybeAutoNext/);
  assert.match(home, /applyDayRollover/);
  const autoNext = home.slice(home.indexOf('const maybeAutoNext'), home.indexOf('let nextFlight'));
  assert.equal(/startNextSession/.test(autoNext), false, 'the timer watch must not start a session');
  const rollover = home.slice(home.indexOf('const applyDayRollover'), home.indexOf('const DAY_SEEN_KEY'));
  assert.equal(/confirmDayStart/.test(rollover), false, 'a new day asks for Start and does not confirm it');
  assert.match(prompt, /data-test="session-end-prompt"/);
  assert.match(prompt, /data-test="session-end-keep"/);
  assert.match(prompt, /data-test="end-session-any"/);
  assert.match(shared, /enum GoalRelease/);
  assert.match(shared, /func liftIfLive/);
  assert.match(monitor, /GoalRelease\.liftIfLive\(\)/);
  assert.match(plug, /sessionBegin[\s\S]{0,500}GoalRelease\.clear\(\)/);
  assert.match(plug, /func markGoalRelease/);
  assert.match(fn, /async end\(ctx\)/);
  assert.match(plug, /sessionBegin[\s\S]{0,400}VaultAllow\.clearActive\(\)/);
});

console.log(`session goal flow: ${n} passed`);
