// Timer ring: fraction math, color gradient, widget steps, JS/Swift stop parity, TaskCard wiring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RING_STOPS, RING_SAT, RING_LIGHT, WIDGET_STEP, WIDGET_MAX_STEPS, ringFraction, ringRemainingMs, ringHue, ringColor, ringDash, hasRing, fmtRemaining, widgetStepTimes } from '../src/utils/timerRing.js';
import { buildWidgetSnapshot } from '../src/utils/widgetSnapshot.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const S = Date.UTC(2026, 9, 26, 13, 0, 0), M = 60000;
const task = { title: 'Focus', timerActive: true, timerStartedAt: new Date(S).toISOString(), timerEndTime: new Date(S + 10 * M).toISOString() };

t('fraction: full at start, half midway, 0 at/after end, 1 before start', () => {
  assert.equal(ringFraction(task, S), 1);
  assert.equal(ringFraction(task, S + 5 * M), 0.5);
  assert.ok(Math.abs(ringFraction(task, S + 9 * M) - 0.1) < 1e-12);
  assert.equal(ringFraction(task, S + 10 * M), 0);
  assert.equal(ringFraction(task, S + 99 * M), 0);
  assert.equal(ringFraction(task, S - M), 1);
});
t('fraction: paused stays frozen at the pause instant', () => {
  const p = { ...task, timerPausedAt: new Date(S + 2 * M).toISOString() };
  assert.equal(ringFraction(p, S + 7 * M), 0.8);
  assert.equal(ringRemainingMs(p, S + 9 * M), 8 * M);
});
t('fraction: start derived from duration; no timer -> no ring', () => {
  assert.equal(ringFraction({ timerEndTime: new Date(S + 4 * M).toISOString(), timerDurationMinutes: 8 }, S), 0.5);
  assert.equal(hasRing({ title: 'x' }), false);
  assert.equal(hasRing({ timerEndTime: 'junk', timerStartedAt: 'junk' }), false);
  assert.equal(hasRing(task), true);
  assert.equal(ringFraction({}, S), 0);
  const legacy = { timerActive: true, timerEndTime: new Date(S + M).toISOString() };
  assert.equal(hasRing(legacy), true); assert.equal(ringFraction(legacy, S), 1); assert.equal(ringFraction(legacy, S + 2 * M), 0);
});
t('dash: full circle offset 0, empty offset = circumference', () => {
  const a = ringDash(1, 10), b = ringDash(0, 10), c = ringDash(0.25, 10);
  assert.equal(a.offset, 0); assert.ok(Math.abs(b.offset - a.c) < 1e-9); assert.ok(Math.abs(c.offset - 0.75 * a.c) < 1e-9);
});
t('color: stops hit exactly, interpolates between, red below 10%', () => {
  for (const s of RING_STOPS) assert.equal(ringHue(s.f), s.h);
  assert.equal(ringHue(0.8), (130 + 52) / 2);
  assert.equal(ringHue(0.45), (52 + 28) / 2);
  assert.ok(Math.abs(ringHue(0.2) - 14) < 1e-9);
  assert.equal(ringHue(0.05), 0); assert.equal(ringHue(0), 0); assert.equal(ringHue(-1), 0); assert.equal(ringHue(2), 130);
  let prev = Infinity; for (let f = 1; f >= 0; f -= 0.01) { const h = ringHue(f); assert.ok(h <= prev + 1e-9); prev = h; }
  assert.equal(ringColor(1), `hsl(130 ${RING_SAT}% ${RING_LIGHT}%)`);
  assert.equal(ringColor(0), `hsl(0 ${RING_SAT}% ${RING_LIGHT}%)`);
});
t('format remaining', () => { assert.equal(fmtRemaining(65000), '1:05'); assert.equal(fmtRemaining(3723000), '1:02:03'); assert.equal(fmtRemaining(-5), '0:00'); });
t('widget steps: every 5% ahead + end, capped', () => {
  const st = widgetStepTimes(S, S + 100 * M, S);
  assert.equal(st.length, 20); assert.equal(st[0], S + 5 * M); assert.equal(st[st.length - 1], S + 100 * M);
  assert.equal(widgetStepTimes(S, S + 100 * M, S + 51 * M).length, 10);
  assert.deepEqual(widgetStepTimes(S, S + M, S + 2 * M), []);
  assert.ok(widgetStepTimes(S, S + 100 * M, S).length <= WIDGET_MAX_STEPS + 1);
});
t('Swift ringStops/sat/light/step match JS', () => {
  const sw = fs.readFileSync('ios/App/ClingNoteWidget/ClingNoteWidget.swift', 'utf8');
  const m = sw.match(/let ringStops[^=]*=\s*\[([^\]]*)\]/); assert.ok(m, 'ringStops in Swift');
  const pairs = [...m[1].matchAll(/\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g)].map((x) => ({ f: +x[1], h: +x[2] }));
  assert.deepEqual(pairs, RING_STOPS);
  assert.match(sw, new RegExp(`ringSat = ${RING_SAT / 100}, ringLight = ${RING_LIGHT / 100}`));
  assert.match(sw, new RegExp(`widgetStep = ${WIDGET_STEP}, widgetMaxSteps = ${WIDGET_MAX_STEPS}`));
  assert.match(sw, /ProgressView\(timerInterval:/); assert.match(sw, /Text\(timerInterval:/);
  assert.match(fs.readFileSync('ios/App/ClingNoteWidget/MatchupWidget.swift', 'utf8'), /timerStepDates\(snap\.tasks/);
});
t('widget snapshot carries timer start/end/paused only when set', () => {
  const snap = buildWidgetSnapshot([task, { title: 'Plain' }, { ...task, title: 'Done one', completed: true }], { now: new Date(S) });
  const f = snap.tasks.find((x) => x.title === 'Focus');
  assert.equal(f.tS, S); assert.equal(f.tE, S + 10 * M); assert.equal(f.tP, 0);
  assert.equal(snap.tasks.find((x) => x.title === 'Plain').tE, undefined);
  assert.equal(snap.tasks.find((x) => x.title === 'Done one').tE, undefined);
});
t('TaskCard shows TimerRing only for tasks with a timer', () => {
  const card = fs.readFileSync('src/components/home/TaskCard.vue', 'utf8');
  assert.match(card, /<TimerRing v-if="hasRing\(task\)"/);
  const ring = fs.readFileSync('src/components/home/TimerRing.vue', 'utf8');
  assert.match(ring, /prefers-reduced-motion/); assert.match(ring, /stroke-dashoffset/);
});
console.log(`timer ring: ${n} passed`);
