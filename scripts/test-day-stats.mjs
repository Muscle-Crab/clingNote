// Focused time: clipped to the session window, never more than the day, stale week-old timer starts can't explode it.
import assert from 'assert';
import { computeTimeStats, formatElapsed } from '../src/utils/dayStats.js';
let pass = 0; const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); pass++; };
const iso = (s) => new Date(s).toISOString();
const ses = { startTime: iso('2026-10-26T13:00:00Z'), ended: true, endTime: iso('2026-10-26T19:45:00Z') };
eq(computeTimeStats(ses, [
  { completed: true, timerStartedAt: iso('2026-05-12T10:00:00Z'), timerStoppedAt: iso('2026-10-26T13:30:00Z') }, // stale start -> clipped to 30m
  { completed: true, timerStartedAt: iso('2026-10-26T14:00:00Z'), timerStoppedAt: iso('2026-10-26T14:25:00Z') },
  { completed: false, timerStartedAt: iso('2026-10-26T15:00:00Z'), timerStoppedAt: iso('2026-10-26T16:00:00Z') },
  { completed: true, timerStartedAt: { seconds: Date.parse('2026-10-26T16:00:00Z') / 1000 }, timerStoppedAt: iso('2026-10-26T16:10:00Z') },
  { completed: true, timerStartedAt: 'garbage', timerStoppedAt: iso('2026-10-26T16:10:00Z') },
], 0).productiveTime, '1h 5m');
eq(computeTimeStats(ses, [{ completed: true, timerStartedAt: iso('2026-01-01T00:00:00Z'), timerStoppedAt: iso('2027-01-01T00:00:00Z') }], 0).productiveTime, '6h 45m', 'never more than the day');
eq(computeTimeStats(ses, [], 0).totalDayTime, '6h 45m');
eq([formatElapsed(NaN), formatElapsed(-5)], ['0m', '0m']);
console.log(`day stats: ${pass} checks passed`);
