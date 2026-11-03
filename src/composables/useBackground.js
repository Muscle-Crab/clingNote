// Shared Background state: prefs (saved per device in localStorage) + music playback. Music never starts on its own.
import { reactive, ref, watch, computed } from 'vue';
import { msUntilNextPeriod } from '@/utils/daytimeBg';
import { refreshOtherAudio, otherAudioBusy } from '@/utils/audioSession';
import { loadPrefs, savePrefs, sanitize, DEFAULTS, loadCustomImage, saveCustomImage, clearCustomImage, effectiveImage, TRACKS, pickNextTrack, tapAction, restoreFromBackup, KEY } from '@/utils/bgPrefs';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { applyBackgroundImage, fileToBackgroundDataUrl } from '@/utils/bgImage';
import { createEngine } from '@/composables/useBackgroundAudio';
import { npStart, npStop, npPaused, npTitle, npActive } from '@/composables/useNowPlaying';
import { voSpeaking, _setMusicHolds } from '@/composables/useVoiceover';

const prefs = reactive(loadPrefs());
const custom = ref(loadCustomImage()); // user's own picture (data URL) or ''
const imageError = ref('');
const playing = ref(false);
const trackName = () => { const t = TRACKS.find((x) => x.id === prefs.track); return t ? t.label : 'Background music'; };
// Lock-screen widget handlers: pause keeps the (paused) widget so play works from the lock screen; in-app pause clears it.
const lockHandlers = () => ({ play: () => api.play(), pause: () => api.pause({ fromLockScreen: true }), stop: () => api.pause() });
// The voice ducks the music, then it comes back to the saved volume. Voice never takes over Now Playing while music holds it.
export const DUCK = 0.3;
watch(voSpeaking, (v) => { if (engine && playing.value) engine.setVolume(v ? prefs.volume * DUCK : prefs.volume); });
_setMusicHolds(() => { if (!npActive()) return false; npTitle(trackName()); return true; }); // after a voice line: re-assert the music widget
const audioError = ref('');
let engine = null;
let resumeArmed = false;
// Auto-rotate: purely time-based. While playing, every rotateMins minutes crossfade to another track (shuffled, no immediate repeat).
// Generative tracks never "end", so nothing else triggers a change.
let rotTimer = 0; let rotBag = [];
const stopRotate = () => { clearTimeout(rotTimer); rotTimer = 0; };
const armRotate = () => {
  stopRotate();
  if (!prefs.autoRotate || !playing.value || !engine) return;
  rotTimer = setTimeout(() => {
    if (!prefs.autoRotate || !playing.value || !engine) return;
    const r = pickNextTrack(TRACKS.map((t) => t.id), prefs.track, rotBag); rotBag = r.bag;
    prefs.track = r.next; persist(); engine.crossfadeTo(r.next); npTitle(trackName()); armRotate();
  }, prefs.rotateMins * 60000);
};

// Durable copy on iOS via the Capacitor Preferences plugin (UserDefaults) when the native plugin is present;
// the web build and builds without the plugin just use localStorage.
const NativePrefs = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Preferences') ? registerPlugin('Preferences') : null;
const backup = (p) => { if (NativePrefs) NativePrefs.set({ key: KEY, value: JSON.stringify(sanitize(p)) }).catch(() => {}); };
if (NativePrefs) {
  let localRaw = null; try { localRaw = localStorage.getItem(KEY); } catch (e) { /* private */ }
  NativePrefs.get({ key: KEY }).then(({ value }) => { const r = restoreFromBackup(localRaw, value); if (r) { Object.assign(prefs, r, { musicOn: r.musicOn }); savePrefs(r); } }).catch(() => {});
}
const savePrefsAll = (p) => { savePrefs(p); backup(p); };
const persist = () => savePrefsAll({ anim: prefs.anim, track: prefs.track, volume: prefs.volume, forceMotion: prefs.forceMotion, musicOn: prefs.musicOn, image: prefs.image, autoRotate: prefs.autoRotate, rotateMins: prefs.rotateMins });
// Time-of-day: `now` ticks each minute and on resume; at a period boundary a precise timer fires too. A manual pick ignores it.
const now = ref(new Date());
const preview = ref(''); // gallery preview (not saved) shown behind the open sheet
const shownImage = computed(() => effectiveImage(preview.value || prefs.image, custom.value, now.value));
const showImage = () => applyBackgroundImage(preview.value || prefs.image, custom.value, now.value);
const tick = () => { now.value = new Date(); if (prefs.image === 'auto' && !preview.value) showImage(); };
let edgeTimer = 0;
const armEdge = () => { clearTimeout(edgeTimer); edgeTimer = setTimeout(() => { tick(); armEdge(); }, msUntilNextPeriod(new Date()) + 500); };
if (typeof window !== 'undefined') {
  setInterval(tick, 60000); armEdge();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tick(); armEdge(); } });
  window.addEventListener('focus', tick);
}

