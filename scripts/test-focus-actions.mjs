// Run: node scripts/test-focus-actions.mjs  (lock-screen Pause/Resume/Done reconcile: src/utils/focusActions.js + wiring)
import fs from 'fs'; import path from 'path'; import assert from 'assert'; import { fileURLToPath } from 'url';
import { reconcileFocusActions, classifyFocusAction, pausePatch, resumePatch, remainingMs, focusActivityState, focusContentSig, actionId, FOCUS_MAX_AGE_MS } from '../src/utils/focusActions.js';
import { widgetTaskId } from '../src/utils/widgetSnapshot.js';
const here = path.dirname(fileURLToPath(import.meta.url));
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const NOW = Date.UTC(2026, 9, 30, 14, 0, 0);
const iso = (m) => new Date(m).toISOString();
// ZZTEST fixtures only
const mk = () => [
  { id: 'ZZTEST_a', title: 'ZZTEST write', points: 40, timerActive: true, timerStartedAt: iso(NOW - 20 * 60000), timerEndTime: iso(NOW + 10 * 60000) },
  { id: 'ZZTEST_b', title: 'ZZTEST gym', points: 20 },
];
// fake app: completing awards points once per task, exactly like toggleTaskCompletion on an open task
const app = (tasks) => {
  const st = { tasks, points: 0, completes: 0 };
  st.apply = {
    done: async (id) => { const x = st.tasks.find((y) => widgetTaskId(y) === id); if (!x) return false; if (x.completed) return true; x.completed = true; x.timerActive = false; st.points += x.points; st.completes++; return true; },
    pause: async (id, ts) => { const i = st.tasks.findIndex((y) => widgetTaskId(y) === id); st.tasks[i] = { ...st.tasks[i], ...pausePatch(st.tasks[i], ts) }; return true; },
    resume: async (id, ts) => { const i = st.tasks.findIndex((y) => widgetTaskId(y) === id); st.tasks[i] = { ...st.tasks[i], ...resumePatch(st.tasks[i], ts) }; return true; },
  };
  st.getTasks = () => st.tasks;
  return st;
};

