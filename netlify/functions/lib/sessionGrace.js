// Server side of the per-session shutdown rule (mirror of src/utils/sessionPoints.js, kept in sync by scripts/test-session-points.mjs).
// A block (session) that ends with its session points < its session target keeps apps locked GRACE_MS after its end.
const GRACE_MS = 2 * 3600000;
const SESSION1 = ['morning'];
const sectionOf = (t) => { if (t && ['morning', 'noon', 'afternoon'].includes(t.section)) return t.section;
  const m = /^(\d{1,2}):(\d{2})/.exec(String((t && t.startTime) || '')); if (!m) return 'morning'; const h = Number(m[1]); return h < 12 ? 'morning' : h < 15 ? 'noon' : 'afternoon'; };
const sessionOfTask = (t, sessions = 2) => (sessions === 1 ? 1 : SESSION1.includes(sectionOf(t)) ? 1 : 2);
const doneAt = (t) => { const v = t && t.completedAt; if (!v) return NaN; if (typeof v === 'number') return v; if (v.seconds) return v.seconds * 1000; if (v._seconds) return v._seconds * 1000; return Date.parse(v); };
// rows: [{ t, points }] = the block's locked tasks with their locked points. n = session number (block index + 1, max 2).
const sessionGrace = (rows, { n, sessions = 2, startMs, endMs }) => {
  let target = 0, earned = 0;
  for (const { t, points } of rows || []) { if (!t || sessionOfTask(t, sessions) !== n) continue; const p = Number(points) || 0; target += p;
    if (t.completed) { const at = doneAt(t); if (Number.isFinite(at) ? at >= startMs && at < endMs : true) earned += p; } }
  const met = earned >= target;
  return { n, target, earned, met, untilMs: met || target <= 0 ? 0 : endMs + GRACE_MS };
};
module.exports = { GRACE_MS, sessionGrace, sessionOfTask };
