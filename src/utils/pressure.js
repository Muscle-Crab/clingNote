// Visible pressure + reward/consequence display for the 8-hour day (pure; the server owns the actual rewards/penalties in eightHour stats).
export const RISK_MS = 2 * 3600000; // "streak at risk" in the last 2 hours

// Where the user should be by now if points came in evenly over the window.
export const paceOf = ({ earned = 0, target = 0, startMs, endMs, nowMs }) => {
  const span = Math.max(1, endMs - startMs); const f = Math.min(1, Math.max(0, (nowMs - startMs) / span));
  const expected = Math.round(target * f);
  return { expected, behindBy: Math.max(0, expected - earned), timePct: Math.round((1 - f) * 100), pointsPct: target > 0 ? Math.min(100, Math.round((earned / target) * 100)) : 0, leftMs: Math.max(0, endMs - nowMs) };
};
const hm = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };

// ONE alert at a time, highest priority wins. Never while offline (the server can't verify, so no pressure/consequence UI).
export const topAlert = ({ offline, running, earned = 0, target = 0, startMs, endMs, nowMs, streak = 0, warning = '' }) => {
  if (offline) return null;
  if (running && target > 0 && earned < target) {
    const p = paceOf({ earned, target, startMs, endMs, nowMs }); const need = target - earned;
    if (p.leftMs <= RISK_MS && streak > 0) return { level: 'risk', text: `🔥 Streak at risk: ${earned}/${target} pts, ${need} to go in ${hm(p.leftMs)}` };
    if (p.leftMs <= RISK_MS) return { level: 'risk', text: `⏳ ${earned}/${target} pts, ${need} to go, ${hm(p.leftMs)} left` };
    if (p.behindBy >= Math.max(5, Math.round(target * 0.1))) return { level: 'behind', text: `Behind pace by ${p.behindBy} pts (${earned}/${target} pts)` };
  }
  if (warning) return { level: 'boss', text: `⚠️ ${warning}` };
  return null;
};

export const BADGE_INFO = {
  'streak-3': { name: '3-day streak', icon: '🌿' }, 'streak-7': { name: '7-day streak', icon: '🌳' }, 'streak-15': { name: '15-day streak', icon: '🌲' },
  'streak-30': { name: '30-day streak', icon: '🏔️' }, 'streak-60': { name: '60-day streak', icon: '💎' }, 'streak-100': { name: '100-day streak', icon: '👑' },
  mvp: { name: 'MVP of the Day', icon: '🏆' }, sweep: { name: 'Clean Sweep', icon: '🧹' }, early: { name: 'Early Bird', icon: '🐦' }, beast: { name: 'Beast Mode', icon: '🦁' }, fire: { name: 'On Fire', icon: '🔥' },
};
export const badgeLabel = (id) => BADGE_INFO[id] || { name: id, icon: '🏅' };
export const levelOf = (xp = 0) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 50));

// Transient celebration to show once (keyed so it never repeats): the latest day result or a new manager award.
export const pendingCelebration = (stats, seen = {}) => {
  if (!stats) return null;
  const a = (stats.awards || [])[0];
  if (a && a.at && String(a.at) !== String(seen.award || '')) {
    const b = a.badge ? badgeLabel(a.badge) : null;
    return { key: 'award', id: String(a.at), title: 'Your manager sent you a bonus', lines: [a.bonus ? `+${a.bonus} coins` : '', b ? `${b.icon} ${b.name}` : '', a.note ? `“${a.note}”` : '', a.from ? `from ${a.from}` : ''].filter(Boolean), voice: 'Your manager sent you a bonus' };
  }
  if (stats.lastDay && stats.lastDay !== seen.day) {
    if (stats.lastResult === 'met' && stats.lastReward) {
      const r = stats.lastReward; const b = r.badge ? badgeLabel(r.badge) : null;
      return { key: 'day', id: stats.lastDay, title: 'Goal met. Well done.', lines: [`+${r.xp} XP · +${r.coins} coins`, r.shield ? '🛡️ Streak shield earned' : '', b ? `${b.icon} ${b.name} badge` : '', `🔥 ${stats.streak} day streak`].filter(Boolean), voice: `Goal met. ${stats.streak} day streak. Keep it going.` };
    }
    if (stats.lastResult === 'missed' && stats.lastPenalty) {
      const p = stats.lastPenalty;
      return { key: 'day', id: stats.lastDay, miss: true, title: 'Goal missed.', lines: [p.shieldUsed ? '🛡️ A shield saved your streak' : 'Streak lost', p.coins ? `-${p.coins} coins` : '', 'Target goes up until you hit it'].filter(Boolean), voice: p.shieldUsed ? 'Goal missed. Your shield saved the streak. No more excuses.' : 'Goal missed. Streak lost. Tomorrow you hit the target.' };
    }
  }
  return null;
};
