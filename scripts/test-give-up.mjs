// Give up (countdown card) and End session: both end the session early and open the locked apps right away.
// Shield side: a release written for the ended session wins over the missed-goal hold, the idle shield and Coach rules
// until the next session starts. UI side: Give up sits inside the running countdown card and confirms once.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decideShield } from '../src/utils/sessionShield.js';
import { releaseKeyOf, readRelease, writeRelease, releasedFor, RELEASE_KEY } from '../src/utils/sessionRelease.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const H = 3600000;
const start = Date.parse('2026-11-26T20:59:00Z'); const end = start + 5 * H;
const lockOf = (over) => ({ dayKey: '2026-11-26', index: 0, startMs: start, endMs: end, target: 160, earned: 0, ...over });
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
const base = { enabled: true, selectionCount: 6, known: true, unlockedToday: false };
const debt = { sessionKey: '2026-11-26#0', startMs: start, endMs: end, target: 160, earned: 0 };

t('release key is per session start', () => {
  assert.equal(releaseKeyOf(lockOf()), `2026-11-26#0:${start}`);
  assert.notEqual(releaseKeyOf(lockOf()), releaseKeyOf(lockOf({ index: 1, startMs: end + H })));
  assert.equal(releaseKeyOf(null), ''); assert.equal(releaseKeyOf({ dayKey: 'x' }), '');
});

t('release is stored for today only', () => {
  const s = mem();
  writeRelease(s, { key: releaseKeyOf(lockOf()), day: '2026-11-26', reason: 'give-up' });
  assert.ok(s.m[RELEASE_KEY]);
  assert.equal(readRelease(s, '2026-11-26').reason, 'give-up');
  assert.equal(readRelease(s, '2026-11-27'), null, 'a new local day forgets it');
  assert.equal(writeRelease(s, { key: '', day: '2026-11-26' }), null);
});

t('release matches only the ended session it was written for', () => {
  const rel = { key: releaseKeyOf(lockOf()), day: '2026-11-26' };
  const ended = lockOf({ endMs: start + 30 * 60000 });
  assert.equal(releasedFor(rel, ended, false), true);
  assert.equal(releasedFor(rel, ended, true), false, 'never while a session runs');
  assert.equal(releasedFor(rel, lockOf({ index: 1, startMs: end + H }), false), false, 'next session: normal rules');
  assert.equal(releasedFor(null, ended, false), false);
});

t('without a release, ending short keeps the missed-goal lock (old behavior)', () => {
  const now = start + 31 * 60000; const ended = lockOf({ endMs: start + 30 * 60000, session: { earned: 0, target: 160, done: 0 } });
  const d = decideShield({ ...base, now, running: false, endMs: ended.endMs, lock: ended, debt, native: { locked: true, until: end, monitoring: true } });
  assert.equal(d.want, true, 'missed early end still shields without a release');
});

t('End session / Give up: apps open now, hold cleared, native lock stopped', () => {
  const now = start + 31 * 60000; const ended = lockOf({ endMs: start + 30 * 60000, session: { earned: 0, target: 160, done: 0 } });
  const d = decideShield({ ...base, now, running: false, endMs: ended.endMs, lock: ended, debt, strictWant: true, native: { locked: true, until: end, monitoring: true }, released: true });
  assert.equal(d.released, true); assert.equal(d.openNow, true); assert.equal(d.want, false);
  assert.equal(d.action, 'stop'); assert.equal(d.hold.action, 'clear'); assert.equal(d.focus, false);
  assert.equal(d.debtCleared, false, 'the server debt record is not erased by the client (scoring unchanged)');
});

t('a release never lifts a running session', () => {
  const now = start + H; const lock = lockOf({ session: { earned: 0, target: 160, done: 0 } });
  const d = decideShield({ ...base, now, running: true, endMs: end, lock, card: { earned: 0, required: 160, met: false }, native: {}, released: true });
  assert.equal(d.released, false); assert.equal(d.want, true); assert.equal(d.action, 'start');
});

