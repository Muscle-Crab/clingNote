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
// ---- Fix 5: no "Done" without a tool result ----
ok(/Never say a change is done/.test(A.SYSTEM), 'prompt: never claim a change without a tool result');
const L = load('utils/assistantLoop.js');
ok(L.claimsChange('Done! Moved it to 3pm.') && !L.claimsChange('Want me to move it?') && !L.claimsChange('Your streak is 4.'), 'claimsChange');
const tk5 = { id: 'z5', title: 'ZZTEST essay' };
const ex5 = { snapshot: async () => ({ refs: { t1: 'z5' }, tasksByKey: new Map([['z5', tk5]]), today: TODAY, limitRemaining: 5, context: {} }), run: async (nm, a) => { ran5.push([nm, a]); return { ok: true, summary: 'x' }; } };
let ran5 = []; let seq = [{ text: 'Done, moved to 3pm for an hour.' }, { toolCalls: [{ name: 'edit_task', args: { ref: 't1', start: '3pm', durationMin: 60 } }] }, { text: 'Moved it to 15:00 for 60 min.' }];
let out = await L.runAgentTurn({ text: 'move essay to 3pm and make it an hour', call: async () => seq.shift(), executor: ex5, confirm: async () => true });
ok(ran5.length === 1 && ran5[0][1].patch.startTime === '15:00' && ran5[0][1].patch.estimateMin === 60 && /15:00/.test(out.reply), 'retry after a toolless Done runs the edit');
ran5 = []; seq = [{ text: 'Done!' }, { text: 'All set, done.' }];
out = await L.runAgentTurn({ text: 'move essay to 3pm', call: async () => seq.shift(), executor: ex5, confirm: async () => true });
ok(ran5.length === 0 && out.corrected && out.reply === L.NO_TOOL_FIX, 'second toolless Done is corrected');
seq = [{ text: 'Your streak is 4 days.' }]; out = await L.runAgentTurn({ text: 'streak?', call: async () => seq.shift(), executor: ex5, confirm: async () => true });
ok(out.reply === 'Your streak is 4 days.', 'plain answers untouched');
// ---- Fix 6: alarm + holiday tools, penalty in Firestore, write_calendar default false ----
v = T.validateCall('set_alarm', { time: '6am', title: 'ZZTEST wake' }, snap); ok(v.ok && v.args.time === '06:00' && v.args.date === TODAY, 'set_alarm 6am today');
v = T.validateCall('set_alarm', { time: 'later' }, snap); ok(!v.ok, 'set_alarm needs a time');
ok(!T.validateCall('set_alarm', { time: '07:00', date: '2000-01-01' }, snap).ok, 'set_alarm past date rejected');
const ex6 = createAssistantExecutor({ tasks: () => [], today: () => TODAY, pro: () => false, limitRemaining: async () => 5 });
ok(/iPhone app/.test((await ex6.run('set_alarm', { time: '06:00', date: TODAY, title: 'x' })).error), 'web fallback message for alarms');
let alarmArgs = null; const ex6b = createAssistantExecutor({ tasks: () => [], today: () => TODAY, pro: () => false, limitRemaining: async () => 5, setAlarm: async (a) => { alarmArgs = a; return { ok: true }; }, holiday: async (a) => ({ summary: `off ${a.from}..${a.to}`, days: 2 }) });
ok((await ex6b.run('set_alarm', { time: '06:00', date: TMR, title: 'ZZTEST wake' })).ok && alarmArgs.date === TMR, 'set_alarm runs the native dep');
v = T.validateCall('set_holiday', { from: TMR, to: TMR }, snap); ok(v.ok && T.needsConfirm('set_holiday', v.args) && /Take days off/.test(T.describeCall('set_holiday', v.args)), 'set_holiday validates + confirms');
ok(!T.validateCall('set_holiday', { from: TMR, to: TODAY }, snap).ok, 'set_holiday end before start rejected');
ok(!T.validateCall('set_holiday', { from: 'soon' }, snap).ok, 'set_holiday needs dates');
ok((await ex6b.run('set_holiday', { from: TMR, to: TMR })).days === 2, 'set_holiday runs the holiday dep');
ok(A.TOOL_NAMES.has('set_alarm') && A.TOOL_NAMES.has('set_holiday'), 'declarations include the new tools');
ok(T.validateCall('auto_schedule', {}, snap).args.writeCalendar === false && T.validateCall('auto_schedule', { write_calendar: 'yes' }, snap).args.writeCalendar === false && T.validateCall('auto_schedule', { write_calendar: true }, snap).args.writeCalendar === true, 'auto_schedule write_calendar defaults false');
const H = fs.readFileSync(path.join(__dirname, '../src/views/HomeView.vue'), 'utf8'); const eu = H.slice(H.indexOf('const emergencyUnlock = '), H.indexOf('\nconst ', H.indexOf('const emergencyUnlock = ') + 10));
ok(/lockPenalties: arrayUnion\(/.test(eu) && /'streaks', userId\.value/.test(eu), 'emergency unlock penalty stored in Firestore');
ok(/setAlarm: async/.test(H) && /clingAlarm\.scheduleOnce/.test(H.slice(H.indexOf('setAlarm: async'))) && /offRange\(from, to/.test(H), 'HomeView reuses clingAlarm + offRange/offDates');
// Fix 6b: startup reads the penalty from the account (Firestore), localStorage only as offline fallback, kept in sync
const L6 = load('utils/appLock.js');
let m = L6.mergePenalties([], [{ day: TODAY, points: 25, at: 5 }], 'u1'); ok(m.merged.length === 1 && L6.lastPenaltyDay(m.merged) === TODAY && m.toPush.length === 0, 'remote penalty applies on a fresh device');
m = L6.mergePenalties([{ day: TODAY, points: 25, at: 9, uid: 'u1' }], [], 'u1'); ok(m.merged.length === 1 && m.toPush.length === 1 && !('uid' in m.toPush[0]), 'offline local penalty kept + queued for upload');
m = L6.mergePenalties([{ day: TODAY, points: 25, at: 5, uid: 'u1' }], [{ day: TODAY, points: 25, at: 5 }], 'u1'); ok(m.merged.length === 1 && m.toPush.length === 0, 'same penalty deduped');
m = L6.mergePenalties([{ day: TODAY, points: 25, at: 7, uid: 'other' }], [], 'u1'); ok(m.merged.length === 0 && m.toPush.length === 0, 'another account\'s local penalty ignored');
m = L6.mergePenalties([{ day: '2026-01-01', at: 1 }], [{ day: TODAY, at: 2 }], 'u1'); ok(L6.lastPenaltyDay(m.merged) === TODAY, 'latest day wins');
const cs = H.slice(H.indexOf('const checkStreakOnCompletion'), H.indexOf('const checkStreakOnCompletion') + 600); const sp = H.slice(H.indexOf('const syncLockPenalties'), H.indexOf('const syncLockPenalties') + 900);
ok(/syncLockPenalties\(data\.lockPenalties\)/.test(cs) && /lockUnlockedDay\.value = lastPenaltyDay/.test(sp) && /localStorage\.setItem\(PENALTY_KEY/.test(sp) && /arrayUnion\(\.\.\.toPush\)/.test(sp), 'startup reads Firestore lockPenalties, syncs both ways');
console.log(`\n${n} assistant-fix tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
