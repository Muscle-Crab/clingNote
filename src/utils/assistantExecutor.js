// ClingNote assistant executor: maps validated tool calls (utils/assistantTools.validateCall) onto the app's own flows.
// Pure factory: HomeView injects the real handlers (same paths as the buttons: daily limit, boss, points, lock rules); tested in scripts/test-assistant.js.
import { buildContext, taskKeyOf, clampPoints, clampComplexity } from './assistantTools';

// deps: { tasks(), today(), pro(), limitRemaining() async, stats() -> {streak,points,target,hours,lock,upcoming,settings,route},
//   addTask(item) -> {ok,error}, deleteTask(task), editTask(task, patch), reschedule(task,{date,time}), complete(task), startTimer(task, minutes),
//   bossCheckin(task, on), startDay(hours), setHours(hours), setSetting(setting, on), navigate(path), post({text, includeStats}) }
export function createAssistantExecutor(deps) {
  let refs = {};
  const snapshot = async () => {
    const tasks = deps.tasks() || [];
    let limitRemaining = null;
    try { limitRemaining = await deps.limitRemaining(); } catch (e) { limitRemaining = null; }
    const s = deps.stats ? deps.stats() : {};
    const b = buildContext({ tasks, pro: deps.pro(), limit: limitRemaining == null ? null : { remainingToday: limitRemaining, perDay: 5 }, ...s,
      tz: (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || '' });
    refs = b.refs;
    return { refs: b.refs, context: b.context, tasksByKey: new Map(tasks.map((t) => [taskKeyOf(t), t])), today: deps.today(), limitRemaining };
  };
  const run = async (name, a) => {
    switch (name) {
      case 'create_tasks': {
        const added = []; const failed = [];
        for (const it of a.items) {
          const r = await deps.addTask({ ...it, points: clampPoints(it.points), complexity: clampComplexity(it.complexity) });
          if (r && r.ok) added.push(`${it.title}${it.date && it.date !== (deps.today && deps.today()) ? ` on ${it.date}` : ''}${it.start ? ` at ${it.start}` : ''}${it.points ? ` (${it.points} pts)` : ''}`); else { failed.push({ title: it.title, error: (r && r.error) || 'not saved' }); if (r && r.limit) break; }
        }
        return { ok: !failed.length, added: added.length, summary: added.join(', '), ...(failed.length ? { failed } : {}) };
      }
      case 'edit_task': { const ok = await deps.editTask(a.task, a.patch); return ok === false ? { error: 'Could not save the change (day locked or offline).' } : { ok: true, summary: a.task.title }; }
      case 'reschedule_task': { const ok = await deps.reschedule(a.task, { date: a.date, time: a.time }); if (ok === false) return { error: 'Could not move it (day locked or offline).' }; } return { ok: true, summary: `${a.task.title} → ${[a.date || 'today', a.time].filter(Boolean).join(' ')}` };
      case 'delete_task': { const ok = await deps.deleteTask(a.task); return ok === false ? { error: 'Could not delete (day locked or shut).' } : { ok: true, summary: a.task.title }; }
      case 'complete_task': { const ok = await deps.complete(a.task); return ok === false ? { error: 'Could not complete.' } : { ok: true, summary: a.task.title }; }
      case 'start_timer': await deps.startTimer(a.task, a.minutes); return { ok: true, summary: `${a.task.title}, ${a.minutes} min` };
      case 'set_boss_checkin': await deps.bossCheckin(a.task, a.on); return { ok: true, summary: `${a.task.title}: ${a.on ? 'on' : 'off'}` };
      case 'start_day': { const r = await deps.startDay(a.hours); return r && r.error ? { error: r.error } : { ok: true, summary: `${a.hours}h`, target: r && r.target }; }
      case 'set_day_hours': await deps.setHours(a.hours); return { ok: true, summary: `${a.hours}h` };
      case 'set_setting': await deps.setSetting(a.setting, a.on); return { ok: true, summary: `${a.setting.replace('_', ' ')} ${a.on ? 'on' : 'off'}` };
      case 'navigate': await deps.navigate(a.path); return { ok: true, summary: a.path.replace('/', '') };
      case 'get_overview': { const s = await snapshot(); return { ok: true, overview: s.context }; }
      case 'get_stats': return { ok: true, stats: await deps.weekStats() };
      case 'find_tasks': { const found = await deps.findTasks(a); return { ok: true, count: found.length, found }; }
      case 'suggest_next': { const r = await deps.suggestNext(); return r.task ? { ok: true, next: r.task.title, start: r.task.startTime || '', points: Number(r.task.points) || 0, reason: r.reason } : { ok: true, next: null, reason: r.reason }; }
      case 'snooze_task': { const r = await deps.snooze(a.task, a.minutes); return r && r.error ? { error: r.error } : { ok: true, summary: `${a.task.title} → ${r.time}` }; }
      case 'add_subtasks': await deps.addSubtasks(a.task, a.items); return { ok: true, summary: `${a.task.title}: ${a.items.length} subtasks` };
      case 'post_to_community': { const r = await deps.post(a); return r && r.error ? { error: r.error } : { ok: true, summary: 'Community' }; }
      case 'roll_unfinished': { const r = await deps.rollUnfinished(); return { ok: true, summary: `${r.moved} moved to tomorrow` }; }
      case 'auto_schedule': { const r = await deps.autoSchedule(a); return r.error ? { error: r.error } : { ok: true, placed: r.plan.map((p) => `${p.task.title} ${p.start}`), unplaced: r.unplaced.map((t) => t.title), summary: `${r.plan.length} scheduled` }; }
      case 'add_habit': case 'log_habit': case 'get_habits': { const r = await deps.habit(name, a); return r.error ? { error: r.error } : { ok: true, ...r }; }
      case 'place_reminder': { const r = await deps.placeReminder(a); return r.error ? { error: r.error } : { ok: true, summary: `${a.title} @ ${a.place}` }; }
      case 'lock_apps': case 'unlock_apps': case 'open_app_picker': { if (!deps.lockByName) return { error: 'App lock needs the iPhone app.' }; const r = await deps.lockByName(name, a); return r.error ? { error: r.error } : { ok: true, ...r }; }
      case 'set_alarm': { if (!deps.setAlarm) return { error: 'Alarms need the iPhone app. On the web, add a timed task instead and the app will remind you.' }; const r = await deps.setAlarm(a); return r && r.error ? { error: r.error } : { ok: true, summary: `${a.title} ${a.date && a.date !== deps.today() ? `${a.date} ` : ''}${a.time}` }; }
      case 'set_holiday': { if (!deps.holiday) return { error: 'Holiday mode is not available here.' }; const r = await deps.holiday(a); return r && r.error ? { error: r.error } : { ok: true, ...r }; }
      case 'app_lock': { const r = await deps.appLock(a.action); return r.error ? { error: r.error } : { ok: true, ...r }; }
      default: return { error: 'Unknown tool' };
    }
  };
  return { snapshot, run, refs: () => refs };
}
