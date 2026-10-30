// Plan phase 2: self-replan, holiday range, boss alarm, hard lock, growing scene + lessons enabled and wired.
import assert from 'node:assert'; import fs from 'node:fs';
import * as P from '../src/utils/planPhase2.js'; import * as C from '../src/utils/coachLessons.js';
let n = 0; const t = (name, f) => { f(); n++; console.log('ok', name); };
const src = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const now = 1e12, H = src('src/views/HomeView.vue');
t('auto replan fires at 15+ behind once started', () => { assert(P.shouldAutoReplan({ behind: 15, started: true, now })); assert(!P.shouldAutoReplan({ behind: 14, started: true, now })); assert(!P.shouldAutoReplan({ behind: 30, started: false, now })); });
t('auto replan rate-limited and backs off after Undo', () => { assert(!P.shouldAutoReplan({ behind: 30, started: true, lastAt: now - 60000, now })); assert(!P.shouldAutoReplan({ behind: 30, started: true, undoneAt: now - 60000, now })); assert(!P.shouldAutoReplan({ behind: 30, started: true, busy: true, now })); assert(!P.shouldAutoReplan({ behind: 30, started: true, enabled: false, now })); });
t('auto replan reuses the Undo toast path', () => { assert(/onSergeantReplan\(open, \(\) => autoSave/.test(H)); assert(/undo: async \(\) => \{ if \(onUndo\) onUndo\(\)/.test(H)); });
t('offRange inclusive, clamps past, max 31', () => { assert.deepEqual(P.offRange('2026-10-30', '2026-11-01', '2026-10-29'), ['2026-10-30', '2026-10-31', '2026-11-01']); assert.deepEqual(P.offRange('2026-10-01', '2026-10-29', '2026-10-29'), ['2026-10-29']); assert.equal(P.offRange('2026-11-01', '2027-03-01', '2026-10-29').length, 31); assert.deepEqual(P.offRange('2026-11-02', '2026-11-01', '2026-10-29'), []); });
t('off day + streak icon', () => { assert(P.isOffDay(['2026-10-29'], '2026-10-29')); assert(!P.isOffDay(null, 'x')); assert(src('src/components/home/ProgressBar.vue').includes("offToday ? '🏖️' : '🔥'")); assert(/off-today="isViewingToday && offToday"/.test(H)); });
t('I\'m off opens the range picker and saves arrayUnion', () => { assert(/id === 'off'\) \{ holidayOpen.value = true/.test(H)); assert(/arrayUnion\(\.\.\.list\)/.test(H)); });
t('alarm time: start time ahead, else +30', () => { const d = new Date(2026, 9, 29, 9, 0); assert.equal(P.alarmAtFor({ startTime: '10:15' }, d).getHours(), 10); assert.equal(P.alarmAtFor({ startTime: '08:00' }, d).getTime(), d.getTime() + 30 * 60000); assert.equal(P.alarmAtFor({}, d).getTime(), d.getTime() + 30 * 60000); });
t('bell in task actions + uses wake alarm plugin', () => { const T = src('src/components/home/TaskCard.vue'); assert(T.includes('data-coach="bell"') && T.includes("'alarm'")); assert(/clingAlarm.scheduleOnce\(\{ atMs: at, title: task.title, snoozeMinutes: SNOOZE_MINUTES, sound: ALARM_SOUND/.test(H)); assert(/clingAlarm.cancel\(task.alarmId\)/.test(H)); });
t('unlock needs the exact word', () => { assert(P.unlockAccepted(' unlock ')); assert(!P.unlockAccepted('ok')); assert(!P.unlockAccepted(null)); });
t('hard lock at day start + shared emergency unlock', () => { assert(src('src/components/eighthour/DayStartPrompt.vue').includes("{ lock: canLock && lockApps }")); assert(/if \(opts.lock\) await startHardLock\(\)/.test(H)); assert(/action === 'emergency_unlock'\) return emergencyUnlock\(\)/.test(H)); assert(src('src/components/home/FabButtons.vue').includes('v-if="locked"')); });
t('growPct uses points vs target, capped', () => { assert.equal(P.growPct(10, 30, 60), 50); assert.equal(P.growPct(80, 10, 60), 80); assert.equal(P.growPct(0, 500, 60), 100); assert.equal(P.growPct(20, 50, 0), 20); });
t('phase 2 lessons enabled with wired targets', () => { const all = ['src/components/home/FabButtons.vue', 'src/components/home/TaskCard.vue', 'src/components/home/ProgressBar.vue'].map(src).join('\n');
  for (const id of ['boss-alarm', 'hard-lock', 'grow-scene']) { const l = C.LESSONS.find((x) => x.id === id); assert(l && l.enabled, id);
    for (const s of l.steps) { const m = /data-coach="([^"]+)"/.exec(s.target); if (m) assert(all.includes(`data-coach="${m[1]}"`), m[1]); } }
  assert(H.includes("coachStart('lock-on')") && H.includes("coachSignal('alarm-set')") && H.includes("coachSignal('tap')")); });
console.log(`plan phase 2: ${n} tests passed`);
