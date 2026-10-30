// Per-task app unlock state machine (src/utils/taskAppUnlock.js) + native wiring checks.
import assert from 'assert';
import fs from 'fs';
import { planTaskUnlock, desiredAllowance, taskAppsRowLabel } from '../src/utils/taskAppUnlock.js';
import { widgetTaskId } from '../src/utils/widgetSnapshot.js';
import { focusActivityState } from '../src/utils/focusActions.js';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const now = Date.UTC(2026, 9, 30, 15, 0);
const iso = (d) => new Date(now + d).toISOString();
const T = (o = {}) => ({ id: 'zztest-task-1', title: 'ZZTEST edit video', completed: false, ...o });
const id = widgetTaskId(T());
const counts = { [id]: 1 };
const run = (o = {}) => T({ timerActive: true, timerStartedAt: iso(0), timerEndTime: iso(30 * 60000), ...o });
// start -> allow until the timer end
let p = planTaskUnlock(null, [run()], { appCounts: counts, now });
ok(p.cmd === 'allow' && p.taskId === id && p.untilMs === now + 30 * 60000, 'start -> allow until timer end');
let cur = { taskId: id, untilMs: p.untilMs };
ok(planTaskUnlock(cur, [run()], { appCounts: counts, now: now + 60000 }).cmd === null, 'running -> no churn');
// complete -> re-lock
ok(planTaskUnlock(cur, [run({ completed: true })], { appCounts: counts, now: now + 60000 }).cmd === 'end', 'complete -> end');
// end early (timer cleared)
ok(planTaskUnlock(cur, [T({ timerActive: false, timerEndTime: null })], { appCounts: counts, now }).cmd === 'end', 'end early -> end');
// pause -> re-lock; resume -> allow to new end
ok(planTaskUnlock(cur, [run({ timerPausedAt: iso(60000) })], { appCounts: counts, now: now + 60000 }).cmd === 'end', 'pause -> end');
p = planTaskUnlock(null, [run({ timerEndTime: iso(35 * 60000) })], { appCounts: counts, now: now + 5 * 60000 }); ok(p.cmd === 'allow' && p.untilMs === now + 35 * 60000, 'resume -> allow to new end');
// timer expiry: native already ended (current null after expireIfNeeded) or stale current -> end, never re-allow
ok(planTaskUnlock(cur, [run()], { appCounts: counts, now: now + 31 * 60000 }).cmd === 'end', 'timer expiry -> end');
ok(planTaskUnlock(null, [run()], { appCounts: counts, now: now + 29.5 * 60000 }).cmd === null, '<1 min left -> no new allowance');
// app relaunch: native state survived the kill; same task still running -> in sync; task finished while killed -> end
ok(planTaskUnlock(cur, [run()], { appCounts: counts, now: now + 10 * 60000 }).why === 'in sync', 'relaunch, still running -> keep');
ok(planTaskUnlock(cur, [run({ completed: true })], { appCounts: counts, now: now + 10 * 60000 }).cmd === 'end', 'relaunch, completed while killed -> end');
ok(planTaskUnlock(null, [run()], { appCounts: counts, now: now + 10 * 60000 }).cmd === 'allow', 'relaunch, native lost state -> re-allow');
// no apps picked -> nothing; another task takes over -> switch
ok(planTaskUnlock(null, [run()], { appCounts: {}, now }).cmd === null, 'no apps -> idle');
const other = T({ id: 'zztest-task-2', title: 'ZZTEST other', timerActive: true, timerEndTime: iso(20 * 60000) });
ok(planTaskUnlock(cur, [other], { appCounts: { ...counts, [widgetTaskId(other)]: 2 }, now }).cmd === 'allow', 'switch task -> allow other');
ok(planTaskUnlock(cur, [other], { appCounts: counts, now }).cmd === 'end', 'other task without apps -> end');
// gate refuses (strict Discipline / boss) -> never allow, explain
const g = desiredAllowance([run()], { appCounts: counts, now, gate: { refuse: 'Boss check-in first.' } });
ok(!g.want && g.reason === 'gate', 'gate refuses');
ok(planTaskUnlock(cur, [run()], { appCounts: counts, now, gate: { refuse: 'x' } }).cmd === 'end', 'gate -> end live allowance');
// labels + lock-screen count
ok(/1 app unlocked for this task/.test(taskAppsRowLabel(1, { active: true })) && /none/.test(taskAppsRowLabel(0)) && /2 apps/.test(taskAppsRowLabel(2)), 'row labels');
const st = focusActivityState(run(), { now, appsUnlocked: 2 }); ok(st.appsUnlocked === 2, 'live activity carries appsUnlocked');
// native wiring
const sh = fs.readFileSync('ios/App/Shared/LockShared.swift', 'utf8'); const mon = fs.readFileSync('ios/App/ClingLockMonitor/ClingLockMonitor.swift', 'utf8');
const plug = fs.readFileSync('ios/App/App/ClingLockPlugin.swift', 'utf8');
ok(/subtracting\(TaskAllow\.allowed/.test(sh) && /except: allow/.test(sh), 'shields subtract task-allowed apps (apps + categories)');
ok(/activity == \.clingTask/.test(mon) && /TaskAllow\.clearActive\(\); TaskAllow\.reapply\(\)/.test(mon), 'monitor re-locks at window end (app killed)');
const endFn = plug.slice(plug.indexOf('func endTaskApps'), plug.indexOf('static func applyShield'));
ok(endFn.indexOf('clearActive') < endFn.indexOf('stopMonitoring'), 'endTaskApps clears before stop (no restart artifact)');
ok(/TaskAllow\.expireIfNeeded\(\)/.test(plug) && /clingTask\]\); TaskAllow\.reapply\(\); return/.test(sh), 'relaunch expiry');
console.log(`task-app-unlock: ${n} passed`);
