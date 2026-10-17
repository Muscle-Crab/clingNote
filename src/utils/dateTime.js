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
  return new Date(date).toLocaleDateString("en-US", options);
};

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

export const getTodayDate = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate comparison
  const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  console.log("Today's Date:", formattedDate); // Log the date for debugging
  return formattedDate;
};

export const extractYouTubeID = (url) => {
  const match = url.match(/(?:\?v=|\/embed\/|\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
};

