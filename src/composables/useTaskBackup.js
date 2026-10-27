// Settings → "Export / import tasks". Firestore I/O around the pure src/utils/taskTransfer.js.
// Export: all 7 weeklyRoutines day docs + users/{uid}.scheduledTasks → JSON (re-importable) or CSV.
// Import: JSON only; appends to day docs / scheduled list (never replaces). Respects the 8-hour lock (locked days are skipped,
// shutdown blocks import) and the daily task limit (see planImport). Same writes the app already does (setDoc merge on users, day docs).
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { loadDayTasks } from '@/composables/useDayPersistence';
import { loadScheduled, mutateScheduled } from '@/composables/useScheduledTasks';
import { isDayLocked, assertNotShut } from '@/utils/eightHourLock';
import { countTasksForDay } from '@/utils/taskLimits';
import { dailyTaskLimit } from '@/config/pricing';
import { buildExport, toCsv, parseImport, planImport, importSummary, exportFileName, DAY_NAMES } from '@/utils/taskTransfer';
import { saveTextFile } from '@/utils/fileSave';

const loadAll = async (uid) => {
  const lists = await Promise.all(DAY_NAMES.map((d) => loadDayTasks(uid, d)));
  return { days: Object.fromEntries(DAY_NAMES.map((d, i) => [d, lists[i]])), scheduled: await loadScheduled(uid) };
};
const localDay = (d = new Date()) => d.toLocaleDateString('en-CA');

export const exportTasks = async (uid, format = 'json', { native = false } = {}) => {
  const all = await loadAll(uid);
  const exp = buildExport({ dayLists: all.days, scheduled: all.scheduled });
  const n = DAY_NAMES.reduce((a, d) => a + exp.days[d].length, 0) + exp.scheduled.length;
  const res = format === 'csv'
    ? await saveTextFile(`\uFEFF${toCsv(exp)}`, exportFileName('csv'), 'text/csv', { native })
    : await saveTextFile(JSON.stringify(exp, null, 2), exportFileName('json'), 'application/json', { native });
  return { result: res, count: n };
};

// -> { ok, message, counts? }
export const importTasks = async (uid, text, { pro = false } = {}) => {
  const parsed = parseImport(text);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  try { assertNotShut(); } catch (e) { return { ok: false, message: e.message }; }
  const all = await loadAll(uid);
  const lists = DAY_NAMES.map((d) => all.days[d]);
  const limit = dailyTaskLimit(pro);
  const plan = planImport(parsed.data, all, {
    lockedDays: DAY_NAMES.filter((d) => isDayLocked(d)),
    freshRoom: limit - countTasksForDay(localDay(), lists, all.scheduled),
    scheduledRoom: (date) => limit - countTasksForDay(date, lists, all.scheduled),
  });
  for (const d of Object.keys(plan.days)) {
    const fresh = await loadDayTasks(uid, d); // re-read right before writing
    await setDoc(doc(db, 'weeklyRoutines', `${uid}_${d}`), { tasks: [...fresh, ...plan.days[d]], updatedAt: serverTimestamp() }, { merge: true }); // merge: keep the day's other fields
  }
  if (plan.scheduled.length) {
    await mutateScheduled(uid, (list) => { const ids = new Set(list.map((e) => e && e.id)); return [...list, ...plan.scheduled.filter((e) => !ids.has(e.id))]; });
  }
  return { ok: true, message: importSummary(plan.counts, parsed.skipped), counts: plan.counts };
};
