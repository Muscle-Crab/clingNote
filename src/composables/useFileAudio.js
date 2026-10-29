// Recorded tracks (TRACKS entries with `src`) play through one HTMLAudioElement. Unlike Web Audio, an <audio>
// element keeps playing when the iPhone locks (with UIBackgroundModes=audio) and is what WKWebView reports to
// Now Playing / Control Center. Same interface as createEngine() so useBackground can swap between them.
import { trackInfo } from '../utils/bgPrefs.js';

const assetUrl = (src) => { const base = (typeof process !== 'undefined' && process.env && process.env.BASE_URL) || '/'; return /^(https?:|data:|blob:|\/)/.test(src) ? src : base.replace(/\/?$/, '/') + src; };
export { assetUrl };

export const createFileEngine = (makeEl = () => (typeof Audio !== 'undefined' ? new Audio() : null)) => {
  const el = makeEl(); if (!el) return null;
  el.preload = 'auto'; el.loop = true; el.setAttribute && el.setAttribute('playsinline', '');
  let playing = false; let track = ''; let volume = 0.5; let onState = null; let fade = 0;
  const emit = (st) => { if (onState) onState(st); };
  // Externally paused (call, Siri, headphones out, lock-screen pause handled elsewhere): report it.
  el.addEventListener && el.addEventListener('pause', () => { if (playing && !el.ended) { playing = false; emit('suspended'); } });
  el.addEventListener && el.addEventListener('playing', () => emit('running'));
  const load = (id) => { const t = trackInfo(id); track = t.id; const url = assetUrl(t.src); if (el.getAttribute ? el.getAttribute('src') !== url : el.src !== url) el.src = url; };
  const ramp = (to, ms, done) => { clearInterval(fade); const from = el.volume; const n = Math.max(1, Math.round(ms / 50)); let i = 0; fade = setInterval(() => { i += 1; el.volume = Math.min(1, Math.max(0, from + (to - from) * (i / n))); if (i >= n) { clearInterval(fade); if (done) done(); } }, 50); };
  return {
    kind: 'file', el,
    get playing() { return playing; },
    get state() { return playing ? 'running' : el.src ? 'suspended' : 'none'; },
    get track() { return track; },
    set onStateChange(fn) { onState = fn; },
    // From a tap: play() is called synchronously so iOS keeps the gesture.
    start(id, vol) {
      volume = vol ?? volume; load(id || track); playing = true; clearInterval(fade); el.volume = 0;
      let p; try { p = el.play(); } catch (e) { p = Promise.reject(e); }
      ramp(volume, 600);
      return Promise.resolve(p).catch((e) => { playing = false; emit('suspended'); throw e; });
    },
    async resume() { if (!el.src) return 'none'; try { await el.play(); playing = true; ramp(volume, 400); } catch (e) { /* needs a tap */ } return playing ? 'running' : 'suspended'; },
    setTrack(id) { const was = playing; load(id); if (was) { el.currentTime = 0; el.play().catch(() => {}); } },
    crossfadeTo(id, secs = 2.4) { if (!playing) { load(id); return; } ramp(0, (secs / 2) * 1000, () => { if (!playing) return; load(id); el.play().catch(() => {}); ramp(volume, (secs / 2) * 1000); }); },
    setVolume(v) { volume = v; clearInterval(fade); el.volume = v; },
    async stop() { playing = false; ramp(0, 250, () => { if (!playing) el.pause(); }); await new Promise((r) => setTimeout(r, 300)); },
    seekBy(s) { try { el.currentTime = Math.max(0, (el.currentTime || 0) + s); } catch (e) { /* not seekable yet */ } },
    level() { return playing && !el.paused ? 0.1 : 0; },
  };
};