await t('Done awards the task points once, even when tapped twice and re-delivered', async () => {
  const a = app(mk());
  const q = [{ id: 'd1', kind: 'done', taskId: 'ZZTEST_a', ts: NOW - 5000 }, { id: 'd2', kind: 'done', taskId: 'ZZTEST_a', ts: NOW - 4000 }];
  const r1 = await reconcileFocusActions({ queue: q, getTasks: a.getTasks, apply: a.apply, now: NOW });
  assert.strictEqual(a.points, 40); assert.strictEqual(a.completes, 1);
  assert.deepStrictEqual(r1.acked.sort(), ['d1', 'd2']);
  // same queue delivered again (ack lost): applied ids + completed state keep it at one award
  const r2 = await reconcileFocusActions({ queue: q, getTasks: a.getTasks, apply: a.apply, applied: r1.applied, now: NOW });
  assert.strictEqual(a.points, 40); assert.ok(r2.results.every((x) => x.action === 'duplicate' || x.action === 'already-done'));
  // and a fresh Done for an already-completed task (completed in-app first) is a no-op
  const r3 = await reconcileFocusActions({ queue: [{ id: 'd3', kind: 'done', taskId: 'ZZTEST_a', ts: NOW }], getTasks: a.getTasks, apply: a.apply, now: NOW });
  assert.strictEqual(r3.results[0].action, 'already-done'); assert.strictEqual(a.points, 40);
});
await t('task id matching: only the tapped task changes; unknown / malformed ids are acked as no-ops', async () => {
  const a = app(mk());
  const r = await reconcileFocusActions({ queue: [
    { id: 'x1', kind: 'done', taskId: 'ZZTEST_b', ts: NOW - 1000 },
    { id: 'x2', kind: 'done', taskId: 'ZZTEST_gone', ts: NOW - 900 },
    { id: 'x3', kind: 'done', taskId: 'bad id!', ts: NOW - 800 },
    { id: 'x4', kind: 'explode', taskId: 'ZZTEST_a', ts: NOW - 700 },
  ], getTasks: a.getTasks, apply: a.apply, now: NOW });
  assert.strictEqual(a.points, 20); assert.ok(!a.tasks[0].completed && a.tasks[1].completed);
  assert.deepStrictEqual(r.results.map((x) => x.action), ['done', 'missing', 'invalid', 'invalid']);
  assert.strictEqual(r.acked.length, 4);
  // hashed ids (tasks without a string id) match too
  const h = { title: 'ZZTEST hashed', createdAt: 5, points: 7 }; const b = app([h]);
  await reconcileFocusActions({ queue: [{ id: 'h', kind: 'done', taskId: widgetTaskId(h), ts: NOW }], getTasks: b.getTasks, apply: b.apply, now: NOW });
  assert.strictEqual(b.points, 7);
});
await t('a stale action is ignored (too old, from the future, or from an earlier timer session)', async () => {
  const a = app(mk());
  const r = await reconcileFocusActions({ queue: [
    { id: 's1', kind: 'done', taskId: 'ZZTEST_a', ts: NOW - FOCUS_MAX_AGE_MS - 1 },
    { id: 's2', kind: 'done', taskId: 'ZZTEST_b', ts: NOW + 10 * 60000 },
    { id: 's3', kind: 'pause', taskId: 'ZZTEST_a', ts: NOW - 60 * 60000 }, // before this timer started (20 min ago)
    { id: 's4', kind: 'done', taskId: 'ZZTEST_a' },
  ], getTasks: a.getTasks, apply: a.apply, now: NOW });
  assert.ok(r.results.every((x) => x.action === 'stale'), JSON.stringify(r.results));
  assert.strictEqual(a.points, 0); assert.ok(!a.tasks[0].timerPausedAt); assert.strictEqual(r.acked.length, 4);
});
await t('failed apply is kept for the next foreground, then applied once', async () => {
  const a = app(mk()); let fail = true; const done = a.apply.done;
  a.apply.done = async (id) => (fail ? false : done(id));
  const q = [{ id: 'f1', kind: 'done', taskId: 'ZZTEST_a', ts: NOW - 1000 }];
  const r1 = await reconcileFocusActions({ queue: q, getTasks: a.getTasks, apply: a.apply, now: NOW });
  assert.deepStrictEqual(r1.kept, ['f1']); assert.strictEqual(a.points, 0);
  fail = false;
  const r2 = await reconcileFocusActions({ queue: q, getTasks: a.getTasks, apply: a.apply, applied: r1.applied, now: NOW });
  assert.deepStrictEqual(r2.acked, ['f1']); assert.strictEqual(a.points, 40);
});
await t('pause freezes the remaining time at the tap; resume shifts the end by the paused span; repeats are no-ops', async () => {
  const a = app(mk());
  const pTs = NOW - 4 * 60000, rTs = NOW - 60000; // paused 3 minutes
  const r = await reconcileFocusActions({ queue: [
    { id: 'p1', kind: 'pause', taskId: 'ZZTEST_a', ts: pTs }, { id: 'p2', kind: 'pause', taskId: 'ZZTEST_a', ts: pTs + 1000 },
    { id: 'r1', kind: 'resume', taskId: 'ZZTEST_a', ts: rTs }, { id: 'r2', kind: 'resume', taskId: 'ZZTEST_a', ts: rTs + 1000 },
  ], getTasks: a.getTasks, apply: a.apply, now: NOW });
  assert.deepStrictEqual(r.results.map((x) => x.action), ['pause', 'noop', 'resume', 'noop']);
  assert.strictEqual(new Date(a.tasks[0].timerEndTime).getTime(), NOW + 13 * 60000);
  assert.strictEqual(a.tasks[0].timerPausedAt, null);
  const paused = { ...mk()[0], ...pausePatch(mk()[0], pTs) };
  assert.strictEqual(remainingMs(paused, NOW + 3600000), 14 * 60000); // frozen
});
await t('Live Activity state: paused shows frozen seconds; points and the 8-hour day are carried; sig changes on points', () => {
  const task = { ...mk()[0], timerPausedAt: iso(NOW - 60000) };
  const s = focusActivityState(task, { ptsDone: 120, ptsTarget: 235, dayEndMs: NOW + 3 * 3600000, now: NOW });
  assert.strictEqual(s.paused, true); assert.strictEqual(s.remainingSec, 11 * 60); assert.strictEqual(s.taskId, 'ZZTEST_a');
  assert.strictEqual(s.ptsDone, 120); assert.strictEqual(s.ptsTarget, 235); assert.strictEqual(s.dayEndsAtMs, NOW + 3 * 3600000);
  const s2 = focusActivityState(task, { ptsDone: 160, ptsTarget: 235, dayEndMs: NOW + 3 * 3600000, now: NOW + 5000 });
  assert.notStrictEqual(focusContentSig(s), focusContentSig(s2));
  assert.strictEqual(focusContentSig(focusActivityState(task, { ptsDone: 120, ptsTarget: 235, dayEndMs: NOW + 3 * 3600000, now: NOW + 5000 })), focusContentSig(s)); // paused: stable over time
  assert.strictEqual(focusActivityState({ ...task, completed: true }), null);
  assert.strictEqual(focusActivityState(task, { dayEndMs: NOW - 1, now: NOW }).dayEndsAtMs, 0);
  assert.strictEqual(actionId({ kind: 'done', taskId: 'ZZTEST_a', ts: 5 }), 'done:ZZTEST_a@5');
  assert.strictEqual(classifyFocusAction({ kind: 'resume', taskId: 'ZZTEST_a', ts: NOW }, mk(), { now: NOW }), 'noop');
});
await t('wiring: Done reuses widgetComplete; intents in App + widget targets; control + Live Activity gated by @available', () => {
  const hv = fs.readFileSync(path.join(here, '../src/views/HomeView.vue'), 'utf8');
  assert.ok(/done: \(id\) => widgetComplete\(id, 'complete'\)/.test(hv));
  assert.ok(hv.includes('clingNative.ackFocusActions(out.acked)') && hv.includes('!task.timerPausedAt && // paused'));
  const pbx = fs.readFileSync(path.join(here, '../ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  assert.strictEqual((pbx.match(/FocusIntents\.swift in Sources \*\/,/g) || []).length, 2);
  assert.strictEqual((pbx.match(/StartFocusControl\.swift in Sources \*\/,/g) || []).length, 1);
  const fi = fs.readFileSync(path.join(here, '../ios/App/Shared/FocusIntents.swift'), 'utf8');
  for (const s of ['struct FocusPauseIntent: LiveActivityIntent', 'struct FocusResumeIntent: LiveActivityIntent', 'struct FocusDoneIntent: LiveActivityIntent']) {
    const i = fi.indexOf(s); assert.ok(i > 0, s); assert.ok(fi.slice(0, i).trimEnd().endsWith('@available(iOS 17.0, *)'), s);
  }
  assert.ok(/@available\(iOS 18\.0, \*\)\s*struct StartFocusIntent/.test(fi) && fi.includes('"group.app.clingnote.ios"') && fi.includes('"focus.pending"'));
  const bundle = fs.readFileSync(path.join(here, '../ios/App/ClingNoteWidget/MatchupWidget.swift'), 'utf8');
  assert.ok(bundle.includes('if #available(iOS 18.0, *) { StartFocusControl() }'));
  const plug = fs.readFileSync(path.join(here, '../ios/App/App/ClingNativePlugin.swift'), 'utf8');
  for (const m of ['updateFocusActivity', 'getFocusActions', 'ackFocusActions']) assert.ok(plug.includes(`CAPPluginMethod(name: "${m}"`) && plug.includes(`@objc func ${m}(`), m);
  const js = fs.readFileSync(path.join(here, '../src/native/clingNative.js'), 'utf8');
  for (const m of ['updateFocusActivity', 'getFocusActions', 'ackFocusActions']) assert.ok(js.includes(`p.${m}(`), m);
});
console.log(`\n${n} focus-action tests passed`);
