// Break indicator (Home): a small popup when a break becomes available, which collapses into a floating side pill.
// Breaks stay OPTIONAL: nothing here ever starts one; the pill only offers it (and counts down while one runs).
// mode: 'hidden' | 'popup' | 'pill' | 'running'. seen = { day, n } of the break the user already tapped/dismissed.
export const indicatorMode = ({ available = false, running = false, n = 0, day = '', seen = null } = {}) => {
  if (running) return 'running';
  if (!available) return 'hidden';
  return seen && seen.day === day && Number(seen.n) >= n ? 'pill' : 'popup';
};
// Tap or dismiss the popup: remember break n for today so it collapses to the pill (and does not pop again on reload).
export const collapse = (day, n) => ({ day, n: Number(n) || 0 });
export const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil((Number(ms) || 0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const SEEN_KEY = 'cn.gp.breakSeen';
