// Countdown ring for task timers (TaskCard + iOS widgets). Pure, unit-tested in scripts/test-timer-ring.mjs.
// Timer fields on a task: timerStartedAt / timerEndTime (ISO), timerActive, optional timerPausedAt (ISO; frozen while set).
// Color: hue lerp over the REMAINING fraction. Keep RING_STOPS identical to ringStops in
// ios/App/ClingNoteWidget/ClingNoteWidget.swift (the test checks both).
export const RING_STOPS = [
  { f: 1.0, h: 130 }, // green
  { f: 0.6, h: 52 },  // yellow
  { f: 0.3, h: 28 },  // orange
  { f: 0.1, h: 0 },   // red (and below, down to 0)
];
export const RING_SAT = 78;
export const RING_LIGHT = 48;
export const WIDGET_STEP = 0.05;
export const WIDGET_MAX_STEPS = 20;

const ms = (v) => { if (v == null || v === '') return 0; const n = typeof v === 'number' ? v : new Date(v).getTime(); return Number.isFinite(n) ? n : 0; };
export const timerTimes = (t) => {
  const end = ms(t && t.timerEndTime);
  let start = ms(t && t.timerStartedAt);
  if (!start && end && t && Number(t.timerDurationMinutes) > 0) start = end - Number(t.timerDurationMinutes) * 60000;
  return { start, end, paused: ms(t && t.timerPausedAt) };
};
// Ring shown only when a timer is set / was started.
// Legacy timers without a start (or duration) still show: full ring + time left until the end.
export const hasRing = (t) => { const { start, end } = timerTimes(t); return !!(t && end && (start ? end > start : t.timerActive)); };

// Remaining fraction 1..0 (1 = just started). Paused: frozen at the pause instant.
export const ringFraction = (t, nowMs = Date.now()) => {
  const { start, end, paused } = timerTimes(t);
  const at = paused || nowMs;
  if (end && !start) return end > at ? 1 : 0;
  if (!end || end <= start) return 0;
  return Math.min(1, Math.max(0, (end - at) / (end - start)));
};
export const ringRemainingMs = (t, nowMs = Date.now()) => { const { end, paused } = timerTimes(t); return end ? Math.max(0, end - (paused || nowMs)) : 0; };

export const ringHue = (f) => {
  const x = Math.min(1, Math.max(0, Number(f) || 0));
  if (x >= RING_STOPS[0].f) return RING_STOPS[0].h;
  for (let i = 1; i < RING_STOPS.length; i++) {
    const a = RING_STOPS[i - 1], b = RING_STOPS[i];
    if (x >= b.f) return b.h + (a.h - b.h) * ((x - b.f) / (a.f - b.f));
  }
  return RING_STOPS[RING_STOPS.length - 1].h;
};
export const ringColor = (f) => `hsl(${Math.round(ringHue(f))} ${RING_SAT}% ${RING_LIGHT}%)`;

// SVG: circumference and dashoffset for radius r (full circle at f=1, empty at 0).
export const ringDash = (f, r) => { const c = 2 * Math.PI * r; const x = Math.min(1, Math.max(0, f)); return { c, offset: c * (1 - x) }; };

export const fmtRemaining = (msLeft) => {
  const s = Math.ceil(Math.max(0, msLeft) / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

// Widget timeline: times (ms) at every WIDGET_STEP of the duration still ahead, plus the end (capped).
export const widgetStepTimes = (startMs, endMs, nowMs = Date.now()) => {
  if (!(endMs > startMs) || endMs <= nowMs) return [];
  const out = [];
  for (let k = 1; k * WIDGET_STEP < 1 - 1e-9; k++) {
    const at = startMs + (endMs - startMs) * k * WIDGET_STEP;
    if (at > nowMs) out.push(Math.round(at));
  }
  out.push(endMs);
  return out.slice(-WIDGET_MAX_STEPS - 1);
};
