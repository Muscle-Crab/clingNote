// Run: node scripts/test-plan-raise.mjs — adding a task to a full locked-in plan raises the required count by 1 (regression).
import assert from 'assert'; import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-'));
for (const f of ['planRaise.js', 'reminders.js']) fs.copyFileSync(path.join(here, '../src/utils', f), path.join(dir, f.replace('.js', '.mjs')));
const P = await import(path.join(dir, 'planRaise.mjs')); const R = await import(path.join(dir, 'reminders.mjs'));
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
await t('locked plan of 6 with 6 tasks: add one -> task created, requirement 7, no error', async () => {
  const tasks = Array.from({ length: 6 }, (_, i) => ({ title: `T${i}` })); let saved = null;
  const r = await P.addWithPlanRaise({ plan: { wakeTime: '07:00', taskCount: 6 }, countNow: tasks.length, addTask: async () => { tasks.push({ title: 'New' }); return true; }, savePlan: async (p) => { saved = p; } });
  assert.deepStrictEqual(r, { ok: true, plan: { wakeTime: '07:00', taskCount: 7 } }); assert.equal(tasks.length, 7); assert.deepStrictEqual(saved, { wakeTime: '07:00', taskCount: 7 });
});
await t('room left in the plan: no change', () => assert.equal(P.raisedPlan({ wakeTime: '07:00', taskCount: 6 }, 4, 1), null));
await t('3 adds in a row on a full plan of 5 -> 8', () => { let plan = { wakeTime: '07:00', taskCount: 5 }; for (let c = 5; c < 8; c++) plan = P.raisedPlan(plan, c, 1) || plan; assert.equal(plan.taskCount, 8); });
await t('failed add never raises', async () => { let saved = 0; const r = await P.addWithPlanRaise({ plan: { wakeTime: '07:00', taskCount: 6 }, countNow: 6, addTask: async () => false, savePlan: async () => { saved++; } }); assert.equal(r.ok, false); assert.equal(saved, 0); });
await t('raise failure does not block the task', async () => { const r = await P.addWithPlanRaise({ plan: { wakeTime: '07:00', taskCount: 1 }, countNow: 1, addTask: async () => true, savePlan: async () => { throw new Error('offline'); } }); assert.equal(r.ok, true); assert.equal(r.raiseError, 'offline'); });
await t('capped at 50; no plan -> no raise', () => { assert.equal(P.raisedPlan({ wakeTime: '07:00', taskCount: 50 }, 50).taskCount, 50); assert.equal(P.raisedPlan(null, 9), null); });
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
