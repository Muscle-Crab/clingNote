// Helpers for tasks created with several weekdays at once (e.g. "Daily"): one stored copy per weekday, same createdAt+title.
import { weekDates } from '@/utils/scheduling';
import { taskKey } from '@/utils/taskPlanning';

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// First date a copy for weekday `dayIndex` should show: '' (no limit) when that weekday is today or still ahead this week,
// otherwise the same weekday next week. Keeps past days of the current week free of a task created today.
export const activeFromForDay = (dayIndex, now = new Date()) => {
  if (dayIndex >= now.getDay()) return '';
  const [y, m, d] = weekDates(now)[dayIndex].split('-').map(Number);
  return fmt(new Date(y, m - 1, d + 7));
};

// Hidden when the task is not active yet on the date of the tab being viewed.
export const isHiddenOnDate = (task, tabDate) => !!(task && task.activeFrom && tabDate && tabDate < task.activeFrom);

// Weekday names (other than `exceptDay`) whose stored lists hold a copy of `task` (same non-empty createdAt + title).
export const seriesDays = (tasksByDay, task, exceptDay) => {
  if (!task || !task.createdAt) return [];
  const key = taskKey(task);
  return Object.keys(tasksByDay || {}).filter((d) => d !== exceptDay && (tasksByDay[d] || []).some((t) => t && t.createdAt && taskKey(t) === key));
};

// A list without every copy of the series.
export const withoutSeries = (tasks, task) => (tasks || []).filter((t) => taskKey(t) !== taskKey(task));
