// Locked-in day overload cap: before the countdown starts, today's list may hold min..max tasks for the chosen hours
// (eightHourCore.taskRange). Adding past max is blocked with a short message; adding never changes the plan count.
// Pure so it is unit-tested (scripts/test-plan-raise.mjs).
// countNow: countable tasks already on today, adding: how many this add puts on today, range: { hours, min, max }, hoursText: e.g. "8".
// Returns null when the add fits, otherwise the message to show.
export const capBlockMessage = (countNow, adding, range, hoursText) => {
  if (!range || !(range.max > 0)) return null;
  if (Number(countNow) + Number(adding) <= range.max) return null;
  return `Max ${range.max} tasks for ${hoursText} hours. Remove one to add another.`;
};