// Keep the button honest: if iOS suspends/interrupts/closes audio (call, Siri, backgrounding) show "Play" again.
const syncReal = () => { if (playing.value && (!engine || engine.state !== 'running')) { playing.value = false; stopRotate(); npPaused(trackName()); } };
const onCtxState = (st) => { if (st !== 'running') setTimeout(syncReal, 400); };
const armTap = () => {
  if (resumeArmed || typeof window === 'undefined') return; resumeArmed = true;
  const once = () => { window.removeEventListener('pointerdown', once, true); window.removeEventListener('touchend', once, true); resumeArmed = false; if (otherAudioBusy()) return; /* the user's own music (Spotify…) is playing: never take over audio on a random tap */ if (prefs.musicOn && !(playing.value && engine && engine.state === 'running')) api.play(); };
  window.addEventListener('pointerdown', once, true); window.addEventListener('touchend', once, true);
};
if (typeof document !== 'undefined') {
  const back = () => { if (document.visibilityState === 'visible') api.resumeIfWanted(); else if (engine && engine.state !== 'running') syncReal(); };
  document.addEventListener('visibilitychange', back); window.addEventListener('pageshow', back);
}

const api = {
  prefs, playing, audioError, customImage: custom, imageError, shownImage, preview,
  // Gallery: look at a scene on the real background without saving; commit with setImage, cancel with endPreview.
  previewImage(id) { preview.value = id || ''; showImage(); },
  endPreview() { if (!preview.value) return; preview.value = ''; showImage(); },
  audioSupported: typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext),
  setAnim(a) { Object.assign(prefs, sanitize({ ...prefs, anim: a })); persist(); },
  // Call from a click/tap handler. No await before engine.start(): it resumes the AudioContext synchronously inside the gesture.
  play() {
    audioError.value = '';
    try {
      engine = engine || createEngine();
      if (!engine) { audioError.value = "This browser can't play audio."; return Promise.resolve(); }
      engine.onStateChange = onCtxState;
      const p = engine.start(prefs.track, voSpeaking.value ? prefs.volume * DUCK : prefs.volume);
      npStart(trackName(), lockHandlers());
      playing.value = true; prefs.musicOn = true; persist(); armRotate();
      return p.then(() => { if (engine && engine.state !== 'running') setTimeout(syncReal, 600); });
    } catch (e) { console.error('Background audio failed:', e); audioError.value = 'Could not start audio. Tap play again.'; playing.value = false; return Promise.resolve(); }
  },
  async pause({ fromLockScreen = false } = {}) { stopRotate(); playing.value = false; prefs.musicOn = false; persist(); if (fromLockScreen) npPaused(trackName()); else npStop(); if (engine) await engine.stop(); },
  // Returning to the app: if music was on when the user left, bring it back. iOS usually blocks audio until a tap,
  // so the UI shows "Play" (not a stale "Pause") and the very next tap anywhere restarts the same track.
  resumeIfWanted() {
    if (!prefs.musicOn) return;
    if (playing.value && engine && engine.state === 'running') return;
    const tryNow = engine && engine.state === 'suspended' ? engine.resume() : Promise.resolve('none');
    tryNow.then((st) => { if (st === 'running') { playing.value = true; armRotate(); } else { playing.value = false; stopRotate(); refreshOtherAudio().then((busy) => { if (!busy) armTap(); }); } });
  },
  toggle() { return tapAction(playing.value, engine ? engine.state : 'none') === 'pause' ? api.pause() : api.play(); },
  setTrack(id) { Object.assign(prefs, sanitize({ ...prefs, track: id })); persist(); if (engine && playing.value) { engine.setTrack(prefs.track); npTitle(trackName()); armRotate(); } },
  setAutoRotate(on) { Object.assign(prefs, sanitize({ ...prefs, autoRotate: !!on })); persist(); armRotate(); },
  setRotateMins(m) { Object.assign(prefs, sanitize({ ...prefs, rotateMins: Number(m) })); persist(); armRotate(); },
  setForceMotion(on) { Object.assign(prefs, sanitize({ ...prefs, forceMotion: !!on })); persist(); },
  setVolume(v) { Object.assign(prefs, sanitize({ ...prefs, volume: Number(v) })); persist(); if (engine) engine.setVolume(voSpeaking.value ? prefs.volume * DUCK : prefs.volume); },
  setImage(id) { preview.value = ''; Object.assign(prefs, sanitize({ ...prefs, image: id === 'custom' && !custom.value ? DEFAULTS.image : id })); imageError.value = ''; persist(); showImage(); },
  async uploadImage(file) { // photo library / files via <input type=file>
    imageError.value = '';
    try {
      const url = await fileToBackgroundDataUrl(file);
      if (!saveCustomImage(url)) throw new Error('Not enough space on this device to save that picture.');
      custom.value = url; prefs.image = 'custom'; persist(); showImage(); return true;
    } catch (e) { imageError.value = e && e.message ? e.message : "Couldn't use that picture."; return false; }
  },
  resetImage() { clearCustomImage(); custom.value = ''; imageError.value = ''; prefs.image = DEFAULTS.image; persist(); showImage(); },
  async reset() { await api.pause(); clearCustomImage(); custom.value = ''; Object.assign(prefs, DEFAULTS); persist(); showImage(); },
  level: () => (engine ? engine.level() : 0),
};
export const useBackground = () => api;
