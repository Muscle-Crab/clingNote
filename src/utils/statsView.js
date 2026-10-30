// B39 Stats sheet (pure): 12-week heatmap, completion rate and streaks from data the app already stores.
//   monthlyStats/{YYYY-MM}/private/{uid}.done = ['YYYY-MM-DD|taskKey']  (owner-only; one entry per completed task)
//   streaks/{uid}.counted = ['YYYY-MM-DD']   (days that counted for the day streak; a fallback when a month doc is missing)
//   users/{uid}/dailyCheckins/{date}.mood   (optional mood dots)
export const WEEKS = 12;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const mondayOf = (s) => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };

// First day of the grid: Monday WEEKS-1 weeks before this week's Monday (columns = Mon–Sun weeks, last column = this week).
export const gridStart = (todayStr, weeks = WEEKS) => addDays(mondayOf(todayStr), -7 * (weeks - 1));
// Month keys ('YYYY-MM') the grid touches, oldest first (which monthlyStats docs to read).
export const monthKeysFor = (todayStr, weeks = WEEKS) => {
  const out = []; for (let d = gridStart(todayStr, weeks); d <= todayStr; d = addDays(d, 1)) { const k = d.slice(0, 7); if (!out.includes(k)) out.push(k); }
  return out;
};
// Completions per day from monthly private docs (dedupes 'date|key' entries).
export const countsFromMonthly = (docs) => {
  const seen = new Set(); const counts = {};
  (docs || []).forEach((doc) => (Array.isArray(doc?.done) ? doc.done : []).forEach((e) => {
    if (typeof e !== 'string' || seen.has(e)) return; const date = e.split('|')[0]; if (!isDate(date)) return;
    seen.add(e); counts[date] = (counts[date] || 0) + 1;
  }));
  return counts;
};
export const levelOf = (n) => (n <= 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : n <= 7 ? 3 : 4);

export const buildStats = ({ todayStr, counts = {}, counted = [], moods = {}, weeks = WEEKS } = {}) => {
  if (!isDate(todayStr)) return null;
  const start = gridStart(todayStr, weeks);
  const countedSet = new Set((counted || []).filter(isDate));
  const cols = [];
  let first = '';
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, w * 7 + i); const future = date > todayStr;
      let count = future ? 0 : Math.max(0, Math.floor(Number(counts[date]) || 0));
      if (!future && !count && countedSet.has(date)) count = 1; // counted streak day without month detail: active
      if (count && !first) first = date;
      const m = Number(moods[date]);
      col.push({ date, count, level: levelOf(count), future, mood: Number.isInteger(m) && m >= 1 && m <= 5 ? m : 0 });
    }
    cols.push(col);
  }
  const cells = cols.flat().filter((c) => !c.future);
  const total = cells.reduce((a, c) => a + c.count, 0);
  const active = cells.filter((c) => c.count > 0).length;
  // Rate = active days / days in the window (from the first active day, so a new account isn't penalised for days before it).
  const span = first ? cells.filter((c) => c.date >= first).length : 0;
  const rate = span ? Math.round((active / span) * 100) : 0;
  // Active-day streaks (>=1 completion): today still open doesn't break the current run.
  let current = 0;
  for (let i = cells.length - 1; i >= 0; i--) { const c = cells[i]; if (c.count) current++; else if (c.date === todayStr) continue; else break; }
  let best = 0; let run = 0; cells.forEach((c) => { run = c.count ? run + 1 : 0; best = Math.max(best, run); });
  const moodDays = cells.filter((c) => c.mood).length;
  return { weeks: cols, total, active, days: span, rate, current, best: Math.max(best, current), moodDays, start, end: todayStr };
};
export const cellTitle = (c, moodEmoji = () => '') => `${parse(c.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${c.count} done${c.mood ? ` · ${moodEmoji(c.mood)}` : ''}`;
