// Locked-in plan ("I'll do N tasks today"): adding a task when the plan is already full raises the requirement by one
// instead of refusing the add. Pure helpers so the rule is unit-tested (scripts/test-plan-raise.mjs).
export const MAX_PLAN = 50; // eightHourCore MAX_TASKS_PER_DAY
// plan: { wakeTime, taskCount } | null, countNow: countable tasks already on today, adding: how many are being added.
// Returns null (no change needed / no plan) or the new plan to save.
export const raisedPlan = (plan, countNow, adding = 1) => {
  if (!plan || !plan.wakeTime) return null;
  const need = Number(countNow) + Number(adding);
  if (need <= Number(plan.taskCount)) return null;
  return { wakeTime: plan.wakeTime, taskCount: Math.min(MAX_PLAN, need) };
};
// Adds the task first, then raises the plan; a failed raise never blocks the task. deps: { addTask() -> bool, savePlan(plan) }
export async function addWithPlanRaise({ plan, countNow, addTask, savePlan }) {
  const next = raisedPlan(plan, countNow, 1);
  const ok = await addTask();
  if (!ok) return { ok: false, plan: plan || null };
  if (!next) return { ok: true, plan: plan || null };
  try { await savePlan(next); return { ok: true, plan: next }; } catch (e) { return { ok: true, plan: plan || null, raiseError: e && e.message }; }
}
