// Pure levels / XP / streak-milestone rewards / share-card data.
import { safeName } from './ranking';

// XP = lifetime points. Level L starts at 50*L*(L-1) XP: L2=100, L3=300, L4=600, L5=1000 ...
export const xpForLevel = (level) => 50 * level * (level - 1);
export const levelFor = (xp) => {
  const x = Math.max(0, Number(xp) || 0);
  let level = 1;
  while (xpForLevel(level + 1) <= x) level++;
  const floor = xpForLevel(level); const next = xpForLevel(level + 1);
  return { level, xp: x, floor, next, toNext: next - x, pct: Math.round(((x - floor) / (next - floor)) * 100) };
};

export const MILESTONES = [
  { days: 3, kind: 'theme', theme: 'ember', label: '🔥 Ember theme' },
  { days: 7, kind: 'freeze', label: '🧊 1 streak freeze' },
  { days: 14, kind: 'theme', theme: 'ocean', label: '🌊 Ocean theme' },
  { days: 30, kind: 'break', bonus: 5, label: '☕ +5 min on every full day’s break' },
];
// Unlocked by best streak (rewards are permanent once earned).
export const rewardsFor = (bestStreak) => {
  const unlocked = MILESTONES.filter((m) => (Number(bestStreak) || 0) >= m.days);
  return {
    unlocked,
    themes: unlocked.filter((m) => m.kind === 'theme').map((m) => m.theme),
    freezes: unlocked.filter((m) => m.kind === 'freeze').length,
    breakBonus: unlocked.filter((m) => m.kind === 'break').reduce((a, m) => a + m.bonus, 0),
    next: MILESTONES.find((m) => (Number(bestStreak) || 0) < m.days) || null,
  };
};

// Spend a freeze to cover `missedDate` (streak unchanged, day treated as counted).
export const useFreeze = (state, missedDate, { freezes = 0, used = 0 } = {}) => {
  if (freezes - used <= 0) return { used: false, state };
  const counted = [...new Set([...(state?.counted || []), missedDate])].slice(-62);
  return { used: true, state: { ...state, lastCompletionDate: missedDate, counted, prev: null } };
};

// Data for the shareable streak card. Never includes email or uid.
export const shareCardData = ({ displayName, streak = 0, bestStreak = 0, level = 1, tier = 'Bronze' } = {}) => ({
  name: safeName(displayName), streak: Math.min(5, Number(streak) || 0), bestStreak: Number(bestStreak) || 0, level: Number(level) || 1, tier: String(tier),
});
