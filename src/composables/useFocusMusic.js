// Soft looping "Focus music" (public/audio/focus-loop.mp3: original loop synthesized locally, royalty-free).
// This is the ONLY thing that should own the iOS lock-screen Now Playing widget: title "ClingNote", subtitle "Focus music",
// with working play/pause. Voice lines (useVoiceover) release Now Playing when they end and never touch it while music is on.
// Default: plays while the Assistant sheet is open (paused while the mic listens), only if the robot voice is not muted and
// the sheet's speaker toggle is on. Low volume, ducks while the voice speaks. stop() pauses, drops the src and clears Now Playing.
import { ref, watch } from 'vue';
import { voMuted, voSpeaking, _setMusicHolds, releaseMedia } from '@/composables/useVoiceover';

export const MUSIC_VOL = 0.18; export const DUCK_VOL = 0.05;
export const musicOn = ref(false); // wanted by the app (a context like the open sheet asked for it)
export const musicPlaying = ref(false); // actually playing (lock-screen pause flips this, musicOn stays)
const base = (typeof process !== 'undefined' && process.env && process.env.BASE_URL) || '/';
let a = null;
const ms = () => (typeof navigator !== 'undefined' && navigator.mediaSession) || null;
const MediaMeta = () => (typeof window !== 'undefined' && window.MediaMetadata) || null;

function setSession(state) {
  const s = ms(); if (!s) return;
  try {
    if (state === 'none') { s.metadata = null; s.playbackState = 'none'; ['play', 'pause', 'stop'].forEach((x) => { try { s.setActionHandler(x, null); } catch (e) { /* ignore */ } }); return; }
    const M = MediaMeta(); if (M) s.metadata = new M({ title: 'ClingNote', artist: 'Focus music', album: 'ClingNote', artwork: [{ src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png' }] });
    s.playbackState = state;
    s.setActionHandler('play', () => { resume(); });
    s.setActionHandler('pause', () => { pause(); });
    s.setActionHandler('stop', () => { stopMusic(); });
  } catch (e) { /* ignore */ }
}
const el = () => { if (!a && typeof Audio !== 'undefined') { a = new Audio(); a.loop = true; a.preload = 'auto'; } return a; };
const applyVol = () => { if (a) { try { a.volume = voSpeaking.value ? DUCK_VOL : MUSIC_VOL; } catch (e) { /* iOS: volume is read-only, asset is mastered quiet */ } } };

function resume() {
  const x = el(); if (!x || voMuted.value) return false;
  if (!x.getAttribute('src')) x.src = `${base}audio/focus-loop.mp3`;
  applyVol();
  try { const p = x.play(); if (p && p.catch) p.catch(() => { musicPlaying.value = false; }); } catch (e) { return false; }
  musicPlaying.value = true; setSession('playing'); return true;
}
function pause() { if (a) { try { a.pause(); } catch (e) { /* ignore */ } } musicPlaying.value = false; setSession('paused'); }
export function startMusic() { musicOn.value = true; return resume(); }
export function stopMusic() {
  musicOn.value = false; musicPlaying.value = false;
  if (a) { try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) { /* ignore */ } }
  setSession('none');
  if (!voSpeaking.value) releaseMedia(); // clears the session + native Now Playing / remote commands (debounced)
}
export const pauseMusic = pause; export const resumeMusic = () => (musicOn.value ? resume() : false);
export const musicHoldsNowPlaying = () => musicOn.value;
export const _el = () => a; // tests
_setMusicHolds(() => musicOn.value);

watch(voSpeaking, applyVol);
watch(voMuted, (m) => { if (m && musicOn.value) stopMusic(); });
