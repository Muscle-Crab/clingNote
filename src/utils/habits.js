// Habit tracker (pure + localStorage per user): each habit keeps its own done-dates and streak.
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const prevDay = (s) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d - 1)); };
export const habitStreak = (dates = [], today = ymd(new Date())) => {
  const set = new Set(dates); let cur = set.has(today) ? today : prevDay(today); let n = 0;
  while (set.has(cur)) { n++; cur = prevDay(cur); }
  let best = 0, run = 0, last = null;
  [...set].sort().forEach((d) => { run = last && prevDay(d) === last ? run + 1 : 1; best = Math.max(best, run); last = d; });
  return { streak: n, best, doneToday: set.has(today) };
};
export const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 60);
export const addHabit = (list = [], name) => { const n = cleanName(name); if (!n || list.some((h) => h.name.toLowerCase() === n.toLowerCase())) return list; return [...list, { id: `h${Date.now().toString(36)}${list.length}`, name: n, dates: [] }]; };
export const findHabit = (list = [], name) => { const n = cleanName(name).toLowerCase(); return list.find((h) => h.name.toLowerCase() === n) || list.find((h) => h.name.toLowerCase().includes(n) || n.includes(h.name.toLowerCase())); };
export const logHabit = (list = [], name, today = ymd(new Date()), done = true) => {
  const h = findHabit(list, name); if (!h) return { list, habit: null };
  const dates = done ? [...new Set([...h.dates, today])].sort().slice(-400) : h.dates.filter((d) => d !== today);
  const next = list.map((x) => (x.id === h.id ? { ...x, dates } : x));
  return { list: next, habit: { ...h, dates } };
};
export const removeHabit = (list = [], name) => { const h = findHabit(list, name); return h ? list.filter((x) => x.id !== h.id) : list; };
export const habitSummary = (list = [], today) => list.map((h) => ({ name: h.name, ...habitStreak(h.dates, today) }));
const KEY = (uid) => `cn.habits.${uid || 'anon'}`;
export const loadHabits = (uid) => { try { const v = JSON.parse(localStorage.getItem(KEY(uid)) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
export const saveHabits = (uid, list) => { try { localStorage.setItem(KEY(uid), JSON.stringify(list)); } catch (e) { /* ignore */ } };
