// Lightweight synthesized sound effects (Web Audio API, no audio files).
// Off by default; preference persisted in localStorage. Never throws.
import { ref, watch } from 'vue';

const STORAGE_KEY = 'soundEnabled';

// ── Streak music: ORIGINAL, synthesized in code (Web Audio oscillators; no samples/assets, so no third-party license applies).
// Notes as [freqHz, startSec, durSec]. Pure, so tests can check the escalation.
const C_MAJOR = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5, 1174.66, 1318.51];
// step 1..5 toward the daily streak: a short rising arpeggio that starts higher and gets one note longer each step
export const streakStepNotes = (step, of = 5) => {
  const s = Math.max(1, Math.min(of, Math.round(step) || 1));
  return Array.from({ length: s + 1 }, (_, i) => [C_MAJOR[Math.min(C_MAJOR.length - 1, s - 1 + i)], i * 0.07, i === s ? 0.28 : 0.12]);
};
// streak hit / streak counter up: a ~2.4 s fanfare (rising run, I–IV–V–I chords, held top note)
export const streakHitNotes = () => {
  const run = [523.25, 659.25, 783.99, 1046.5].map((f, i) => [f, i * 0.09, 0.16]);
  const chords = [[[523.25, 659.25, 783.99], 0.45], [[698.46, 880.0, 1046.5], 0.8], [[783.99, 987.77, 1174.66], 1.15], [[1046.5, 1318.51, 1567.98], 1.5]];
  return [...run, ...chords.flatMap(([fs, t], ci) => fs.map((f) => [f, t, ci === 3 ? 0.9 : 0.32]))];
};

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

  const playSound = (kind, opts = {}) => {
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
      } else if (kind === 'streakStep') {
        streakStepNotes(opts.step, opts.of).forEach(([f, s, d]) => tone(c, { freq: f, start: s, dur: d, type: 'triangle', gain: 0.1 }));
      } else if (kind === 'streakHit') {
        streakHitNotes().forEach(([f, s, d]) => tone(c, { freq: f, start: s, dur: d, type: 'triangle', gain: 0.08 }));
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
    if (soundEnabled.value) playSound('dragStart'); // (src/utils/sfx.js reads the same 'soundEnabled' key)
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
