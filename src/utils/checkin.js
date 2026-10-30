// B39 mood check-in (pure): one tap each for mood (1–5) and energy (low/med/high), saved to users/{uid}/dailyCheckins/{YYYY-MM-DD}.
// Optional and skippable: nothing is required, no tap means no doc. Firestore rule: owner-only + the same field checks (firestore.rules).
export const MOODS = [
  { v: 1, e: '😞', l: 'Rough' }, { v: 2, e: '🙁', l: 'Low' }, { v: 3, e: '😐', l: 'Okay' }, { v: 4, e: '🙂', l: 'Good' }, { v: 5, e: '😄', l: 'Great' },
];
export const ENERGY = [{ v: 'low', l: 'Low' }, { v: 'med', l: 'Med' }, { v: 'high', l: 'High' }];
export const isCheckinDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const validMood = (v) => Number.isInteger(v) && v >= 1 && v <= 5;
export const validEnergy = (v) => ENERGY.some((x) => x.v === v);
export const checkinPath = (uid, date) => (uid && isCheckinDate(date) ? ['users', uid, 'dailyCheckins', date] : null);
// Patch for one tap ({ mood } or { energy } + date), or null if invalid / unchanged.
export const checkinPatch = (prev, kind, value, date) => {
  if (!isCheckinDate(date)) return null;
  if (kind === 'mood' && validMood(value) && prev?.mood !== value) return { mood: value, date };
  if (kind === 'energy' && validEnergy(value) && prev?.energy !== value) return { energy: value, date };
  return null;
};
export const moodEmoji = (v) => (MOODS.find((m) => m.v === v) || {}).e || '';
// Read side: keep only valid fields from a stored doc.
export const cleanCheckin = (d) => { const o = {}; if (d && validMood(d.mood)) o.mood = d.mood; if (d && validEnergy(d.energy)) o.energy = d.energy; return o; };
