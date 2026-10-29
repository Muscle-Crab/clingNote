// Shared Background state: prefs (saved per device in localStorage) + music playback. Music never starts on its own.
import { reactive, ref } from 'vue';
import { loadPrefs, savePrefs, sanitize, DEFAULTS, loadCustomImage, saveCustomImage, clearCustomImage, effectiveImage, TRACKS, pickNextTrack, stepTrack, trackInfo, tapAction, restoreFromBackup, KEY } from '@/utils/bgPrefs';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { applyBackgroundImage, fileToBackgroundDataUrl } from '@/utils/bgImage';
import { createEngine } from '@/composables/useBackgroundAudio';
import { createFileEngine } from '@/composables/useFileAudio';
import { setNowPlaying, setPlaybackState, bindActions } from '@/utils/mediaSession';

const prefs = reactive(loadPrefs());
const custom = ref(loadCustomImage()); // user's own picture (data URL) or ''
const imageError = ref('');
const playing = ref(false);
const audioError = ref('');
let engine = null;
// Two engines: Web Audio synth for the generated tracks, one <audio> element for recorded tracks (lock-screen capable).
const engines = { synth: null, file: null };
const kindOf = (id) => (trackInfo(id).src ? 'file' : 'synth');
const engineFor = (id) => { const k = kindOf(id); if (!engines[k]) engines[k] = k === 'file' ? createFileEngine() : createEngine(); return engines[k]; };
const NativeMusic = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('ClingNative') ? registerPlugin('ClingNative') : null;
const nativeSession = (on) => { if (NativeMusic && NativeMusic.setMusicSession) NativeMusic.setMusicSession({ active: on }).catch(() => {}); };
const base = (typeof process !== 'undefined' && process.env && process.env.BASE_URL) || '/';
const nowPlaying = () => { setNowPlaying(prefs.track, undefined, base); setPlaybackState(playing.value ? 'playing' : 'paused'); };
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
    prefs.track = r.next; persist(); switchTrack(r.next, true); armRotate();
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
// Change track while playing; across engine kinds the old one stops and the new one starts.
const switchTrack = (id, fade) => {
  const next = engineFor(id);
  if (!next) return;
  if (engine && engine !== next) { const old = engine; old.stop(); engine = next; if (playing.value) { engine.onStateChange = onCtxState; engine.start(id, prefs.volume).catch(() => {}); } }
  else { engine = next; if (playing.value) (fade ? engine.crossfadeTo(id) : engine.setTrack(id)); }
  nowPlaying();
};
const showImage = () => applyBackgroundImage(prefs.image, custom.value);

// Keep the button honest: if iOS suspends/interrupts/closes audio (call, Siri, backgrounding) show "Play" again.
const syncReal = () => { if (playing.value && (!engine || engine.state !== 'running')) { playing.value = false; stopRotate(); setPlaybackState('paused'); } };
const onCtxState = (st) => { if (st !== 'running') setTimeout(syncReal, 400); };
const armTap = () => {
  if (resumeArmed || typeof window === 'undefined') return; resumeArmed = true;
  const once = () => { window.removeEventListener('pointerdown', once, true); window.removeEventListener('touchend', once, true); resumeArmed = false; if (prefs.musicOn && !(playing.value && engine && engine.state === 'running')) api.play(); };
  window.addEventListener('pointerdown', once, true); window.addEventListener('touchend', once, true);
};
if (typeof document !== 'undefined') {
  const back = () => { if (document.visibilityState === 'visible') api.resumeIfWanted(); else if (engine && engine.state !== 'running') syncReal(); };
  document.addEventListener('visibilitychange', back); window.addEventListener('pageshow', back);
}

const api = {
  prefs, playing, audioError, customImage: custom, imageError,
  audioSupported: typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext),
  setAnim(a) { Object.assign(prefs, sanitize({ ...prefs, anim: a })); persist(); },
  // Call from a click/tap handler. No await before engine.start(): it resumes the AudioContext synchronously inside the gesture.
  play() {
    audioError.value = '';
    try {
      const want = engineFor(prefs.track);
      if (engine && engine !== want) engine.stop();
      engine = want;
      if (!engine) { audioError.value = "This browser can't play audio."; return Promise.resolve(); }
      engine.onStateChange = onCtxState;
      const p = engine.start(prefs.track, prefs.volume);
      playing.value = true; prefs.musicOn = true; persist(); armRotate(); nativeSession(true); nowPlaying();
      return p.then(() => { if (engine && engine.state !== 'running') setTimeout(syncReal, 600); });
    } catch (e) { console.error('Background audio failed:', e); audioError.value = 'Could not start audio. Tap play again.'; playing.value = false; return Promise.resolve(); }
  },
  async pause() { stopRotate(); playing.value = false; prefs.musicOn = false; persist(); nowPlaying(); if (engine) await engine.stop(); nativeSession(false); },
  // Lock screen / Control Center / media keys: previous & next walk the full track list (synth + recorded).
  next() { api.setTrack(stepTrack(prefs.track, 1)); if (!playing.value) return api.play(); return Promise.resolve(); },
  prev() { api.setTrack(stepTrack(prefs.track, -1)); if (!playing.value) return api.play(); return Promise.resolve(); },
  // Returning to the app: if music was on when the user left, bring it back. iOS usually blocks audio until a tap,
  // so the UI shows "Play" (not a stale "Pause") and the very next tap anywhere restarts the same track.
  resumeIfWanted() {
    if (!prefs.musicOn) return;
    if (playing.value && engine && engine.state === 'running') return;
    const tryNow = engine && engine.state === 'suspended' ? engine.resume() : Promise.resolve('none');
    tryNow.then((st) => { if (st === 'running') { playing.value = true; armRotate(); } else { playing.value = false; stopRotate(); armTap(); } });
  },
  toggle() { return tapAction(playing.value, engine ? engine.state : 'none') === 'pause' ? api.pause() : api.play(); },
  setTrack(id) { Object.assign(prefs, sanitize({ ...prefs, track: id })); persist(); if (playing.value) { switchTrack(prefs.track, false); armRotate(); } else nowPlaying(); },
  setAutoRotate(on) { Object.assign(prefs, sanitize({ ...prefs, autoRotate: !!on })); persist(); armRotate(); },
  setRotateMins(m) { Object.assign(prefs, sanitize({ ...prefs, rotateMins: Number(m) })); persist(); armRotate(); },
  setForceMotion(on) { Object.assign(prefs, sanitize({ ...prefs, forceMotion: !!on })); persist(); },
  setVolume(v) { Object.assign(prefs, sanitize({ ...prefs, volume: Number(v) })); persist(); if (engine) engine.setVolume(prefs.volume); },
  setImage(id) { Object.assign(prefs, sanitize({ ...prefs, image: effectiveImage(id, custom.value) })); imageError.value = ''; persist(); showImage(); },
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
bindActions({ play: () => api.play(), pause: () => api.pause(), stop: () => api.pause(), nexttrack: () => api.next(), previoustrack: () => api.prev() });
export const useBackground = () => api;
