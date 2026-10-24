// Shared Background state: prefs (saved per device in localStorage) + music playback. Music never starts on its own.
import { reactive, ref } from 'vue';
import { loadPrefs, savePrefs, sanitize, DEFAULTS, loadCustomImage, saveCustomImage, clearCustomImage, effectiveImage, TRACKS, pickNextTrack } from '@/utils/bgPrefs';
import { applyBackgroundImage, fileToBackgroundDataUrl } from '@/utils/bgImage';
import { createEngine } from '@/composables/useBackgroundAudio';

const prefs = reactive(loadPrefs());
const custom = ref(loadCustomImage()); // user's own picture (data URL) or ''
const imageError = ref('');
const playing = ref(false);
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
    prefs.track = r.next; persist(); engine.crossfadeTo(r.next); armRotate();
  }, prefs.rotateMins * 60000);
};

const persist = () => savePrefs({ anim: prefs.anim, track: prefs.track, volume: prefs.volume, forceMotion: prefs.forceMotion, musicOn: prefs.musicOn, image: prefs.image, autoRotate: prefs.autoRotate, rotateMins: prefs.rotateMins });
const showImage = () => applyBackgroundImage(prefs.image, custom.value);

export const useBackground = () => ({
  prefs, playing, audioError, customImage: custom, imageError,
  audioSupported: typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext),
  setAnim(a) { Object.assign(prefs, sanitize({ ...prefs, anim: a })); persist(); },
  async play() { // call from a click/tap handler
    audioError.value = '';
    try {
      engine = engine || createEngine();
      if (!engine) { audioError.value = "This browser can't play audio."; return; }
      await engine.start(prefs.track, prefs.volume); playing.value = true;
      prefs.musicOn = true; persist(); armRotate();
    } catch (e) { console.error('Background audio failed:', e); audioError.value = 'Could not start audio. Tap play again.'; playing.value = false; }
  },
  async pause() { stopRotate(); playing.value = false; prefs.musicOn = false; persist(); if (engine) await engine.stop(); engine = null; },
  // Returning to the app: if music was on when the user left, bring it back. Browsers/iOS may block audio until a tap, so fall back to the next tap.
  resumeIfWanted() {
    if (!prefs.musicOn || playing.value || resumeArmed) return;
    resumeArmed = true;
    const go = async () => {
      if (!prefs.musicOn || playing.value) { resumeArmed = false; return; }
      await this.play();
      const ok = engine && engine.state === 'running';
      if (!ok) { // still blocked: retry on the next tap
        try { if (engine) await engine.stop(); } catch (e) { /* ignore */ }
        engine = null; playing.value = false; prefs.musicOn = true; persist();
        const once = () => { window.removeEventListener('pointerdown', once, true); window.removeEventListener('touchend', once, true); resumeArmed = false; this.resumeIfWanted(); };
        window.addEventListener('pointerdown', once, true); window.addEventListener('touchend', once, true);
      } else resumeArmed = false;
    };
    go();
  },
  async toggle() { if (playing.value) await this.pause(); else await this.play(); },
  setTrack(id) { Object.assign(prefs, sanitize({ ...prefs, track: id })); persist(); if (engine && playing.value) { engine.setTrack(prefs.track); armRotate(); } },
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
  async reset() { await this.pause(); clearCustomImage(); custom.value = ''; Object.assign(prefs, DEFAULTS); persist(); showImage(); },
  level: () => (engine ? engine.level() : 0),
});
