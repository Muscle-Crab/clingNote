// Full shield flow, including the gap after a session ends. The App Group values are what the
// DeviceActivity extension reads: lock.state (locked/until) and clingnote.debtHold.v1 (key/startMs/untilMs).
// A hold whose start has arrived forces the shield back on (DebtHold.keepShieldIfHeld) until the app clears the entry.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decideShield } from '../src/utils/sessionShield.js';
import core from '../netlify/functions/lib/eightHourCore.js';

const H = 3600000;
const start = Date.parse('2026-11-09T12:00:00Z');
const end = start + 9 * H;
const base = { enabled: true, selectionCount: 4, known: true, unlockedToday: false };
const lockOf = (over) => ({ dayKey: '2026-11-09', index: 0, startMs: start, endMs: end, target: 225, earned: 0, ...over });

const group = { 'lock.state': { locked: false, until: 0 }, 'clingnote.debtHold.v1': null };
const apply = (d) => {
  if (d.hold.action === 'clear') group['clingnote.debtHold.v1'] = null;
  if (d.hold.action === 'arm') group['clingnote.debtHold.v1'] = { key: d.hold.key, startMs: d.hold.startMs, untilMs: d.hold.untilMs };
  if (d.action === 'stop') group['lock.state'] = { locked: false, until: 0 };
  else if (d.action === 'start') group['lock.state'] = { locked: true, until: d.endMs };
  else if (!d.want) group['lock.state'] = { locked: false, until: 0 };
};
// Extension: a hold that has started re-applies the shield even if the app had cleared lock.state.
const extension = (now) => {
  const h = group['clingnote.debtHold.v1'];
  if (h && h.startMs <= now + 90000 && now < h.untilMs) group['lock.state'] = { locked: true, until: h.untilMs, label: 'ClingNote lock-in' };
};
const sync = (extra, now) => {
  // The app drops an already-expired native lock before deciding, then starts a new one if the rules still want it.
  if (group['lock.state'].locked && group['lock.state'].until > 0 && group['lock.state'].until <= now) group['lock.state'] = { locked: false, until: 0 };
  const native = { locked: !!group['lock.state'].locked, until: group['lock.state'].until || 0, monitoring: !!group['lock.state'].locked };
  const d = decideShield({ ...base, now, native, ...extra });
  apply(d);
  return d;
};
const shielded = () => group['lock.state'].locked === true;

// 1. Running, under the goal.
let now = start + H;
let d = sync({ running: true, endMs: end, lock: lockOf({ session: { earned: 100, target: 225, done: 3 } }), card: { earned: 100, required: 225, met: false } }, now);
assert.equal(d.action, 'start');
assert.equal(d.hold.action, 'arm');
assert.equal(d.hold.startMs, end, 'hold is pre-armed for the session end');
assert.equal(shielded(), true);
assert.ok(group['clingnote.debtHold.v1']);

// 2. Goal met while the session is still running.
now = start + 4 * H;
d = sync({ running: true, endMs: end, lock: lockOf({ earned: 304, session: { earned: 304, target: 225, done: 10, met: true } }), card: { earned: 304, required: 225, met: true } }, now);
assert.equal(d.openNow, true);
assert.equal(d.action, 'stop');
assert.equal(d.hold.action, 'clear');
assert.equal(shielded(), false);
assert.equal(group['clingnote.debtHold.v1'], null);

// The extension fires at the end. With the hold already cleared, it does not put the shield back.
now = end + 60 * 1000;
extension(now);
assert.equal(shielded(), false, 'session end does not re-shield a met session');

// 3-4. Session over, goal met, waiting for the next session (the wait itself is not a lock).
const metLock = lockOf({ earned: 304, settled: true, session: { earned: 304, target: 225, done: 10, met: true } });
d = sync({ running: false, endMs: end, lock: metLock, card: null, debt: null }, now);
assert.equal(d.endedMet, true);
assert.equal(d.openNow, true);
assert.equal(d.want, false);
assert.equal(d.hold.action, 'clear');
assert.equal(shielded(), false);

