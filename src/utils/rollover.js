// Rollover notice: tasks moved to a later day (timer-expiry auto move or the shutdown carry) are announced once.
// A rollover is identified by its stamp (rolledOverFor / carriedFrom); the seen ids live in localStorage per user.
export const rolloverIdOf = (t) => (t && !t.completed && (t.rolledOverFor || t.carriedFrom)) || '';

export const rolloverMessage = (titles, max = 3) => {
  const list = (titles || []).map((s) => String(s || '').trim() || 'Untitled task');
  const n = list.length;
  if (!n) return '';
  const shown = list.slice(0, max).join(', ');
  const more = n > max ? ` +${n - max} more` : '';
  return `${n} task${n === 1 ? '' : 's'} moved from yesterday: ${shown}${more}`;
};

export const seenKey = (uid) => `cn_rollover_seen_${uid || 'anon'}`;
export const loadSeen = (storage, uid) => { try { return JSON.parse(storage.getItem(seenKey(uid)) || '[]'); } catch (e) { return []; } };
export const markSeen = (storage, uid, ids) => {
  const all = [...new Set([...loadSeen(storage, uid), ...(ids || [])])].slice(-60);
  try { storage.setItem(seenKey(uid), JSON.stringify(all)); } catch (e) { /* private mode */ }
  return all;
};
// The unseen rollover on this list: { ids, tasks, message } or null.
export const pendingRollover = (tasks, seen) => {
  const s = new Set(seen || []);
  const moved = (tasks || []).filter((t) => { const id = rolloverIdOf(t); return id && !s.has(id); });
  if (!moved.length) return null;
  return { ids: [...new Set(moved.map(rolloverIdOf))], tasks: moved, message: rolloverMessage(moved.map((t) => t.title)) };
};
export const rolloverNotifBody = (titles) => rolloverMessage(titles).replace('moved from yesterday', 'moved to tomorrow');
