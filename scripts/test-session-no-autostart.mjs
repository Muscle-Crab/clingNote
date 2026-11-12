// A session starts only from Start / Start Day / Start Session.
// A missing or zero baseline must not spend the day's earlier points on the vault.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { beginSessionGate, healSessionGate, readSessionGate, sessionUnlock } from '../src/utils/strictDay.js';
import { timerExpiry } from '../src/utils/sessionFlow.js';

const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
const plist = fs.readFileSync(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8');
const support = fs.readFileSync(new URL('../src/config/support.js', import.meta.url), 'utf8');
const mem = () => {
  const bag = new Map();
  return {
    getItem(k) { return bag.has(k) ? bag.get(k) : null; },
    setItem(k, v) { bag.set(k, String(v)); },
  };
};
const lock = { dayKey: '2026-11-12', index: 0, startMs: 5000, target: 160, goal: { points: 160 } };

const failed = beginSessionGate({ getItem() { return null; }, setItem() { throw new Error('quota'); } }, lock, 80, 160);
assert.equal(failed, null, 'a failed baseline write is not treated as saved');

const store = mem();
assert.equal(beginSessionGate(store, lock, 0, 160).earned, 0);
const healed = healSessionGate(store, lock, 80);
assert.equal(healed.earned, 80, 'a zero baseline taken before the list loaded is raised to the pre-start points');
assert.equal(healSessionGate(store, lock, 10).earned, 80, 'a real baseline is not lowered');
assert.equal(sessionUnlock({ dayEarned: 90, earnedAtStart: 0, sessionRequired: 160 }), false);
assert.equal(sessionUnlock({ dayEarned: 200, earnedAtStart: 0, sessionRequired: 160 }), true, 'the unsaved zero baseline would have opened the vault');
assert.equal(sessionUnlock({ dayEarned: 200, earnedAtStart: healed.earned, sessionRequired: 160 }), false, 'pre-start points do not meet this session');
assert.equal(readSessionGate(store, { ...lock, startMs: 9000 }), null, 'a new session does not inherit the previous baseline');

const due = timerExpiry({ now: 5000, endMs: 5000, running: false, canStart: true, sessionKey: 's' });
assert.equal(due.startNext, false);
assert.equal(due.userStart, true);
const waiting = timerExpiry({ now: 5000, endMs: 5000, running: false, canStart: false, cooldownUntil: 9000, sessionKey: 's' });
assert.equal(waiting.userStart, false);
assert.equal(waiting.reason, 'cooldown');

const auto = home.slice(home.indexOf('const autoStartFocus'), home.indexOf('const autoFocusCheck'));
assert.equal(/confirmDayStart|startDay\(/.test(auto), false, 'auto-focus must not start a lock-in session');
const next = home.slice(home.indexOf('const maybeAutoNext'), home.indexOf('let nextFlight'));
assert.equal(/startNextSession/.test(next), false);
const roll = home.slice(home.indexOf('const applyDayRollover'), home.indexOf('const DAY_SEEN_KEY'));
assert.equal(/confirmDayStart/.test(roll), false);
assert.match(home, /sessionEarnedPts\.value == null \? 0 : sessionEarnedPts\.value/);
assert.match(home, /healSessionGate/);
assert.equal(/<string>audio<\/string>/.test(plist), false);
assert.match(plist, /<string>remote-notification<\/string>/);
assert.match(support, /musclecrabs@gmail\.com/);
assert.equal(/support@clingnote\.app/.test(support), false);

console.log('session no autostart: baseline, vault points, and start paths');
