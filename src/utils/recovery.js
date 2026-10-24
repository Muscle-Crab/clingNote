// Recovery tracker (views/addiction.vue): pure date / streak math. Private data at users/{uid}/nofap/tracker (owner-only rules).
// A day is marked 'clean' or 'dirty' (relapse) by local date (YYYY-MM-DD). Unmarked days count neither way.
export const BACKFILL_DAYS = 7; // today + the 6 days before can be marked or changed
export const TRIGGERS = ['Bored', 'Stressed', 'Lonely', 'Tired', 'Late night', 'Phone in bed', 'Social media', 'Alone at home'];

const pad = (n) => String(n).padStart(2, '0');
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // local, not UTC
export const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return localDate(new Date(y, m - 1, d + n, 12)); };
export const dayIndexOf = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12).getDay(); };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

// legacy docs: retentionDays / relapseDays arrays -> days map (explicit marks in `days` win)
export const normalizeDays = (data = {}) => {
  const out = {};
  for (const s of data.retentionDays || []) if (isDate(s)) out[s] = { s: 'clean' };
  for (const s of data.relapseDays || []) if (isDate(s)) out[s] = { s: 'dirty' };
  for (const [k, v] of Object.entries(data.days || {})) if (isDate(k) && v && (v.s === 'clean' || v.s === 'dirty')) out[k] = v;
  return out;
};

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// a dirty day on the chosen free day does not break the streak (existing "allowed free day" rule)
const breaks = (date, mark, freeDay) => mark.s === 'dirty' && DOW[dayIndexOf(date)] !== freeDay;

export const stats = (days, today, freeDay = '') => {
  const dates = Object.keys(days).filter((d) => d <= today).sort();
  let clean = 0, dirty = 0, run = 0, best = 0;
  for (const d of dates) {
    const m = days[d];
    if (m.s === 'clean') { clean++; run++; best = Math.max(best, run); } else { dirty++; if (breaks(d, m, freeDay)) run = 0; }
  }
  return { clean, dirty, current: run, best };
};

export const canMark = (date, today) => isDate(date) && date <= today && date > addDays(today, -BACKFILL_DAYS);

// month grid: weeks (Sun..Sat) of { date, day, status: 'clean'|'dirty'|'' , inMonth, future }
export const monthGrid = (year, month0, days, today) => {
  const first = localDate(new Date(year, month0, 1, 12));
  let d = addDays(first, -dayIndexOf(first)); const weeks = [];
  do {
    const w = [];
    for (let i = 0; i < 7; i++, d = addDays(d, 1)) w.push({ date: d, day: Number(d.slice(8)), status: days[d]?.s || '', inMonth: Number(d.slice(5, 7)) === month0 + 1, future: d > today });
    weeks.push(w);
  } while (Number(d.slice(5, 7)) === month0 + 1);
  return weeks;
};

// "fuel" = 100 minus 20 per streak-breaking dirty day since this week's Sunday (refills every Sunday)
export const fuelFor = (days, today, freeDay = '') => {
  const sun = addDays(today, -dayIndexOf(today)); let f = 100;
  for (const [d, m] of Object.entries(days)) if (d >= sun && d <= today && breaks(d, m, freeDay)) f -= 20;
  return Math.max(0, f);
};

// Tips (evidence-informed; see report). Kept short and non-explicit.
export const TIPS = [
  { t: 'Surf the urge', d: 'Urges rise, peak and fade, usually within 10–20 minutes. Set a 10-minute timer, notice where you feel it, and let it pass without acting.' },
  { t: 'Change the room', d: 'Get up and go somewhere public or with people: kitchen, balcony, a walk outside. Location breaks the routine.' },
  { t: 'Phone out of the bedroom', d: 'Charge it in another room at night. Late night in bed with a phone is the most common high-risk moment.' },
  { t: 'Move your body', d: 'Push-ups, a brisk walk or a short run. Even 10 minutes of exercise reliably lowers cravings.' },
  { t: 'Cold water', d: 'A cold shower or cold water on your face resets your state quickly.' },
  { t: 'Use a blocker', d: 'Turn on Screen Time content limits or a blocker, ideally with a code someone else holds. Make the old path slower.' },
  { t: 'HALT check', d: 'Are you Hungry, Angry, Lonely or Tired? Fix that need first: eat, vent, text someone, or sleep.' },
  { t: 'If-then plan', d: 'Decide in advance: "If I am alone with my phone after 11 pm, then I put it in the kitchen and read." Plans made ahead work better than willpower in the moment.' },
  { t: 'Swap in a task', d: 'Open your task list and do the smallest one now. Busy hands, busy mind.' },
  { t: 'Tell someone', d: 'Message a friend or accountability partner. Saying "I have an urge" out loud takes much of its power away.' },
  { t: 'Read your why', d: 'Re-read the reason you started. Remind yourself what tomorrow-you wants.' },
  { t: 'Sleep and routine', d: 'Regular sleep and a wind-down routine cut the tired, late-night urges.' },
];
export const RELAPSE_MESSAGE = 'One slip is not the end of your progress. Your clean days still count. Note what triggered it, adjust your plan, and start again today. No shame, just data.';
export const randomTip = (rand = Math.random) => TIPS[Math.floor(rand() * TIPS.length) % TIPS.length];
