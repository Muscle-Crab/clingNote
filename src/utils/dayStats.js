// Pure day-level calculations (no component state): pass in what they need.
export const formatElapsed = (ms) => {
  const minutes = Math.floor(ms / 60000);
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
};

// Progress % for the selected day: only top-level tasks (subtasks never count); 0 for non-today tabs.
export const completionPercentage = (routine, wontDoCount, selectedDayIndex) => {
  const todayIndex = new Date().getDay(); // Get current day index
  if (selectedDayIndex !== todayIndex) {
    return 0; // Reset progress for non-today tabs
  }

  if (!routine) return 0;

  const totalTasks = routine.length + wontDoCount;
  const completedTasks = routine.filter(task => task.completed).length;

  return totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
};

export const computeTimeStats = (daySession, routine, wontDoCount) => {
  const start = daySession.startTime
      ? new Date(daySession.startTime.seconds ? daySession.startTime.seconds * 1000 : daySession.startTime)
      : null;

  const end = daySession.ended
      ? new Date(daySession.endTime?.seconds ? daySession.endTime.seconds * 1000 : daySession.endTime)
      : new Date();

  if (!start) {
    return {
      totalDayTime: "0m",
      productiveTime: "0m",
      gapTime: "0m",
      completedTasks: 0,
      missedTasks: wontDoCount
    };
  }

  const totalMs = end - start;

  const productiveMs = routine.reduce((sum, task) => {
    if (task.completed && task.timerStartedAt && task.timerStoppedAt) {
      return sum + (new Date(task.timerStoppedAt) - new Date(task.timerStartedAt));
    }
    return sum;
  }, 0);
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
  const endOfYear = new Date(today.getFullYear(), 11, 31); // December 31
  const diffTime = endOfYear - today;
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
