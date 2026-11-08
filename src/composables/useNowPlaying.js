// In-app media-session labels for focus music while ClingNote is on screen.
// A looping silent clip used to register Web Audio music with Now Playing so iOS would keep the
// process alive. UIBackgroundModes does not include audio, and no silent clip is played. Leaving
// the app suspends the music. Lock-screen controls are not a background session. Voice lines
// (useVoiceover) still clear their own media session when they end.
import { setMusicPlaying } from '../utils/audioSession.js';
const base = (typeof process !== 'undefined' && process.env && process.env.BASE_URL) || '/';
let active = false; let handlers = {};
const ms = () => (typeof navigator !== 'undefined' && navigator.mediaSession) || null;
const ACTIONS = ['play', 'pause', 'stop'];

function meta(subtitle, state) {
  const s = ms(); if (!s) return;
  try {
    const M = typeof window !== 'undefined' && window.MediaMetadata;
    if (M) s.metadata = new M({ title: 'ClingNote', artist: subtitle || 'Background music', album: 'ClingNote', artwork: [{ src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png' }] });
    s.playbackState = state;
    ACTIONS.forEach((k) => { try { s.setActionHandler(k, handlers[k] ? () => handlers[k]() : null); } catch (e) { /* unsupported action */ } });
  } catch (e) { /* ignore */ }
}

// Call from the same tap that starts the music. This does not open an audio element.
export function npStart(subtitle, h = {}) {
  handlers = h; active = true; setMusicPlaying(true);
  meta(subtitle, 'playing');
}
export function npTitle(subtitle) { if (active) meta(subtitle, 'playing'); }
// Pause only updates the in-app session label. It does not keep a silent stream running.
export function npPaused(subtitle) { if (!active) return; meta(subtitle, 'paused'); }
export function npStop() {
  const was = active; active = false; handlers = {}; setMusicPlaying(false);
  const s = ms(); if (s) { try { s.metadata = null; s.playbackState = 'none'; ACTIONS.forEach((k) => { try { s.setActionHandler(k, null); } catch (e) { /* ignore */ } }); } catch (e) { /* ignore */ } }
  if (was) import('@/composables/useVoiceover').then((m) => m.releaseMedia()).catch(() => {});
}
export const npActive = () => active;
export const _anchor = () => null;
