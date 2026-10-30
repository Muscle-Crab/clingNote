// Central, tiny app-wide sound effects. ORIGINAL: synthesized in code with Web Audio oscillators/noise
// (no samples, no third-party audio, so no license applies). Quiet, short, throttled.
// Honors the existing Sounds on/off setting (localStorage 'soundEnabled', toggled in the Home menu).
// Plays only after a real user gesture has happened in this page session (never on first page load).
const STORAGE_KEY = 'soundEnabled';
const THROTTLE_MS = { tap: 90, open: 200, add: 250, complete: 200, timerStart: 400, timerStop: 400, points: 0, coin: 45, levelUp: 1500, impact: 1200, charge: 1200, grow: 1200, error: 500 };
let ctx = null; let gestured = false; const last = {}; let OFF = 0; // OFF: schedule offset (offline rendering only)
if (typeof window !== 'undefined') {
  const mark = () => { gestured = true; };
  window.addEventListener('pointerdown', mark, { capture: true, passive: true });
  window.addEventListener('keydown', mark, { capture: true, passive: true });
}
export const sfxEnabled = () => { try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch (e) { return false; } };
export const __sfxTest = { setGestured: (v) => { gestured = !!v; }, reset: () => { Object.keys(last).forEach((k) => delete last[k]); } };
// throttle check, pure enough to test: returns true when `kind` may play at time `now`
export const sfxAllowed = (kind, now = Date.now()) => {
  const gap = THROTTLE_MS[kind] ?? 150;
  if (last[kind] && now - last[kind] < gap) return false;
  last[kind] = now; return true;
};
const getCtx = () => {
  try {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch (e) { return null; }
};
const tone = (c, { freq, start = 0, dur = 0.15, type = 'sine', gain = 0.06, endFreq = null }) => {
  const t0 = c.currentTime + OFF + start; const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.03);
};
// soft filtered noise "rustle" (leaves) for the plant growth
const rustle = (c, { start = 0, dur = 0.6, gain = 0.035, from = 900, to = 3200 }) => {
  const t0 = c.currentTime + OFF + start; const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < n; i += 1) d[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(i / n * Math.PI * 9));
  const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(c.destination); src.start(t0); src.stop(t0 + dur + 0.05);
};
// coin clink: two bright detuned partials, quick decay (pitch rises slightly with `step`)
const coin = (c, start = 0, step = 0, gain = 0.045) => {
  const base = 1975 + Math.min(12, step) * 30;
  tone(c, { freq: base, start, dur: 0.07, type: 'square', gain: gain * 0.5 });
  tone(c, { freq: base * 1.5, start: start + 0.035, dur: 0.16, type: 'sine', gain });
};
const SOUNDS = {
  tap: (c) => tone(c, { freq: 880, endFreq: 1100, dur: 0.04, type: 'triangle', gain: 0.025 }),
  open: (c) => tone(c, { freq: 420, endFreq: 760, dur: 0.12, type: 'sine', gain: 0.04 }),
  add: (c) => { tone(c, { freq: 523.25, dur: 0.09, type: 'triangle', gain: 0.05 }); tone(c, { freq: 784, start: 0.07, dur: 0.14, type: 'triangle', gain: 0.05 }); },
  complete: (c) => { tone(c, { freq: 659.25, dur: 0.14, gain: 0.07 }); tone(c, { freq: 987.77, start: 0.08, dur: 0.26, gain: 0.07 }); },
  timerStart: (c) => { tone(c, { freq: 440, dur: 0.08, type: 'triangle', gain: 0.05 }); tone(c, { freq: 660, start: 0.09, dur: 0.12, type: 'triangle', gain: 0.05 }); },
  timerStop: (c) => { tone(c, { freq: 660, dur: 0.08, type: 'triangle', gain: 0.05 }); tone(c, { freq: 440, start: 0.09, dur: 0.14, type: 'triangle', gain: 0.05 }); },
  coin: (c, o) => coin(c, 0, o.step || 0, 0.03),
  points: (c) => { coin(c, 0, 8, 0.05); tone(c, { freq: 2637, start: 0.08, dur: 0.35, type: 'sine', gain: 0.035 }); tone(c, { freq: 3136, start: 0.12, dur: 0.4, type: 'sine', gain: 0.025 }); },
  levelUp: (c) => [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(c, { freq: f, start: i * 0.08, dur: i === 4 ? 0.5 : 0.16, type: 'triangle', gain: 0.06 })),
  grow: (c) => { rustle(c, { dur: 0.9 }); [392, 493.88, 587.33, 783.99].forEach((f, i) => tone(c, { freq: f, endFreq: f * 1.02, start: 0.15 + i * 0.13, dur: 0.4, type: 'sine', gain: 0.045 })); },
  // battle-royale style kill-streak hit: sub thump + noise crack + bright stinger (original synthesis)
  impact: (c) => { tone(c, { freq: 140, endFreq: 42, dur: 0.38, type: 'sine', gain: 0.22 }); rustle(c, { dur: 0.18, gain: 0.09, from: 2400, to: 600 });
    tone(c, { freq: 880, start: 0.05, dur: 0.12, type: 'square', gain: 0.03 }); tone(c, { freq: 1318.5, start: 0.12, dur: 0.45, type: 'sawtooth', gain: 0.025 }); tone(c, { freq: 1760, start: 0.12, dur: 0.45, type: 'triangle', gain: 0.03 }); },
  // rising "charge" while the streak medal fills (dur seconds)
  charge: (c, o) => { const d = o.dur || 1; tone(c, { freq: 220, endFreq: 880, dur: d, type: 'sawtooth', gain: 0.018 }); tone(c, { freq: 330, endFreq: 1320, dur: d, type: 'triangle', gain: 0.03 }); },
  error: (c) => { tone(c, { freq: 220, endFreq: 160, dur: 0.16, type: 'sawtooth', gain: 0.025 }); tone(c, { freq: 180, start: 0.12, endFreq: 130, dur: 0.18, type: 'sawtooth', gain: 0.02 }); },
};
export const SFX_KINDS = Object.keys(SOUNDS);
export const sfx = (kind, opts = {}) => {
  try {
    if (!SOUNDS[kind] || !sfxEnabled() || (!gestured && !opts.force)) return false;
    if (!sfxAllowed(kind)) return false;
    const c = getCtx(); if (!c) return false;
    SOUNDS[kind](c, opts);
    try { window.dispatchEvent(new window.CustomEvent('cn:sfx', { detail: { kind, t: Date.now(), opts } })); } catch (e) { /* test hook only */ }
    return true;
  } catch (e) { return false; }
};
// Coin ticks synced to a count-up of `steps` frames over `ms`: at most ~12 clinks (throttled for big jumps), then a final chime.
export const coinTickTimes = (delta, ms) => { const n = Math.max(1, Math.min(12, Math.round(Math.abs(delta) / 5) || 1)); return Array.from({ length: n }, (_, i) => Math.round((i / n) * ms)); };

// Offline render of a logged timeline [{ kind, at (s), opts }] to mono samples (used by the local e2e to mux the clip's
// audio; Web Audio can't be captured by video recording). Exposed on window only when localStorage cn_sfx_debug = '1'.
export const renderSfxTimeline = async (events, totalSec, rate = 44100) => {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; const c = new OAC(1, Math.ceil(totalSec * rate), rate);
  for (const e of events) { if (!SOUNDS[e.kind]) continue; OFF = Math.max(0, e.at); try { SOUNDS[e.kind](c, e.opts || {}); } finally { OFF = 0; } }
  const buf = await c.startRendering(); return Array.from(buf.getChannelData(0));
};
try { if (typeof window !== 'undefined' && localStorage.getItem('cn_sfx_debug') === '1') window.__cnSfxRender = renderSfxTimeline; } catch (e) { /* ignore */ }
