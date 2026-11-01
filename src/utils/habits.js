// Habit tracker (pure + localStorage per user): each habit keeps its own done-dates and streak.
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const prevDay = (s) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d - 1)); };
// B44 flexible schedules. habit.schedule (optional, absent = every day, the old meaning):
//   { days: [0..6] }        specific weekdays; other days neither count nor break the streak
//   { timesPerWeek: N }     N times in a Mon–Sun week (1..6); streak counts weeks that met N (this week adds once met, never breaks while open)
//   { everyDays: N, start } every N days from start (2..365); a due day is met by doing it that day
export const cleanSchedule = (s) => {
  if (!s || typeof s !== 'object') return null;
  const days = Array.isArray(s.days) ? [...new Set(s.days.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort() : [];
  if (days.length && days.length < 7) return { days };
  const tpw = Number(s.timesPerWeek); if (Number.isInteger(tpw) && tpw >= 1 && tpw <= 6) return { timesPerWeek: tpw };
  const n = Number(s.everyDays); if (Number.isInteger(n) && n >= 2 && n <= 365) return { everyDays: n, start: /^\d{4}-\d{2}-\d{2}$/.test(s.start || '') ? s.start : ymd(new Date()) };
  return null;
};
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const monday = (s) => { const d = parse(s); return addDays(s, -((d.getDay() + 6) % 7)); };
export const habitDueOn = (schedule, dateStr) => {
  const s = cleanSchedule(schedule); if (!s || s.timesPerWeek) return true;
  if (s.days) return s.days.includes(parse(dateStr).getDay());
  const k = Math.round((parse(dateStr) - parse(s.start)) / 86400000); return k >= 0 && k % s.everyDays === 0;
};
const bestRun = (set) => { let best = 0, run = 0, last = null; [...set].sort().forEach((d) => { run = last && prevDay(d) === last ? run + 1 : 1; best = Math.max(best, run); last = d; }); return best; };
export const habitStreak = (dates = [], today = ymd(new Date()), schedule = null) => {
  const set = new Set(dates); const s = cleanSchedule(schedule);
  if (!s) {
    let cur = set.has(today) ? today : prevDay(today); let n = 0;
    while (set.has(cur)) { n++; cur = prevDay(cur); }
    return { streak: n, best: bestRun(set), doneToday: set.has(today), unit: 'day' };
  }
  const first = [...set].sort()[0] || today;
  if (s.timesPerWeek) {
    const inWeek = (mon) => [...set].filter((d) => d >= mon && d <= addDays(mon, 6)).length;
    const wk = monday(today); const thisWeek = inWeek(wk);
    let n = thisWeek >= s.timesPerWeek ? 1 : 0;
    for (let w = addDays(wk, -7); addDays(w, 6) >= first; w = addDays(w, -7)) { if (inWeek(w) >= s.timesPerWeek) n++; else break; }
    let best = 0, run = 0; for (let w = monday(first); w <= wk; w = addDays(w, 7)) { if (inWeek(w) >= s.timesPerWeek) best = Math.max(best, ++run); else if (w !== wk) run = 0; }
    return { streak: n, best: Math.max(best, n), doneToday: set.has(today), unit: 'week', weekDone: thisWeek, weekTarget: s.timesPerWeek };
  }
  // weekdays / every N days: walk back over due days only (today still open never breaks)
  const floor = first < addDays(today, -400) ? addDays(today, -400) : first;
  let n = 0;
  for (let d = today; d >= floor; d = prevDay(d)) { if (!habitDueOn(s, d)) continue; if (set.has(d)) n++; else if (d === today) continue; else break; }
  let best = 0, run = 0;
  for (let d = floor; d <= today; d = addDays(d, 1)) { if (!habitDueOn(s, d)) continue; if (set.has(d)) best = Math.max(best, ++run); else if (d !== today) run = 0; }
  return { streak: n, best: Math.max(best, n), doneToday: set.has(today), unit: 'day', dueToday: habitDueOn(s, today) };
};
export const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 60);
export const addHabit = (list = [], name, schedule = null) => {
  const n = cleanName(name); if (!n) return list; const sc = cleanSchedule(schedule);
  const ex = list.find((h) => h.name.toLowerCase() === n.toLowerCase());
  if (ex) return sc ? list.map((h) => (h === ex ? { ...h, schedule: sc } : h)) : list; // "make it 3x a week" on an existing habit
  return [...list, { id: `h${Date.now().toString(36)}${list.length}`, name: n, dates: [], ...(sc ? { schedule: sc } : {}) }];
};
export const findHabit = (list = [], name) => { const n = cleanName(name).toLowerCase(); return list.find((h) => h.name.toLowerCase() === n) || list.find((h) => h.name.toLowerCase().includes(n) || n.includes(h.name.toLowerCase())); };
export const logHabit = (list = [], name, today = ymd(new Date()), done = true) => {
  const h = findHabit(list, name); if (!h) return { list, habit: null };
  const dates = done ? [...new Set([...h.dates, today])].sort().slice(-400) : h.dates.filter((d) => d !== today);
  const next = list.map((x) => (x.id === h.id ? { ...x, dates } : x));
  return { list: next, habit: { ...h, dates } };
};
export const removeHabit = (list = [], name) => { const h = findHabit(list, name); return h ? list.filter((x) => x.id !== h.id) : list; };
export const describeHabitSchedule = (sc) => { const s = cleanSchedule(sc); if (!s) return 'Every day';
  if (s.days) return `Every ${s.days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`;
  if (s.timesPerWeek) return s.timesPerWeek === 1 ? 'Once a week, any day' : `${s.timesPerWeek}× a week, any day`; return `Every ${s.everyDays} days`; };
export const habitSummary = (list = [], today) => list.map((h) => ({ name: h.name, schedule: describeHabitSchedule(h.schedule), ...habitStreak(h.dates, today, h.schedule) }));
const KEY = (uid) => `cn.habits.${uid || 'anon'}`;
export const loadHabits = (uid) => { try { const v = JSON.parse(localStorage.getItem(KEY(uid)) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
export const saveHabits = (uid, list) => { try { localStorage.setItem(KEY(uid), JSON.stringify(list)); } catch (e) { /* ignore */ } };
