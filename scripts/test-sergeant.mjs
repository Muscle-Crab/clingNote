import assert from 'node:assert/strict';
import { buildReport, nextUp, fmtLeft, ackLine, reportDue, taskKeyOf } from '../src/utils/sergeantReport.js';
const now = new Date(2026, 9, 25, 14, 0); const nowMs = now.getTime();
const T = (title, x = {}) => ({ id: title, title, completed: false, points: 10, ...x });
let n = 0; const t = (name, fn) => { fn(); n++; };
t('fmtLeft', () => { assert.equal(fmtLeft(5 * 3600e3 + 20 * 60e3 + 59e3), '5h20m'); assert.equal(fmtLeft(45 * 60e3), '45m'); assert.equal(fmtLeft(-5), '0m'); });
t('nextUp prefers earliest timed', () => { assert.equal(nextUp([T('a'), T('b', { startTime: '16:00' }), T('c', { reminder: { time: '15:00' } })]).title, 'c'); assert.equal(nextUp([T('a', { completed: true }), T('b')]).title, 'b'); assert.equal(nextUp([]), null); });
t('overdue + not started -> start-day first, open overdue, reminder', () => {
  const r = buildReport({ tasks: [T('Gym', { reminder: { time: '09:00' } }), T('Write report')], now, nowMs, phase: 'ready', earned: 0, target: 30, streak: 2, seed: 0 });
  assert.equal(r.stats.overdue, 1); assert.equal(r.atEase, false);
  assert.deepEqual(r.prompts.map((p) => p.id), ['start-day', 'open-task', 'set-reminder']);
  assert.equal(r.prompts[1].taskKey, 'Gym'); assert.equal(r.prompts[2].taskKey, 'Write report');
  assert.ok(r.lines.some((l) => l.kind === 'overdue' && /Gym/.test(l.text)));
  assert.ok(r.lines.some((l) => l.kind === 'points' && /0 (of|out of) 30/.test(l.text)));
  assert.ok(r.speech.length > 0 && r.lines.every((l) => l.text.length < 90));
});
t('running lock shows elapsed/left, no start prompt', () => {
  const r = buildReport({ tasks: [T('A', { reminder: { time: '18:00' } })], now, nowMs, phase: 'running', lock: { startMs: nowMs - 90 * 60e3, endMs: nowMs + 6.5 * 3600e3 }, streak: 0 });
  const l = r.lines.find((x) => x.kind === 'lock'); assert.match(l.text, /1h30m/); assert.match(l.text, /6h30m/);
  assert.ok(!r.prompts.some((p) => p.id === 'start-day')); assert.ok(!r.prompts.some((p) => p.id === 'set-reminder')); // next already has a reminder
  assert.equal(r.stats.lockLeft, '6h30m');
});
t('all done -> at ease, no prompts', () => { const r = buildReport({ tasks: [T('A', { completed: true })], now, nowMs, phase: 'running', lock: { startMs: nowMs - 1, endMs: nowMs + 1e6 }, earned: 10, target: 10, streak: 3 }); assert.equal(r.atEase, true); assert.equal(r.prompts.length, 0); assert.match(r.lines[0].text, /At ease/i); });
t('empty list', () => { const r = buildReport({ tasks: [], now, nowMs, phase: 'ready' }); assert.equal(r.lines[0].kind, 'empty'); assert.equal(r.atEase, false); assert.ok(!r.prompts.some((p) => p.id === 'start-day')); });
t('ended day: no start / reminder prompts', () => { const r = buildReport({ tasks: [T('A')], now, nowMs, phase: 'ended' }); assert.equal(r.prompts.length, 0); });
t('varied lines by seed', () => { const s = new Set([0, 1, 2].map((seed) => buildReport({ tasks: [T('A')], now, nowMs, phase: 'ready', seed }).lines[0].text)); assert.ok(s.size > 1); });
t('ack', () => { assert.match(ackLine({ left: 0, seed: 1 }), /At ease/); assert.ok(ackLine({ left: 3, seed: 2 }).length > 0); });
t('throttle', () => { assert.equal(reportDue(nowMs, null), true); assert.equal(reportDue(nowMs, nowMs - 10 * 60e3), false); assert.equal(reportDue(nowMs, nowMs - 31 * 60e3), true); });
t('taskKeyOf fallback', () => assert.equal(taskKeyOf({ title: 'x', createdAt: { seconds: 5 } }), '5|x'));
console.log(`sergeant report: ${n} tests passed`);
