// Pre-start time confirm: play asks (spoken, native TTS mixed with the user's music) whether the task fits its minutes, with a small
// sheet: Start / Skip / quick time adjust / "Don't ask again". The setting is per user (keyed by uid); Settings is the only way back on.
import { ClingVoice, nativeVoiceAvailable } from './clingVoice.js';

export const CONFIRM_KEY = (uid) => `cn.confirmStart.${uid || 'anon'}`;
export const confirmStartOn = (store, uid) => { try { return store.getItem(CONFIRM_KEY(uid)) !== 'off'; } catch (e) { return true; } };
export const setConfirmStart = (store, uid, on) => { try { store.setItem(CONFIRM_KEY(uid), on ? 'on' : 'off'); } catch (e) { /* private mode */ } };
export const confirmLine = (title, minutes) => `Hey, are you sure you can finish ${String(title || 'this task').trim()} in ${minutes} minutes? Going over costs points.`;
export const ADJUST_PRESETS = [15, 30, 45, 60, 90, 120];
export const adjustMinutes = (m, delta) => Math.min(600, Math.max(5, (Math.round(Number(m) || 0) || 25) + delta));

// Native AVSpeechSynthesizer via ClingVoicePlugin.speak (.playback + .mixWithOthers/.duckOthers: music keeps playing); web: speechSynthesis.
export const speakConfirm = (text) => {
  try { if (nativeVoiceAvailable()) { ClingVoice.speak({ text }).catch(() => {}); return; } } catch (e) { /* fall through */ }
  try { const s = window.speechSynthesis; if (s) { s.cancel(); s.speak(new window.SpeechSynthesisUtterance(text)); } } catch (e) { /* no voice */ }
};
export const stopConfirm = () => {
  try { if (nativeVoiceAvailable()) { ClingVoice.stop().catch(() => {}); return; } } catch (e) { /* fall through */ }
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* no voice */ }
};
