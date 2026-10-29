// Assistant bug fixes (feat/assistant-fixes): dates, 12h times, relative times, tool-first prompt rules, "done" without a tool call, alarms, holiday range.
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const { load } = require('./lib/srcRequire');
const T = load('utils/assistantTools.js'); const V = load('utils/voiceIntent.js'); const Q = load('utils/intentQueue.js');
const { createAssistantExecutor } = load('utils/assistantExecutor.js');
const A = require('../netlify/functions/lib/agentTools.js');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok -', m); };
const pad = (x) => String(x).padStart(2, '0'); const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = ymd(new Date()); const TMR = ymd(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1));
const snap = { refs: {}, tasksByKey: new Map(), today: TODAY, limitRemaining: 5 };
(async () => {
// ---- Fix 1: tomorrow / weekday dates ----
ok(V.namesOtherDay('ZZTEST call the bank tomorrow') && V.namesOtherDay('gym on Friday') && !V.namesOtherDay('buy milk'), 'namesOtherDay');
let v = T.validateCall('create_tasks', { items: [{ title: 'ZZTEST bank', points: 10 }] }, { ...snap, userText: 'call the bank tomorrow' });
ok(!v.ok && /Missing date/.test(v.error), 'tomorrow with no date -> error, not today');
v = T.validateCall('create_tasks', { items: [{ title: 'ZZTEST bank', points: 10, type: 'schedule', date: TMR, start: '10:00' }] }, { ...snap, userText: 'call the bank tomorrow' });
ok(v.ok && v.args.items[0].date === TMR, 'tomorrow with a date keeps it');
v = T.validateCall('create_tasks', { items: [{ title: 'ZZTEST milk', points: 10 }] }, { ...snap, userText: 'buy milk' });
ok(v.ok && v.args.items[0].date === TODAY, 'no day named -> today default still');
const c = T.buildContext({ now: new Date(2026, 9, 29, 19, 0) }).context;
ok(c.weekday === 'Thursday' && c.tomorrow === '2026-10-30', 'context has weekday + tomorrow');
ok(/ALWAYS set date/.test(A.SYSTEM), 'prompt: always set the date');
ok(Q.intentToItem({ title: 'ZZTEST x', ts: 1, start: '15:00', date: TMR }).date === TMR, 'intentToItem keeps date');
ok(JSON.stringify(Q.intentCreateArgs({ title: 'X', start: '15:00', date: TMR }, TODAY)) === JSON.stringify({ items: [{ title: 'X', start: '15:00', date: TMR, type: 'schedule' }] }), 'intent later date -> schedule');
ok(!('type' in Q.intentCreateArgs({ title: 'X', start: '15:00', date: TODAY }, TODAY).items[0]), 'intent today -> plain');
ok(/item\["date"\]/.test(fs.readFileSync(path.join(__dirname, '../ios/App/App/ClingIntents.swift'), 'utf8')), 'Swift queues the date');
const ex = createAssistantExecutor({ tasks: () => [], today: () => TODAY, pro: () => false, limitRemaining: async () => 5, addTask: async () => ({ ok: true }) });
const r = await ex.run('create_tasks', { items: [{ title: 'ZZTEST bank', date: TMR, start: '10:00', points: 10 }] });
ok(r.summary.includes(`on ${TMR}`) && r.summary.includes('at 10:00'), 'confirm chip shows date');
//__MORE__
console.log(`\n${n} assistant-fix tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
