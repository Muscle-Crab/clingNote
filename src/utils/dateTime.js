import { localYMD } from './localDate.js';
export const getTodayId = () => {
  return new Date().toLocaleDateString("en-CA");
};

export const formatSessionTime = (date) => {
  if (!date) return "";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

export const getCurrentDate = () => {
  const today = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return new Intl.DateTimeFormat('en-US', options).format(today);
};

export const isToday = (index) => {
  return index === new Date().getDay();
};

export const formatShortDate = (date) => {
  if (!date) return "";
  const options = { month: "short", day: "numeric" }; // Example: "Feb 19"
  // 'YYYY-MM-DD' must be read as a LOCAL date: new Date('2025-07-08') is UTC midnight = Jul 7 in the Americas.
  const m = typeof date === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date(date);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", options);
};

// A one-off reminder (no repeat) whose date+time is already past is stale: hide it in the UI (data untouched).
export const isReminderPast = (reminder, now = new Date()) => {
  if (!reminder?.date || !reminder?.time || (reminder.repeat && !['none', 'never'].includes(reminder.repeat))) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(reminder.date); const t = /^(\d{1,2}):(\d{2})/.exec(reminder.time);
  if (!m || !t) return false;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(t[1]), Number(t[2])).getTime() < now.getTime();
};
export const showReminder = (reminder, now = new Date()) => !!(reminder?.date && reminder?.time) && !isReminderPast(reminder, now);

export const formatTime = (time) => {
  const [hours, minutes] = time.split(':');
  const amPm = parseInt(hours) >= 12 ? 'PM' : 'AM';
  const formattedHours = parseInt(hours) % 12 || 12;
  return `${formattedHours}:${minutes} ${amPm}`;
};

export const formatDate = (date) => {
  if (!date) return "";
  const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
  return new Date(date).toLocaleDateString("en-US", options);
};

export const getOrdinalSuffix = (number) => {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = number % 100;
  return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
};

// Local (phone timezone) YYYY-MM-DD. Was UTC (toISOString), which is tomorrow after ~8PM in the US.
export const getTodayDate = () => localYMD();

export const extractYouTubeID = (url) => {
  const match = url.match(/(?:\?v=|\/embed\/|\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
};

