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
// ---- Fix 2: 12-hour times ----
ok(V.toHHMM('3pm') === '15:00' && V.toHHMM('5 PM') === '17:00' && V.toHHMM('3:30 p.m.') === '15:30' && V.toHHMM('12am') === '00:00' && V.toHHMM('12 pm') === '12:00' && V.toHHMM('09:05') === '09:05' && V.toHHMM('9:05') === '09:05', 'toHHMM parses 12h and 24h');
ok(V.toHHMM('13pm') === '' && V.toHHMM('25:00') === '' && V.toHHMM('soon') === '', 'toHHMM rejects junk');
v = T.validateCall('create_tasks', { items: [{ title: 'ZZTEST store', points: 10, start: '3pm' }, { title: 'ZZTEST call', type: 'reminder', remindAt: `${TODAY}T5 PM`, points: 5 }] }, snap);
ok(v.ok && v.args.items[0].start === '15:00' && v.args.items[1].remindAt === `${TODAY}T17:00`, 'create_tasks keeps 3pm / 5 PM');
const tk = { id: 'z1', title: 'ZZTEST t' }; const s2 = { ...snap, refs: { t1: 'z1' }, tasksByKey: new Map([['z1', tk]]) };
v = T.validateCall('edit_task', { ref: 't1', start: '5 PM' }, s2); ok(v.ok && v.args.patch.startTime === '17:00', 'edit_task start 5 PM');
v = T.validateCall('reschedule_task', { ref: 't1', time: '3pm' }, s2); ok(v.ok && v.args.time === '15:00', 'reschedule_task time 3pm');
// ---- Fix 3: "in 2 hours" is a timed item, not place_reminder ----
v = T.validateCall('place_reminder', { title: 'ZZTEST stretch', place: 'in 2 hours' }, snap); ok(!v.ok && /create_tasks/.test(v.error), 'place "in 2 hours" rejected');
v = T.validateCall('place_reminder', { title: 'ZZTEST stretch', place: 'home' }, { ...snap, userText: 'remind me to stretch in 2 hours' }); ok(!v.ok, 'relative-time utterance rejects place_reminder');
v = T.validateCall('place_reminder', { title: 'ZZTEST milk', place: 'store' }, { ...snap, userText: 'remind me to buy milk when I get to the store' }); ok(v.ok, 'real place reminder still works');
ok(/never place_reminder/.test(A.SYSTEM), 'prompt: in N hours is not place_reminder');
// ---- Fix 4: call the tool (the app confirms), never ask for duration or points ----
ok(/CALL the tool right away/.test(A.SYSTEM) && /app_lock \(emergency_unlock\)/.test(A.SYSTEM), 'prompt: confirm tools are called, not asked');
ok(/Never ask the user for a duration or points/.test(A.SYSTEM) && /repeat \(weekdays/.test(A.SYSTEM), 'prompt: weekday tasks + no duration/points questions');
ok(/call app_lock/.test(A.SYSTEM), 'prompt: app_lock is called');
v = T.validateCall('create_tasks', { items: [{ title: 'ZZTEST gym', start: '07:00', repeat: 'weekdays', points: 30 }] }, snap); ok(v.ok && v.args.items[0].repeat, 'weekday task validates without duration');
ok(T.needsConfirm('delete_task', {}) && T.needsConfirm('app_lock', { action: 'emergency_unlock' }), 'app still confirms delete / emergency unlock');
//__MORE__
console.log(`\n${n} assistant-fix tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
