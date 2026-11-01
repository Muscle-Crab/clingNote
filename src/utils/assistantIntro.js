// Spoken intro when the Assistant sheet opens. Full intro once per local day; later opens get a one-liner at most every 30 min, else silence.
// Every example maps to an assistant tool: auto_schedule/create_tasks, reschedule_task, complete_task, lock_apps, unlock_apps.
export const INTRO_FULL = "Hi, I'm your ClingNote assistant. I can plan your day, add, move, or finish tasks, and lock or unlock apps. Try saying: plan my day with gym at seven and two hours of deep work, move groceries to the afternoon, mark the report done, lock Instagram for an hour, or unlock my apps. What should we do first?";
export const INTRO_SHORT = 'Hi again. What should we do?';
export const INTRO_EXAMPLES = ['Plan my day with gym at 7 and two hours of deep work', 'Move groceries to the afternoon', 'Mark the report done', 'Lock Instagram for an hour', 'Unlock my apps'];
const KEY = 'cn.assistant.intro'; const SHORT_GAP_MS = 30 * 60 * 1000;
const day = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
export function pickIntro(state, now = new Date()) {
  const s = state || {};
  if (s.fullDay !== day(now)) return { text: INTRO_FULL, kind: 'full' };
  if (!s.shortAt || now.getTime() - s.shortAt >= SHORT_GAP_MS) return { text: INTRO_SHORT, kind: 'short' };
  return null;
}
// speak(text) -> truthy if it actually started (speakLive returns false when muted). enabled() = sheet's spoken-replies toggle.
export function createIntro({ speak, stop, enabled = () => true, storage = (typeof localStorage !== 'undefined' ? localStorage : null), now = () => new Date() }) {
  let active = false;
  const read = () => { try { return JSON.parse(storage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const write = (v) => { try { storage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  return {
    start(force = false) {
      if (!enabled()) return null;
      const n = now(); const pick = force ? { text: INTRO_FULL, kind: 'full' } : pickIntro(read(), n);
      if (!pick || !speak(pick.text)) return null;
      active = true; const st = read();
      if (pick.kind === 'full') st.fullDay = day(n); else st.shortAt = n.getTime();
      write(st); return pick.kind;
    },
    cancel() { if (active) { active = false; stop(); } },
    get active() { return active; },
  };
}
