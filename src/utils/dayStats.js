// Pure day-level calculations (no component state): pass in what they need.
export const formatElapsed = (ms) => {
  ms = Number.isFinite(Number(ms)) ? Math.max(0, Number(ms)) : 0;
  const minutes = Math.floor(ms / 60000);
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
};

// Progress % for the selected day: only top-level tasks (subtasks never count); 0 for non-today tabs.
// `todayIndex` is passed by the caller from a reactive clock so a stale/rolled-over day can't zero the percentage.
export const completionPercentage = (routine, wontDoCount, selectedDayIndex, todayIndex = new Date().getDay()) => {
  wontDoCount = Number(wontDoCount) || 0;
  if (selectedDayIndex !== todayIndex) {
    return 0; // Reset progress for non-today tabs
  }

  if (!routine) return 0;

  const totalTasks = routine.length + wontDoCount;
  const completedTasks = routine.filter(task => task && task.completed).length;

  return totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
};

export const computeTimeStats = (daySession, routine, wontDoCount) => {
  routine = Array.isArray(routine) ? routine : [];
  daySession = daySession || {};
  const toD = (t) => (t?.toDate ? t.toDate() : new Date(t?.seconds ? t.seconds * 1000 : t));
  const start = daySession.startTime ? toD(daySession.startTime) : null;

  const end = daySession.ended
      ? toD(daySession.endTime)
      : new Date();

  if (!start || isNaN(start)) {
    return {
      totalDayTime: "0m",
      productiveTime: "0m",
      gapTime: "0m",
      completedTasks: 0,
      missedTasks: wontDoCount
    };
  }

  const totalMs = isNaN(end) ? 0 : Math.max(0, end - start);

  // Focused = timer intervals of completed tasks, clipped to today's session window. A recurring task can carry a
  // timerStartedAt from an earlier week (the old-week reset used to keep it), so an unclipped stop-start reached
  // thousands of hours. Each interval is clipped to [start, end] and the total can never exceed the session length.
  const ms = (t) => { const d = toD(t); const v = d && d.getTime ? d.getTime() : NaN; return Number.isFinite(v) ? v : NaN; };
  const s0 = start.getTime(), e0 = end.getTime();
  const productiveRaw = routine.reduce((sum, task) => {
    if (!task || !task.completed || !task.timerStartedAt || !task.timerStoppedAt) return sum;
    const a = Math.max(ms(task.timerStartedAt), s0), b = Math.min(ms(task.timerStoppedAt), e0);
    return Number.isFinite(a) && Number.isFinite(b) && b > a ? sum + (b - a) : sum;
  }, 0);
  const productiveMs = Math.max(0, Math.min(productiveRaw, Math.max(0, totalMs)));
  const gapMs = Math.max(0, totalMs - productiveMs);

  return {
    totalDayTime: formatElapsed(totalMs),
    productiveTime: formatElapsed(productiveMs),
    gapTime: formatElapsed(gapMs),
    completedTasks: routine.filter(t => t.completed).length,
    missedTasks: wontDoCount
  };
};

export const daysLeftInYearFrom = (today = new Date()) => {
  // Compare wall-clock components in UTC so a daylight-saving change between now and Dec 31 can't shift the count by a day.
  const endOfYear = Date.UTC(today.getFullYear(), 11, 31); // December 31
  const nowWall = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), today.getHours(), today.getMinutes(), today.getSeconds(), today.getMilliseconds());
  const diffTime = endOfYear - nowWall;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Remaining time of a running task timer as HH:MM:SS (nowMs comes from a reactive tick in the caller).
export const taskTimeLeft = (task, nowMs) => {
  if (!task.timerEndTime) return "";

  const end = new Date(task.timerEndTime).getTime();
  const remaining = Math.max(0, end - nowMs);

  const totalSeconds = Math.floor(remaining / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Hero heading: motivational on today, weekday-appropriate on other days of the (Sun..Sat) week.
export const heroTitleFor = (selectedIndex, todayIndex) => {
  if (selectedIndex === todayIndex || selectedIndex < 0 || selectedIndex > 6) return 'Make today count.';
  const name = WEEKDAYS[selectedIndex];
  return selectedIndex < todayIndex ? `Looking back at ${name}` : `Plan your ${name}`;
};
