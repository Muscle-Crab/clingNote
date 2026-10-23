// Shared Background state: prefs (saved per device in localStorage) + music playback. Music never starts on its own.
import { reactive, ref } from 'vue';
import { loadPrefs, savePrefs, sanitize, DEFAULTS } from '@/utils/bgPrefs';
import { createEngine } from '@/composables/useBackgroundAudio';

const prefs = reactive(loadPrefs());
const playing = ref(false);
const audioError = ref('');
let engine = null;

const persist = () => savePrefs({ anim: prefs.anim, track: prefs.track, volume: prefs.volume, forceMotion: prefs.forceMotion });

export const useBackground = () => ({
  prefs, playing, audioError,
  audioSupported: typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext),
  setAnim(a) { Object.assign(prefs, sanitize({ ...prefs, anim: a })); persist(); },
  async play() { // call from a click/tap handler
    audioError.value = '';
    try {
      engine = engine || createEngine();
      if (!engine) { audioError.value = "This browser can't play audio."; return; }
      await engine.start(prefs.track, prefs.volume); playing.value = true;
    } catch (e) { console.error('Background audio failed:', e); audioError.value = 'Could not start audio. Tap play again.'; playing.value = false; }
  },
  async pause() { playing.value = false; if (engine) await engine.stop(); engine = null; },
  async toggle() { if (playing.value) await this.pause(); else await this.play(); },
  setTrack(id) { Object.assign(prefs, sanitize({ ...prefs, track: id })); persist(); if (engine && playing.value) engine.setTrack(prefs.track); },
  setForceMotion(on) { Object.assign(prefs, sanitize({ ...prefs, forceMotion: !!on })); persist(); },
  setVolume(v) { Object.assign(prefs, sanitize({ ...prefs, volume: Number(v) })); persist(); if (engine) engine.setVolume(prefs.volume); },
  async reset() { await this.pause(); Object.assign(prefs, DEFAULTS); persist(); },
  level: () => (engine ? engine.level() : 0),
});