// 5. Relaunch / foreground while still between sessions. The extension may have raised a stale hold; the sync clears it.
group['clingnote.debtHold.v1'] = { key: 'debt_2026-11-09_0', startMs: end, untilMs: end + core.DEBT_CAP_MS };
group['lock.state'] = { locked: true, until: end + core.DEBT_CAP_MS };
extension(now);
assert.equal(shielded(), true, 'a stale hold would keep the shield until the app syncs');
d = sync({ running: false, endMs: end, lock: metLock, card: null, debt: null }, now);
assert.equal(d.hold.action, 'clear');
assert.equal(d.action, 'stop');
assert.equal(group['clingnote.debtHold.v1'], null);
assert.equal(shielded(), false, 'relaunch between sessions stays open');

// 6. Next session starts under its own goal: shield on again. A met previous session does not keep it open.
const nextStart = end + 2 * H;
const nextEnd = nextStart + 6 * H;
now = nextStart + 10 * 60000;
const nextLock = { dayKey: '2026-11-09', index: 1, startMs: nextStart, endMs: nextEnd, target: 180, earned: 0, session: { earned: 0, target: 180, done: 0, met: false } };
d = sync({ running: true, endMs: nextEnd, lock: nextLock, card: { earned: 0, required: 180, met: false } }, now);
assert.equal(d.openNow, false);
assert.equal(d.action, 'start');
assert.equal(d.hold.action, 'arm');
assert.equal(shielded(), true);

// 7. That session ends below its goal. Shield stays on, and a relaunch keeps it on.
now = nextEnd + 5 * 60000;
const missed = { ...nextLock, earned: 40, settled: true, session: { earned: 40, target: 180, done: 2, met: false } };
const debt = core.debtAfterSettle(null, { sessionKey: '2026-11-09#1', startMs: nextStart, endMs: nextEnd, target: 180, earned: 40, done: 2, met: false });
d = sync({ running: false, endMs: nextEnd, lock: missed, card: null, debt }, now);
assert.equal(d.endedMet, false);
assert.equal(d.openNow, false);
assert.equal(d.want, true);
assert.equal(d.hold.action, 'arm');
assert.equal(d.hold.startMs, debt.sinceMs);
extension(now);
assert.equal(shielded(), true);
// Relaunch: same debt, same ended lock.
d = sync({ running: false, endMs: nextEnd, lock: missed, card: null, debt }, now + 30 * 60000);
extension(now + 30 * 60000);
assert.equal(d.hold.action, 'arm');
assert.equal(shielded(), true, 'a missed session stays shielded across relaunch');

// Points alone open the apps. Two finished tasks at the goal unlock immediately; eight tasks still short do not.
const few = { dayKey: '2026-11-09', index: 0, startMs: start, endMs: end, target: 225, session: { earned: 225, target: 225, done: 2, met: true } };
d = sync({ running: true, endMs: end, lock: few, card: { earned: 225, required: 225, met: true }, debt: { sessionKey: '2026-11-08#0', target: 100, earned: 10, sinceMs: start - H } }, start + 2 * H);
assert.equal(d.openNow, true);
assert.equal(d.hold.action, 'clear', 'hitting the points goal clears clingnote.debtHold.v1 immediately');
assert.equal(shielded(), false);
now = end + 60 * 1000;
d = sync({ running: false, endMs: end, lock: { ...few, settled: true }, card: null, debt: null }, now);
assert.equal(d.endedMet, true);
assert.equal(shielded(), false, 'ending the session does not lock apps that already met the points goal');
const shortTasks = { dayKey: '2026-11-09', index: 0, startMs: start, endMs: end, target: 225, session: { earned: 100, target: 225, done: 8, met: false } };
d = sync({ running: true, endMs: end, lock: shortTasks, card: { earned: 100, required: 225, met: false } }, start + 3 * H);
assert.equal(d.openNow, false);
assert.equal(d.hold.action, 'arm', 'eight tasks below the points goal stay shielded');

const home = readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
assert.match(home, /decideShield\(\{/);
assert.match(home, /endedGoalMet\(eh\.lock\.value/);
assert.match(home, /await syncDebtHold\(decision\.hold\)/);
console.log('between sessions: met stays open, missed stays shielded, App Group hold matches');
