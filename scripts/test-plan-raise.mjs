// Run: node scripts/test-plan-raise.mjs — locked-in min/max task range (replaces the old "adding raises the plan count by 1"), plus reminders + voice.
import assert from 'assert'; import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const here = path.dirname(fileURLToPath(import.meta.url)); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-'));
for (const f of ['taskCap.js', 'reminders.js']) fs.copyFileSync(path.join(here, '../src/utils', f), path.join(dir, f.replace('.js', '.mjs')));
const C = await import(path.join(dir, 'taskCap.mjs')); const R = await import(path.join(dir, 'reminders.mjs'));
const core = createRequire(import.meta.url)('../netlify/functions/lib/eightHourCore.js');
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
await t('min = ceil(hours / 2): 3h->2, 8h->4, 8.5h->5, 12h->6; max = 50 (MAX_TASKS_PER_DAY)', () => {
  for (const [h, min] of [[3, 2], [4, 2], [5, 3], [8, 4], [8.5, 5], [10, 5], [12, 6]]) { const r = core.taskRange(h); assert.equal(r.min, min, `${h}h`); assert.equal(r.max, core.MAX_TASKS_PER_DAY); assert.equal(r.max, 50); }
});
await t('hours are clamped like the day prompt (3..12, default 8)', () => { assert.equal(core.taskRange(1).min, 2); assert.equal(core.taskRange(99).min, 6); assert.equal(core.taskRange(undefined).hours, 8); assert.equal(core.taskRange(undefined).min, 4); });
await t('adding up to the cap is allowed and never touches the plan count', () => {
  const r = core.taskRange(8); for (let c = 0; c < r.max; c++) assert.equal(C.capBlockMessage(c, 1, r, '8'), null, `add #${c + 1}`);
});
await t('adding past the cap is blocked with a short message', () => {
  const m = C.capBlockMessage(50, 1, core.taskRange(8), '8'); assert.equal(m, 'Max 50 tasks for 8 hours. Remove one to add another.'); assert.ok(m.length < 70);
});
await t('no range -> never blocks', () => assert.equal(C.capBlockMessage(99, 1, null, '8'), null));
// Standalone reminders (voice "Reminder" items): local list + notification, never a task.
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
await t('reminder saved + notification scheduled (mocked), not a task', async () => {
  const store = mem(); const calls = []; const now = new Date(2026, 9, 26, 10, 0);
  const r = await R.saveReminder({ title: 'Go to the store', remindAt: '2026-10-26T18:00' }, { store, now, schedule: async (k, o) => { calls.push([k, o]); return true; } });
  assert.equal(r.ok, true); assert.equal(r.scheduled, true); assert.equal(calls.length, 1); assert.equal(calls[0][1].body, 'Go to the store'); assert.equal(calls[0][1].at.getHours(), 18);
  assert.equal(R.listReminders(store).length, 1); assert.ok(!('weeklyRoutines' in store.m));
});
await t('reminder in the past refused', async () => { const r = await R.saveReminder({ title: 'x', remindAt: '2026-10-26T09:00' }, { store: mem(), now: new Date(2026, 9, 26, 10, 0) }); assert.equal(r.ok, false); });
// interpretSpeech: AI path (mocked ask) + fallbacks
const vdir = fs.mkdtempSync(path.join(os.tmpdir(), 'vi2-')); fs.copyFileSync(path.join(here, '../src/utils/voiceIntent.js'), path.join(vdir, 'voiceIntent.mjs'));
fs.writeFileSync(path.join(vdir, 'vint.mjs'), fs.readFileSync(path.join(here, '../src/utils/voiceInterpret.js'), 'utf8').replace("'@/utils/voiceIntent'", "'./voiceIntent.mjs'"));
const VI = await import(path.join(vdir, 'vint.mjs')); const now2 = new Date(2026, 9, 26, 10, 0);
await t('AI (mocked) mixed items used and validated', async () => {
  const content = JSON.stringify({ items: [{ type: 'reminder', title: 'Call mom', remindAt: '2026-10-26T18:00' }, { type: 'schedule', title: 'Homework', date: '2026-10-27', start: '09:00', durationMin: 120 }, { type: 'bogus', title: '' }] });
  const r = await VI.interpretSpeech('x', { ask: async (task) => { assert.equal(task, 'voice-intent'); return { content }; }, now: now2 });
  assert.equal(r.source, 'ai'); assert.equal(r.items.length, 2); assert.equal(r.items[1].date, '2026-10-27');
});
await t('AI error / timeout / no ask -> local parser', async () => {
  for (const ask of [async () => { throw new Error('404'); }, () => new Promise(() => {}), null]) {
    const r = await VI.interpretSpeech('go to the store 6 pm', { ask, now: now2, timeoutMs: 50 }); assert.equal(r.source, 'local'); assert.ok(['task', 'schedule'].includes(r.items[0].type) && r.items[0].start === '18:00'); // timed task (alerts at 18:00), not a reminder
  }
});
console.log(`${n} passed`);
