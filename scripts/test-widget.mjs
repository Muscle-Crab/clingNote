// Home-screen widget: snapshot builder + deep-link routing (src/utils/widgetSnapshot.js). Run: node scripts/test-widget.mjs
import assert from 'node:assert/strict';
import { buildWidgetSnapshot, widgetTaskId, widgetKeyMap, parseWidgetLink, widgetTaskUrl, chipText, fmtEstimate, taskRefKey, WIDGET_MAX_TASKS } from '../src/utils/widgetSnapshot.js';
import { drainQueue, classifyEntry, entryKey, MAX_AGE_MS } from '../src/utils/widgetQueue.js';

let n = 0; const t = (name, fn) => { fn(); n++; };
const now = new Date(2026, 9, 24, 9, 30);
const tasks = [
  { title: 'Wash car', createdAt: 1, minutes: 30, points: 15, completed: true },
  { title: 'Write report', createdAt: 2, minutes: 90, points: 40, startTime: '14:00' },
  { title: '  Gym  ', createdAt: 3, estimateMin: 45, points: 20, startTime: '7:15' },
  { title: 'Call mom', createdAt: 4, points: 5 },
  { title: 'Secret thing', createdAt: 5, minutes: 10, points: 5, visibility: 'private', anonymous: true },
  { title: '', createdAt: 6 }, null,
];

t('snapshot shape + totals', () => {
  const s = buildWidgetSnapshot(tasks, { now, dayName: 'Saturday' });
  assert.equal(s.v, 1); assert.equal(s.date, '2026-10-24'); assert.equal(s.day, 'Saturday'); assert.equal(s.updatedAt, now.getTime());
  assert.equal(s.total, 5); assert.equal(s.done, 1);
  assert.equal(s.estTotal, 30 + 90 + 45 + 10); assert.equal(s.estLeft, 145);
  assert.equal(s.ptsTotal, 85); assert.equal(s.ptsDone, 15);
  assert.deepEqual(Object.keys(s.tasks[0]).sort(), ['done', 'est', 'id', 'pts', 'time', 'title']);
});
t('order: timed open by time, then open in list order, done last; time padded; title trimmed', () => {
  const s = buildWidgetSnapshot(tasks, { now });
  assert.deepEqual(s.tasks.map((r) => r.title), ['Gym', 'Write report', 'Call mom', 'Secret thing', 'Wash car']);
  assert.equal(s.tasks[0].time, '07:15'); assert.equal(s.tasks[2].time, ''); assert.equal(s.tasks[4].done, true);
});
t('owner widget keeps full titles of private/anonymous tasks', () => {
  assert.ok(buildWidgetSnapshot(tasks, { now }).tasks.some((r) => r.title === 'Secret thing'));
});
t('estimate falls back to typed estimateMin; missing -> 0', () => {
  const s = buildWidgetSnapshot(tasks, { now });
  assert.equal(s.tasks.find((r) => r.title === 'Gym').est, 45); assert.equal(s.tasks.find((r) => r.title === 'Call mom').est, 0);
});
t('cap + empty/garbage input', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ title: 'T' + i, createdAt: i }));
  assert.equal(buildWidgetSnapshot(many, { now }).tasks.length, WIDGET_MAX_TASKS);
  assert.equal(buildWidgetSnapshot(many, { now }).total, 30);
  const e = buildWidgetSnapshot(undefined, { now }); assert.equal(e.total, 0); assert.deepEqual(e.tasks, []);
});
t('ids: stable, url-safe, explicit id wins, distinct per card', () => {
  const a = widgetTaskId(tasks[1]); assert.equal(a, widgetTaskId({ ...tasks[1], points: 99 })); assert.match(a, /^k[0-9a-z]+$/);
  assert.notEqual(a, widgetTaskId(tasks[2])); assert.equal(widgetTaskId({ id: 'abc_1', title: 'x' }), 'abc_1');
  assert.match(widgetTaskId({ id: 'bad id/..', title: 'x' }), /^k/);
  const m = widgetKeyMap(tasks); assert.equal(m[a], taskRefKey(tasks[1])); assert.equal(m[a], '2|Write report');
});
t('chips match card format', () => {
  assert.equal(chipText(30, 15), '30m · 15p'); assert.equal(fmtEstimate(90), '1h 30m'); assert.equal(fmtEstimate(120), '2h'); assert.equal(chipText(0, 5), '5p'); assert.equal(chipText(0, 0), '');
});
t('deep links', () => {
  const id = widgetTaskId(tasks[1]);
  assert.equal(widgetTaskUrl(id), `clingnote://task/${id}`);
  assert.equal(parseWidgetLink(widgetTaskUrl(id)), `/home?task=${id}`);
  assert.equal(parseWidgetLink('CLINGNOTE://task/abc'), '/home?task=abc');
  assert.equal(parseWidgetLink('clingnote://home'), '/home'); assert.equal(parseWidgetLink('clingnote://'), '/home');
  assert.equal(parseWidgetLink('clingnote://task/'), '/home');
  assert.equal(parseWidgetLink('clingnote://task/..%2F..%2Fprofile'), '/home');
  assert.equal(parseWidgetLink('clingnote://task/a?b=<script>'), '/home?task=a');
  assert.equal(parseWidgetLink('clingnote://evil/x'), null);
  assert.equal(parseWidgetLink('https://clingnot.netlify.app/pal/ABC'), null);
  assert.equal(parseWidgetLink('clingnot://localhost/pals'), null);
  assert.equal(parseWidgetLink(''), null); assert.equal(parseWidgetLink(null), null); assert.equal(parseWidgetLink('not a url'), null);
});

