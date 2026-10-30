// Tiny rAF tween for animated numbers. Returns a cancel fn. Reduced motion => instant.
export const prefersReducedMotion = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const tweenNumber = (from, to, ms, onStep, ease = easeOutCubic) => {
  if (from === to || ms <= 0 || prefersReducedMotion() || typeof window === 'undefined' || !window.requestAnimationFrame) { onStep(to, 1); return () => {}; }
  let raf = 0; const t0 = window.performance.now();
  const step = (now) => { const t = Math.min(1, (now - t0) / ms); onStep(from + (to - from) * ease(t), t); if (t < 1) raf = window.requestAnimationFrame(step); };
  raf = window.requestAnimationFrame(step);
  return () => window.cancelAnimationFrame(raf);
};
// Last-seen stage/streak per user+device (localStorage). Stage is per day; streak is global.
export const seenKey = (kind, uid) => `cn_seen_${kind}_${uid || 'anon'}`;
export const readSeen = (kind, uid, date = null) => { try { const v = JSON.parse(localStorage.getItem(seenKey(kind, uid)) || 'null'); if (!v) return null; if (date && v.date !== date) return null; return Number(v.value); } catch (e) { return null; } };
export const writeSeen = (kind, uid, value, date = null) => { try { localStorage.setItem(seenKey(kind, uid), JSON.stringify({ value, date })); } catch (e) { /* ignore */ } };
