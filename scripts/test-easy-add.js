// Easy-add + day planning: Siri queue, "N more not shown", Plan my day, day templates, assistant future-dated create.
// Run: node scripts/test-easy-add.js
const assert = require('assert');
const { load } = require('./lib/srcRequire');
const Q = load('utils/intentQueue.js');
const C = load('utils/listCoverage.js');
const P = load('utils/dayPlan.js');
const D = load('utils/dayTemplates.js');
const T = load('utils/assistantTools.js');
const { createAssistantExecutor } = load('utils/assistantExecutor.js');
const { taskKey } = load('utils/taskPlanning.js');
let n = 0; const t = async (name, f) => { await f(); n++; console.log('ok', name); };
const LOCAL_TODAY = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

(async () => {
  // ---- 1. Siri / Shortcuts queue ----
  await t('siri item reads `start` (what Swift writes) and legacy `time`', () => {
    assert.deepStrictEqual(Q.intentToItem({ title: ' Buy  milk ', ts: 5, start: '09:30' }), { id: '5|Buy milk', title: 'Buy milk', ts: 5, start: '09:30' });
    assert.strictEqual(Q.intentToItem({ title: 'x', time: '14:05' }).start, '14:05');
    assert.ok(!('start' in Q.intentToItem({ title: 'x', start: '25:00' })));
    assert.strictEqual(Q.intentToItem({ title: '   ' }), null); assert.strictEqual(Q.intentToItem(null), null);
  });
  await t('siri buffer keeps items across drains, deduped', () => {
    const s = mem(); Q.writeBuffer(s, Q.mergeIntents([], [{ title: 'A', ts: 1 }, { title: 'A', ts: 1 }, { title: 'B', ts: 2 }]));
    const b = Q.mergeIntents(Q.readBuffer(s), [{ title: 'B', ts: 2 }, { title: 'C', ts: 3, start: '08:00' }]);
    assert.deepStrictEqual(b.map((x) => x.title), ['A', 'B', 'C']);
    Q.writeBuffer(s, []); assert.deepStrictEqual(Q.readBuffer(s), []);
    assert.deepStrictEqual(Q.intentCreateArgs(b[2]), { items: [{ title: 'C', start: '08:00' }] });
  });
  await t('siri outcome: saved / limit dropped / transient retried (bounded)', () => {
    assert.strictEqual(Q.intentOutcome({ validated: { ok: true }, result: { ok: true, added: 1 } }), 'done');
    assert.strictEqual(Q.intentOutcome({ validated: { ok: false, error: 'Daily limit' } }), 'drop');
    assert.strictEqual(Q.intentOutcome({ validated: { ok: true }, result: { ok: false, failed: [{ error: 'Daily limit reached (5/day).' }] } }), 'drop');
    assert.strictEqual(Q.intentOutcome({ validated: { ok: true }, result: { ok: false, failed: [{ error: 'not saved' }] } }), 'retry');
    assert.strictEqual(Q.intentOutcome({ error: new Error('offline') }), 'retry');
    let it = { title: 'x', id: 'x' }; for (let i = 0; i < Q.MAX_TRIES; i++) it = Q.bumpTries(it); assert.ok(Q.outOfTries(it));
  });
  await t('siri end to end: queue item -> validateCall -> executor -> addTask gets title + start', async () => {
    const got = [];
    const ex = createAssistantExecutor({ tasks: () => [], today: () => LOCAL_TODAY, pro: () => false, limitRemaining: async () => 5, addTask: async (it) => { got.push(it); return { ok: true }; } });
    const it = Q.mergeIntents([], [{ title: 'Call dentist', ts: 9, start: '10:15' }])[0];
    const snap = await ex.snapshot(); const v = T.validateCall('create_tasks', Q.intentCreateArgs(it), snap); assert.ok(v.ok);
    const r = await ex.run('create_tasks', v.args);
    assert.strictEqual(Q.intentOutcome({ validated: v, result: r }), 'done');
    assert.strictEqual(got[0].title, 'Call dentist'); assert.strictEqual(got[0].start, '10:15'); assert.strictEqual(got[0].date, LOCAL_TODAY);
  });
  await t('robot assistant: future-dated create passes the date through, not counted against today', async () => {
    const got = [];
    const ex = createAssistantExecutor({ tasks: () => [], today: () => LOCAL_TODAY, pro: () => false, limitRemaining: async () => 0, addTask: async (it) => { got.push(it); return { ok: true }; } });
    const snap = await ex.snapshot();
    const v = T.validateCall('create_tasks', { items: [{ title: 'Dentist', date: '2099-11-16', start: '09:00' }] }, snap); assert.ok(v.ok, 'today full but future day allowed');
    const r = await ex.run('create_tasks', v.args); assert.ok(r.ok);
    assert.strictEqual(got[0].date, '2099-11-16'); assert.strictEqual(got[0].start, '09:00');
    assert.ok(!T.validateCall('create_tasks', { items: [{ title: 'Today one' }] }, snap).ok, 'today item refused when limit is 0');
  });

  // ---- 2. "N more not shown" ----
  const day = [{ title: 'a', createdAt: '1' }, { title: 'b', createdAt: '2', completed: true }, { title: 'c', createdAt: '3', completed: true }, { title: 'd', createdAt: '4', status: 'waiting' }];
  await t('coverage: only filter-hidden tasks count (completed have their own Done toggle)', () => {
    const all = C.listCoverage({ dayTasks: day, displayTasks: day, isToday: true, showCompleted: false });
    assert.strictEqual(all.hidden, 0); assert.strictEqual(all.label, ''); assert.strictEqual(all.completed, 2);
    const filtered = day.filter((x) => x.completed || x.status === 'waiting');
    const f = C.listCoverage({ dayTasks: day, displayTasks: filtered, isToday: true, showCompleted: false });
    assert.strictEqual(f.hidden, 1); assert.strictEqual(f.label, '1 more not shown · tap to see'); assert.ok(f.why.includes('1 filtered out'));
    const other = C.listCoverage({ dayTasks: day, displayTasks: [day[0]], isToday: false });
    assert.strictEqual(other.hidden, 3, 'filter hides on other days too');
  });
  await t('13 tasks -> 13 unique render keys even with duplicate createdAt|title', () => {
    const list = Array.from({ length: 11 }, (_, i) => ({ title: `T${i}`, createdAt: String(i) }));
    list.push({ title: 'Gym', createdAt: '' }, { title: 'Gym', createdAt: '' });
    const keys = C.uniqueRenderKeys(list, taskKey);
    assert.strictEqual(keys.length, 13); assert.strictEqual(new Set(keys).size, 13);
    assert.strictEqual(keys[11], '|Gym'); assert.strictEqual(keys[12], '|Gym#2');
  });

  // ---- 3. Plan my day ----
  const today = [{ title: 'Write report', estimateMin: 90, priority: 'high' }, { title: 'Email', estimateMin: 15 }, { title: 'Gym', estimateMin: 60, startTime: '18:00' },
    { title: 'Standup', estimateMin: 15, startTime: '09:30' }, { title: 'Done already', completed: true }, { title: 'Huge', estimateMin: 600 }];
  await t('plan refuses without the user-chosen start AND hours (no silent defaults)', () => {
    assert.strictEqual(P.planDay(today, {}).ok, false);
    assert.strictEqual(P.planDay(today, { start: '09:00' }).ok, false);
    assert.strictEqual(P.planDay(today, { hours: 4 }).ok, false);
    assert.strictEqual(P.planDay(today, { start: '9am', hours: 4 }).ok, false);
    assert.strictEqual(P.planDay(today, { start: '09:00', hours: '' }).ok, false);
  });
  await t('plan fits open tasks inside the window, keeps in-window times, no overlaps', () => {
    const p = P.planDay(today, { start: '09:00', hours: 4 });
    assert.ok(p.ok); assert.strictEqual(p.start, '09:00'); assert.strictEqual(p.end, '13:00');
    const m = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    for (const x of p.slots) { assert.ok(m(x.start) >= m('09:00') && m(x.end) <= m('13:00'), `${x.task.title} in window`); }
    const sorted = [...p.slots].sort((a, b) => m(a.start) - m(b.start)); for (let i = 1; i < sorted.length; i++) assert.ok(m(sorted[i].start) >= m(sorted[i - 1].end), 'no overlap');
    assert.ok(p.slots.find((x) => x.task.title === 'Standup' && x.start === '09:30' && !x.changed), 'in-window time kept');
    assert.ok(p.slots.find((x) => x.task.title === 'Gym' && x.changed), '18:00 is outside 09-13 so Gym gets a new slot');
    assert.ok(!p.slots.find((x) => x.task.title === 'Done already'));
    assert.deepStrictEqual(p.unplaced.map((x) => x.title), ['Huge']);
    assert.ok(p.slots.find((x) => x.task.title === 'Write report'), 'long high-priority task placed');
    const ch = P.planChanges(p); assert.ok(ch.every((c) => c.startTime && c.task.title !== 'Standup'));
    assert.strictEqual(P.planChanges({ ok: false }).length, 0);
  });

  // ---- 4. Day templates ----
  await t('template saves the day (names, dedupe, optional times)', () => {
    assert.strictEqual(D.makeTemplate('', today).ok, false);
    assert.strictEqual(D.makeTemplate('X', []).ok, false);
    const a = D.makeTemplate('Workday', [...today, { title: 'email ' }, { title: 'Skip', status: 'wontdo' }], { now: 1000 });
    assert.ok(a.ok); assert.strictEqual(a.template.items.length, 6); assert.ok(a.template.items.every((i) => !i.start));
    const b = D.makeTemplate('Workday', today, { withTimes: true, now: 2000 }); assert.strictEqual(b.template.items.find((i) => i.title === 'Gym').start, '18:00');
    const list = D.upsertTemplate(D.upsertTemplate([], a.template), { ...b.template, name: 'workday' });
    assert.strictEqual(list.length, 1, 'same name replaces'); assert.strictEqual(D.removeTemplate(list, list[0].id).length, 0);
    assert.deepStrictEqual(D.cleanTemplates(JSON.parse(JSON.stringify(list))), list);
    assert.deepStrictEqual(D.cleanTemplates('junk'), []);
  });
  await t('apply adds missing tasks only and skips duplicates', () => {
    const tpl = D.makeTemplate('Morning', [{ title: 'Meditate' }, { title: 'Email', estimateMin: 15 }, { title: 'Read', startTime: '07:00' }], { withTimes: true }).template;
    const r = D.applyTemplate(tpl, [{ title: 'email!' }, { title: 'Other' }]);
    assert.deepStrictEqual(r.toAdd.map((x) => x.title), ['Meditate', 'Read']); assert.deepStrictEqual(r.skipped, ['Email']);
    assert.strictEqual(r.toAdd[1].start, '07:00');
    assert.strictEqual(D.applyTemplate(tpl, [{ title: 'Meditate' }, { title: 'Email' }, { title: 'Read' }]).toAdd.length, 0, 'second apply same morning adds nothing');
    assert.strictEqual(D.applySummary({ added: 2, skipped: 1, blocked: 1 }), 'Added 2 tasks · 1 already on today · 1 not added (daily limit)');
  });
  await t('template items go through the assistant create path', async () => {
    const tpl = D.makeTemplate('M', [{ title: 'Read', startTime: '07:00', estimateMin: 20, priority: 'high' }], { withTimes: true }).template;
    const ex = createAssistantExecutor({ tasks: () => [], today: () => LOCAL_TODAY, pro: () => false, limitRemaining: async () => 5, addTask: async (it) => ({ ok: !!it.title && it.start === '07:00' && it.durationMin === 20 && it.priority === 'high' }) });
    const v = T.validateCall('create_tasks', { items: [D.applyTemplate(tpl, []).toAdd[0]] }, await ex.snapshot()); assert.ok(v.ok);
    assert.ok((await ex.run('create_tasks', v.args)).ok);
  });
  console.log(`test-easy-add: ${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