await (async () => {
  n++;
  // pending overlay keeps optimistic widget taps "done" until the app applies them
  const base = [{ title: 'A', createdAt: '1' }, { title: 'B', createdAt: '2' }];
  const idA = widgetTaskId(base[0]), idB = widgetTaskId(base[1]);
  const ov = buildWidgetSnapshot(base, { now, dayName: 'Saturday', pendingIds: [idB] });
  assert.equal(ov.done, 1); assert.equal(ov.tasks.find((t) => t.id === idB).done, true);

  const T = Date.parse('2026-10-24T12:00:00Z');
  const fresh = (tasks) => tasks.map((t) => ({ ...t }));
  assert.equal(classifyEntry({ taskId: 'a/b' }, base, { today: 'Saturday', now: T }), 'invalid');
  assert.equal(classifyEntry({ taskId: idA, day: 'Friday', ts: T }, base, { today: 'Saturday', now: T }), 'stale');
  assert.equal(classifyEntry({ taskId: idA, day: 'Saturday', ts: T - MAX_AGE_MS - 1 }, base, { today: 'Saturday', now: T }), 'stale');
  assert.equal(classifyEntry({ taskId: 'kzzz', day: 'Saturday', ts: T }, base, { today: 'Saturday', now: T }), 'missing');
  assert.equal(classifyEntry({ taskId: idA, day: 'Saturday', ts: T }, [{ ...base[0], completed: true }], { today: 'Saturday', now: T }), 'already-done');
  assert.equal(classifyEntry({ taskId: idA, day: 'Saturday', ts: T }, [{ ...base[0], completed: true, widgetEffectsPending: true }], { today: 'Saturday', now: T }), 'effects');

  // drain: same completion path once per task, duplicates acked, already-done skipped, failures kept for retry
  let tasks = fresh(base); const calls = [];
  const complete = async (id, mode) => { calls.push([id, mode]); const t = tasks.find((x) => widgetTaskId(x) === id); t.completed = true; return true; };
  const q = [{ taskId: idA, day: 'Saturday', ts: T - 3 }, { taskId: idA, day: 'Saturday', ts: T - 2 }, { taskId: idB, day: 'Saturday', ts: T - 1 }, { taskId: idB, day: 'Friday', ts: T }];
  let r = await drainQueue({ queue: q, getTasks: () => tasks, complete, today: 'Saturday', now: T });
  assert.deepEqual(calls, [[idA, 'complete'], [idB, 'complete']]);
  assert.equal(r.acked.length, 4); assert.equal(r.kept.length, 0);
  // idempotent: draining the same queue again (ack lost / app killed) never re-toggles
  r = await drainQueue({ queue: q, getTasks: () => tasks, complete, today: 'Saturday', now: T });
  assert.equal(calls.length, 2); assert.equal(r.acked.length, 4);
  // server already wrote completed + widgetEffectsPending -> app runs its path once in 'effects' mode
  tasks = [{ ...base[0], completed: true, widgetEffectsPending: true }];
  const c2 = []; r = await drainQueue({ queue: [q[0]], getTasks: () => tasks, complete: async (id, m) => { c2.push(m); tasks[0].widgetEffectsPending = false; return true; }, today: 'Saturday', now: T });
  assert.deepEqual(c2, ['effects']); assert.deepEqual(r.acked, [entryKey(q[0])]);
  // failure (e.g. not on today's tab / shut window) keeps the entry; a later duplicate still gets its chance
  tasks = fresh(base); let fails = 0;
  r = await drainQueue({ queue: [q[0], q[1]], getTasks: () => tasks, complete: async () => { fails++; return false; }, today: 'Saturday', now: T });
  assert.equal(fails, 2); assert.deepEqual(r.kept, [entryKey(q[0]), entryKey(q[1])]); assert.equal(r.acked.length, 0);
  r = await drainQueue({ queue: [q[0]], getTasks: () => tasks, complete: async () => { throw new Error('x'); }, today: 'Saturday', now: T });
  assert.deepEqual(r.kept, [entryKey(q[0])]);
  r = await drainQueue({ queue: null, getTasks: () => tasks, complete, today: 'Saturday', now: T });
  assert.deepEqual(r, { acked: [], kept: [], results: [] });
})();
console.log(`test-widget: ${n} groups passed`);
