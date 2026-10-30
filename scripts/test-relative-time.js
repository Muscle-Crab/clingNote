// Fix #4: "in 2 hours" must save a time, and the assistant confirms "done" only after the write succeeded.
const { load } = require('./lib/srcRequire');
const { parseClause, normalizeItems } = load('utils/voiceIntent.js');
const { runAgentTurn } = load('utils/assistantLoop.js');
(async () => {
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL', m); } };
const now = new Date(2026, 9, 30, 14, 0);
const cases = { 'remind me in 2 hours to call mom': '16:00', 'In 2h call mom': '16:00', 'in half an hour stretch': '14:30', 'call dad in an hour and a half': '15:30',
  'pay rent in 2 hours and 30 minutes': '16:30', 'in 90 min water plants': '15:30', 'in two and a half hours email Bo': '16:30', 'in 45 minutes take pills': '14:45' };
for (const [t, want] of Object.entries(cases)) { const r = parseClause(t, now); ok(r && r.start === want, `parseClause "${t}" -> ${r && r.start} want ${want}`); }
// AI item without a time: backfilled from the user's words
let n = normalizeItems([{ type: 'reminder', title: 'call mom' }], now, { userText: 'remind me in 2 hours to call mom' })[0];
ok(n.start === '16:00' && n.remindAt === '2026-10-30T16:00', 'reminder backfilled ' + JSON.stringify(n));
n = normalizeItems([{ type: 'task', title: 'gym' }], now, { userText: 'gym in 2 hours' })[0];
ok(n.start === '16:00' && n.date === '2026-10-30' && n.type === 'task', 'task backfilled ' + JSON.stringify(n));
n = normalizeItems([{ type: 'task', title: 'gym' }], new Date(2026, 9, 30, 23, 0), { userText: 'gym in 2 hours' })[0];
ok(n.date === '2026-10-31' && n.start === '01:00' && n.type === 'schedule', 'past midnight -> schedule tomorrow ' + JSON.stringify(n));
n = normalizeItems([{ type: 'task', title: 'gym', start: '18:00' }], now, { userText: 'gym in 2 hours' })[0];
ok(n.start === '18:00', 'explicit model time kept');
ok(normalizeItems([{ type: 'task', title: 'a' }, { type: 'task', title: 'b' }], now, { userText: 'a and b in 2 hours' }).every((x) => !x.start), 'multi-item not guessed');
// Assistant: "Done" only after a successful write
const turn = async (runResult, text) => { let step = 0; return runAgentTurn({ text: 'remind me in 2 hours to call mom', contents: [],
  call: async () => (step++ === 0 ? { parts: [{ text: 'x' }], toolCalls: [{ name: 'create_tasks', args: { items: [{ type: 'reminder', title: 'call mom' }] } }] } : { parts: [{ text }], text }),
  executor: { snapshot: async () => ({ refs: {}, context: {}, tasksByKey: new Map(), today: '2026-10-30', limitRemaining: 5 }), run: async () => { if (runResult instanceof Error) throw runResult; return runResult; } },
  confirm: async () => true }); };
let r = await turn({ ok: false, added: 0, failed: [{ title: 'call mom', error: 'offline' }] }, 'Done! Reminder set for 4pm.');
ok(!/done/i.test(r.reply) && /didn't save/.test(r.reply), 'failed write not confirmed: ' + r.reply);
r = await turn(new Error('Firestore unavailable'), 'All set!');
ok(/didn't save/.test(r.reply), 'thrown write not confirmed: ' + r.reply);
r = await turn({ ok: true, added: 1, summary: 'call mom at 16:00' }, 'Done! Reminder set for 4pm.');
ok(r.reply === 'Done! Reminder set for 4pm.', 'successful write confirmed');
r = await turn({ ok: false, failed: [{ title: 'call mom', error: 'offline' }] }, 'Sorry, that did not work because you are offline.');
ok(/offline/.test(r.reply), 'honest model text kept');
console.log(`relative-time: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
})();