t('Home wiring: Give up on the card, one confirm, same end path, apps released', () => {
  const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  const card = fs.readFileSync(new URL('../src/components/home/EightHourCard.vue', import.meta.url), 'utf8');
  assert.match(home, /<EightHourCard[^>]*@give-up="giveUpSession"/);
  const gu = home.slice(home.indexOf('const giveUpSession'), home.indexOf('const giveUpSession') + 400);
  assert.match(gu, /window\.confirm\(/); assert.match(gu, /endSessionManual\(\{ reason: 'give-up' \}\)/);
  const em = home.slice(home.indexOf('const endSessionManual'), home.indexOf('const giveUpSession'));
  assert.match(em, /eh\.endSession\(\)/); assert.match(em, /writeRelease\(/); assert.match(em, /persistEndRelease\(\)/); assert.match(em, /syncAppLock\(\)/);
  assert.equal(/clearGoalRelease/.test(em), false, 'ending must not clear the release that opens the apps');
  const pr = home.slice(home.indexOf('const persistEndRelease'), home.indexOf('const syncAppLock'));
  assert.match(pr, /clearDebtHold/); assert.match(pr, /markGoalRelease/);
  assert.match(home, /released: releasedFor\(readRelease\(localStorage, localDateStr\(\)\), eh\.lock\.value, !!eh\.running\.value\)/);
  assert.match(home, /if \(decision\.released\) await persistEndRelease\(\);/);
  const run = card.slice(card.indexOf("view === 'running'"), card.indexOf("view === 'ended'"));
  assert.match(run, /class="eh-clockcol"[\s\S]*v-if="canGiveUp"[\s\S]*data-test="eh-give-up"[\s\S]*\$emit\('give-up'\)/);
  assert.match(card, /const canGiveUp = computed\(\(\) => view\.value === 'running' && !sessionComplete\.value\)/);
  assert.match(card, /defineEmits\(\[[^\]]*'give-up'/);
});

t('countdown card: smaller clock, Give up is a real contrasting button', () => {
  const card = fs.readFileSync(new URL('../src/components/home/EightHourCard.vue', import.meta.url), 'utf8');
  assert.match(card, /\.eh-clock \{ font-size: 1\.35rem/);
  const quit = (card.match(/\.eh-quit \{[\s\S]*?\n\.eh-quit:active/) || [])[0] || '';
  assert.match(quit, /font-size: \.88rem/);
  assert.match(quit, /font-weight: 700/);
  assert.match(quit, /color: var\(--c-danger, #F87171\)/);
  assert.match(quit, /background: var\(--c-danger-soft, #2E1517\)/);
  assert.match(quit, /border: 1px solid rgba\(248, 113, 113, 0\.7\)/);
  assert.match(quit, /border-radius: 8px/);
  assert.match(quit, /padding: 8px 14px/);
  assert.equal(/text-decoration: underline/.test(quit), false, 'Give up is a button, not underlined text');
});

t('Give up is only on an active unfinished session, never on the ended screen', () => {
  const ch = fs.readFileSync(new URL('../src/components/eighthour/EightHourChrome.vue', import.meta.url), 'utf8');
  const card = fs.readFileSync(new URL('../src/components/home/EightHourCard.vue', import.meta.url), 'utf8');
  const shut = ch.slice(ch.indexOf('data-test="eh-shutdown"'), ch.indexOf('class="ehs-links"'));
  assert.equal(/eh-shut-give-up|Give up/.test(shut), false, 'no Give up on the session-ended moon screen');
  assert.equal(/giveUpEnded/.test(ch), false, 'ended-screen Give up handler is gone');
  assert.match(card, /v-if="canGiveUp"/);
  assert.match(card, /sessionComplete/);
  assert.match(card, /met\.value/);
});

console.log(`test-give-up: ${n} passed`);
