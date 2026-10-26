// ClingNote assistant client logic: tool validation, AI points, daily limit, confirm gating, the tool loop, executor mapping, spoken yes/no.
const assert = require('assert');
const { load } = require('./lib/srcRequire');
const T = load('utils/assistantTools.js');
const { runAgentTurn, trimContents, MAX_STEPS } = load('utils/assistantLoop.js');
const { createAssistantExecutor } = load('utils/assistantExecutor.js');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const tasks = [{ id: 'a', title: 'Write report', estimateMin: 90, points: 60 }, { id: 'b', title: 'Call mom', completed: true }];
const snapOf = (limitRemaining = 5) => { const b = T.buildContext({ tasks }); return { refs: b.refs, context: b.context, tasksByKey: new Map(tasks.map((t) => [T.taskKeyOf(t), t])), today: '2026-10-26', limitRemaining }; };
(async () => {
  // context refs
  const s = snapOf();
  ok(s.context.tasks[0].ref === 't1' && s.context.tasks[0].points === 60 && s.refs.t2 === 'b', 'context refs + points');
  // create: dynamic points from Gemini, clamped; estimator fallback when missing
  let v = T.validateCall('create_tasks', { items: [{ title: 'Deep work on thesis', durationMin: 120, points: 999, complexity: 9 }, { title: 'Buy milk' }] }, s);
  ok(v.ok && v.args.items[0].points === 150 && v.args.items[0].complexity === 5, 'AI points clamped to 5..150, complexity 1..5');
  ok(v.args.items[1].points >= 5 && v.args.items[1].points < v.args.items[0].points, 'no AI points -> estimator (not a flat 10)');
  ok(T.pointsForItem({ title: 'Quick email', durationMin: 5 }).points < T.pointsForItem({ title: 'Quick email', durationMin: 180 }).points, 'estimator scales with effort');
  ok(T.clampPoints(0) === 0 && T.clampPoints(3) === 5 && T.clampPoints('42') === 42, 'clampPoints');
  // daily limit: 5/day, reminders do not count
  v = T.validateCall('create_tasks', { items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] }, snapOf(2));
  ok(!v.ok && v.limit && /only 2 more/.test(v.error), 'over the daily limit -> refused with remaining count');
  ok(T.validateCall('create_tasks', { items: [{ title: 'x' }] }, snapOf(1)).ok, 'within limit ok');
  ok(!T.validateCall('create_tasks', { items: [] }, s).ok, 'no items refused');
  // edit: voice override of points
  v = T.validateCall('edit_task', { ref: 't1', points: 80 }, s);
  ok(v.ok && v.args.patch.points === 80 && v.args.patch.pointsSource === 'ai' && v.args.task.id === 'a', 'points override by voice');
  ok(!T.validateCall('edit_task', { ref: 't9', title: 'x' }, s).ok, 'unknown ref refused');
  ok(!T.validateCall('edit_task', { ref: 't1' }, s).ok, 'empty patch refused');
  // reschedule
  ok(!T.validateCall('reschedule_task', { ref: 't1', date: '2026-10-01' }, s).ok, 'past date refused');
  v = T.validateCall('reschedule_task', { ref: 't1', date: '2026-10-26', time: '15:00' }, s);
  ok(v.ok && v.args.date === '' && v.args.time === '15:00', 'today -> time move only');
  ok(!T.validateCall('complete_task', { ref: 't2' }, s).ok, 'already done refused');
  // hours: user's own setting, clamped
  ok(T.validateCall('set_day_hours', { hours: 20 }, s).args.hours === 12 && !T.validateCall('start_day', {}, s).ok, 'hours clamped; start_day needs hours');
  ok(T.validateCall('navigate', { page: 'rankings' }, s).args.path === '/rankings' && !T.validateCall('navigate', { page: 'evil' }, s).ok, 'navigate whitelist');
  ok(!T.validateCall('post_to_community', { text: '   ' }, s).ok && T.validateCall('post_to_community', { text: 'Crushed it today' }, s).ok, 'community text validated');
  ok(!T.validateCall('drop_db', {}, s).ok, 'unknown tool refused');
  ok(['delete_task', 'complete_task', 'start_day', 'post_to_community'].every((n) => T.CONFIRM_TOOLS.has(n)) && !T.CONFIRM_TOOLS.has('create_tasks'), 'confirm set');
  // spoken yes/no
  ok(T.spokenConfirm('Yes please') === 'yes' && T.spokenConfirm('yeah go ahead') === 'yes' && T.spokenConfirm('No.') === 'no' && T.spokenConfirm('cancel that') === 'no' && T.spokenConfirm('what?') === null, 'spokenConfirm');
  ok(T.ttsText('One. Two! Three.') === 'One. Two!' && T.ttsText('**Bold** text.') === 'Bold text.', 'tts: first 2 sentences, markdown stripped');

  // loop: delete needs confirm; declined -> not executed; executed after yes
  const mkCall = (script) => { const seen = []; const f = async (input) => { seen.push(JSON.parse(JSON.stringify(input))); return script.shift(); }; f.seen = seen; return f; };
  const ran = [];
  const executor = { snapshot: async () => snapOf(), run: async (n, a) => { ran.push([n, a]); return { ok: true }; } };
  let call = mkCall([{ parts: [{ functionCall: { name: 'delete_task', args: { ref: 't1' } }, thoughtSignature: 's1' }], toolCalls: [{ name: 'delete_task', args: { ref: 't1', confirmed: true } }], remaining: 9 }, { parts: [{ text: 'Okay, kept it.' }], toolCalls: [], text: 'Okay, kept it.' }]);
  let asked = [];
  let r = await runAgentTurn({ text: 'delete the report', contents: [], call, executor, confirm: async (c) => { asked.push(c); return false; } });
  ok(asked.length === 1 && /Delete "Write report"/.test(asked[0].summary) && ran.length === 0, 'delete waits for confirm; "confirmed" arg ignored; no means nothing ran');
  ok(r.reply === 'Okay, kept it.' && r.remaining === 9, 'reply + remaining');
  const fr = call.seen[1].contents[call.seen[1].contents.length - 1].parts[0].functionResponse;
  ok(fr.name === 'delete_task' && fr.response.declined, 'declined fed back to the model');
  ok(call.seen[1].contents[1].parts[0].thoughtSignature === 's1' && call.seen[1].step === 1, 'model parts kept verbatim, step counted');
  call = mkCall([{ parts: [{ functionCall: { name: 'delete_task', args: { ref: 't1' } } }], toolCalls: [{ name: 'delete_task', args: { ref: 't1' } }] }, { parts: [{ text: 'Deleted.' }], text: 'Deleted.' }]);
  r = await runAgentTurn({ text: 'delete it', contents: [], call, executor, confirm: async () => true });
  ok(ran.length === 1 && ran[0][0] === 'delete_task' && ran[0][1].task.id === 'a', 'yes -> executed');
  // create runs without confirm; limit errors fed back
  ran.length = 0;
  call = mkCall([{ parts: [{ functionCall: { name: 'create_tasks', args: {} } }], toolCalls: [{ name: 'create_tasks', args: { items: [1, 2, 3, 4, 5, 6].map((i) => ({ title: `t${i}` })) } }] }, { parts: [{ text: 'Limit.' }], text: 'Limit.' }]);
  r = await runAgentTurn({ text: 'add six', contents: [], call, executor: { ...executor, snapshot: async () => snapOf(5) }, confirm: async () => { throw new Error('no confirm for create'); } });
  ok(ran.length === 0 && call.seen[1].contents.at(-1).parts[0].functionResponse.response.limitReached, 'limit refusal reaches the model');
  // step cap
  const loopy = { parts: [{ functionCall: { name: 'get_overview', args: {} } }], toolCalls: [{ name: 'get_overview', args: {} }] };
  call = mkCall([...Array(MAX_STEPS + 2)].map(() => loopy));
  r = await runAgentTurn({ text: 'loop', contents: [], call, executor, confirm: async () => true });
  ok(call.seen.length === MAX_STEPS + 1 && r.reply, 'stops at MAX_STEPS');
  // trim history keeps a user text turn first
  const long = [...Array(40)].flatMap((_, i) => [{ role: 'user', parts: [{ text: `q${i}` }] }, { role: 'model', parts: [{ functionCall: { name: 'x' } }] }, { role: 'user', parts: [{ functionResponse: { name: 'x', response: {} } }] }]);
  const tr = trimContents(long, 30);
  ok(tr.length <= 30 && tr[0].role === 'user' && typeof tr[0].parts[0].text === 'string', 'trimContents');

  // executor maps tools onto the app handlers
  const log = [];
  const ex = createAssistantExecutor({ tasks: () => tasks, today: () => '2026-10-26', pro: () => false, limitRemaining: async () => 3, stats: () => ({ hours: 6 }),
    addTask: async (it) => { log.push(['add', it]); return it.title === 'bad' ? { ok: false, error: 'Daily limit reached (5/day).', limit: true } : { ok: true }; },
    deleteTask: async (t) => { log.push(['del', t.id]); return true; }, editTask: async (t, p) => log.push(['edit', t.id, p]), reschedule: async (t, x) => log.push(['move', t.id, x]),
    complete: async (t) => log.push(['done', t.id]), startTimer: async (t, m) => log.push(['timer', t.id, m]), bossCheckin: async (t, on) => log.push(['boss', t.id, on]),
    startDay: async (h) => { log.push(['start', h]); return { target: 120 }; }, setHours: async (h) => log.push(['hours', h]), setSetting: async (k, on) => log.push(['set', k, on]),
    navigate: async (p) => log.push(['nav', p]),
    weekStats: async () => ({ streak: 3, completionRate: 50 }), findTasks: async (q) => [{ title: 'Dentist', day: 'Friday', q }], suggestNext: async () => ({ task: { title: 'Store', startTime: '18:00', points: 10 }, reason: 'due' }),
    snooze: async (t, m) => { log.push(['snooze', t.id, m]); return { time: '18:00' }; }, addSubtasks: async (t, items) => log.push(['subs', t.id, items]), post: async (a) => { log.push(['post', a.text]); return { ok: true }; } });
  const sn = await ex.snapshot();
  ok(sn.limitRemaining === 3 && sn.context.limit.remainingToday === 3 && sn.context.hoursToday === 6, 'snapshot: limit + hours');
  let out = await ex.run('create_tasks', { items: [{ title: 'Gym', points: 40, complexity: 3 }, { title: 'bad' }, { title: 'never' }] });
  ok(log.filter((l) => l[0] === 'add').length === 2 && log[0][1].points === 40 && !out.ok && out.added === 1 && out.failed[0].title === 'bad', 'create: AI points passed through, stops at the limit');
  out = await ex.run('start_day', { hours: 7 }); ok(out.target === 120 && log.some((l) => l[0] === 'start' && l[1] === 7), 'start_day uses the user hours');
  await ex.run('set_day_hours', { hours: 9 }); ok(log.some((l) => l[0] === 'hours' && l[1] === 9), 'set_day_hours -> the one hours setting');
  await ex.run('delete_task', { task: tasks[0] }); ok(log.some((l) => l[0] === 'del'), 'delete mapped');
  out = await ex.run('get_overview', {}); ok(out.overview && out.overview.tasks.length === 2, 'overview');
  // extras
  ok((await ex.run('get_stats', {})).stats.streak === 3, 'get_stats');
  ok((await ex.run('find_tasks', { query: 'dentist' })).found[0].title === 'Dentist', 'find_tasks');
  ok((await ex.run('suggest_next', {})).next === 'Store', 'suggest_next');
  out = await ex.run('snooze_task', { task: tasks[0], minutes: 30 }); ok(out.ok && log.some((l) => l[0] === 'snooze' && l[2] === 30), 'snooze_task');
  await ex.run('add_subtasks', { task: tasks[0], items: ['a', 'b'] }); ok(log.some((l) => l[0] === 'subs' && l[2].length === 2), 'add_subtasks');
  const ctx2 = { refs: { t1: T.taskKeyOf(tasks[0]) }, tasksByKey: new Map([[T.taskKeyOf(tasks[0]), tasks[0]]]), today: '2026-10-26' };
  ok(!T.validateCall('snooze_task', { ref: 't1', minutes: 0 }, ctx2).ok && T.validateCall('snooze_task', { ref: 't1', minutes: 30 }, ctx2).ok, 'snooze validation');
  ok(T.validateCall('add_subtasks', { ref: 't1', items: [' x ', '', 'y'] }, ctx2).args.items.join() === 'x,y', 'subtasks validation');
  ok(!T.validateCall('find_tasks', {}, ctx2).ok && T.READ_TOOLS.has('find_tasks') && !T.CONFIRM_TOOLS.has('snooze_task'), 'find/read tools');
  const rec = T.validateCall('create_tasks', { items: [{ title: 'Run', start: '07:00', repeat: 'weekdays', points: 20 }] }, ctx2);
  ok(rec.ok && rec.args.items[0].type === 'schedule' && rec.args.items[0].repeat === 'weekly' && rec.args.items[0].days.join() === '1,2,3,4,5' && rec.args.items[0].date === '2026-10-26', 'recurring create');
  ok(!T.needsConfirm('create_tasks', { items: [{}, {}] }) && T.needsConfirm('create_tasks', { items: [{}, {}, {}] }) && T.needsConfirm('roll_unfinished') && T.needsConfirm('auto_schedule')
    && !T.needsConfirm('app_lock', { action: 'status' }) && T.needsConfirm('app_lock', { action: 'emergency_unlock' }), 'brain dump / rollover / emergency unlock need confirm');
  ok(/3\. C/.test(T.describeCall('create_tasks', { items: [{ title: 'A' }, { title: 'B', start: '18:00' }, { title: 'C' }] })), 'brain dump review lists every item');
  ok(T.validateCall('log_habit', { name: 'water' }).ok && !T.validateCall('place_reminder', { title: 'milk' }).ok && !T.validateCall('app_lock', { action: 'x' }).ok && T.validateCall('auto_schedule', { write_calendar: true }).args.writeCalendar === true, 'new tool validation');
  console.log(`test-assistant: ${pass} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
