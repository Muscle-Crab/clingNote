// Lightweight synthesized sound effects (Web Audio API, no audio files).
// Off by default; preference persisted in localStorage. Never throws.
import { ref, watch } from 'vue';

const STORAGE_KEY = 'soundEnabled';

export function useSounds() {
  const soundEnabled = ref(false);
  try { soundEnabled.value = localStorage.getItem(STORAGE_KEY) === 'true'; } catch (e) { /* ignore */ }

  let ctx = null;
  const getCtx = () => {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC(); // created lazily, from a user gesture
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) {
      return null;
    }
  };

  const tone = (c, { freq, start = 0, dur = 0.2, type = 'sine', gain = 0.12, endFreq = null }) => {
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  };

  const playSound = (kind) => {
    try {
      if (!soundEnabled.value) return;
      const c = getCtx();
      if (!c) return;
      if (kind === 'complete') {
        tone(c, { freq: 659.25, dur: 0.18 });
        tone(c, { freq: 987.77, start: 0.09, dur: 0.32 });
      } else if (kind === 'milestone') {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          tone(c, { freq: f, start: i * 0.1, dur: 0.35, type: 'triangle', gain: 0.14 }));
      } else if (kind === 'dragStart') {
        tone(c, { freq: 300, endFreq: 600, dur: 0.09, type: 'triangle', gain: 0.05 });
      } else if (kind === 'dragEnd') {
        tone(c, { freq: 520, endFreq: 260, dur: 0.12, type: 'triangle', gain: 0.06 });
      }
    } catch (e) { /* audio must never break features */ }
  };

  const toggleSound = () => {
    soundEnabled.value = !soundEnabled.value;
    try { localStorage.setItem(STORAGE_KEY, String(soundEnabled.value)); } catch (e) { /* ignore */ }
    if (soundEnabled.value) playSound('dragStart');
  };

  // Milestone chime: only on an upward crossing caused by the user completing a task
  // (not on initial load or when switching days).
  let lastGestureAt = 0;
  const markUserCompletion = () => { lastGestureAt = Date.now(); };

  const watchMilestones = (percentGetter, milestones, dayIndexRef) => {
    let prev = null;
    watch(dayIndexRef, () => { prev = null; });
    watch(percentGetter, (now) => {
      try {
        const before = prev;
        prev = now;
        if (before === null || now <= before) return;
        if (Date.now() - lastGestureAt > 15000) return;
        if (milestones.value.some((m) => m.percent > 0 && before < m.percent && now >= m.percent)) {
          setTimeout(() => playSound('milestone'), 450);
        }
      } catch (e) { /* ignore */ }
    }, { flush: 'post' });
  };

  return { soundEnabled, playSound, toggleSound, markUserCompletion, watchMilestones };
}
