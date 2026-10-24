// Boss voiceover: bundled neural-TTS MP3s (public/voiceover/<key>.mp3, scripts in src/voiceover/scripts.js),
// speechSynthesis fallback (offline / missing file) and for dynamic lines (morning report, overdue alerts).
// iOS WKWebView needs a user gesture before audio: unlock() on the first tap primes ONE shared <audio> element,
// after which later src swaps can play without a fresh gesture. Mute is remembered in localStorage.
import { ref } from 'vue';
import { SCRIPTS } from '@/voiceover/scripts';

const MUTE_KEY = 'clingnote.voMuted.v1';
const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; } };
export const voMuted = ref(readMuted());
export const voUnlocked = ref(false);
export const voSpeaking = ref(false);
let audio = null; let token = 0;
const base = (typeof process !== 'undefined' && process.env && process.env.BASE_URL) || '/';
const el = () => { if (!audio && typeof Audio !== 'undefined') { audio = new Audio(); audio.preload = 'auto'; audio.addEventListener('ended', () => { voSpeaking.value = false; }); } return audio; };
const synth = () => (typeof window !== 'undefined' && window.speechSynthesis) || null;

// Prefer natural/neural voices (iOS "Enhanced"/"Premium", Google, Microsoft "Natural") over the compact default.
export function bestVoice() {
  const s = synth(); if (!s) return null;
  const vs = s.getVoices().filter((v) => /^en[-_]US/i.test(v.lang) || /^en/i.test(v.lang));
  const score = (v) => (/premium/i.test(v.name) ? 50 : 0) + (/enhanced/i.test(v.name) ? 40 : 0) + (/natural|neural/i.test(v.name) ? 45 : 0)
    + (/google/i.test(v.name) ? 20 : 0) + (/^en[-_]US/i.test(v.lang) ? 10 : 0) + (/(aaron|evan|nathan|tom|alex|guy|andrew|daniel)/i.test(v.name) ? 5 : 0);
  return vs.sort((a, b) => score(b) - score(a))[0] || null;
}

export function stopVoice() {
  token++; voSpeaking.value = false;
  try { const a = audio; if (a) { a.pause(); a.currentTime = 0; } } catch (e) { /* ignore */ }
  try { synth()?.cancel(); } catch (e) { /* ignore */ }
}

export function speakLive(text, { onEnd } = {}) {
  if (voMuted.value || !text) return false;
  const s = synth(); if (!s || typeof SpeechSynthesisUtterance === 'undefined') return false;
  try { s.cancel(); const u = new SpeechSynthesisUtterance(text); const v = bestVoice(); if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = 1.02; u.pitch = 0.95; voSpeaking.value = true; u.onend = () => { voSpeaking.value = false; onEnd && onEnd(); }; s.speak(u); return true; } catch (e) { return false; }
}

// Play a scripted segment (stops anything already playing). Returns false if muted / not yet unlocked.
export function playVoice(key) {
  stopVoice(); if (voMuted.value || !voUnlocked.value || !SCRIPTS[key]) return false;
  const my = token; const a = el();
  if (!a) return speakLive(SCRIPTS[key]);
  a.src = `${base}voiceover/${key}.mp3`; voSpeaking.value = true;
  a.play().catch(() => { if (my === token) speakLive(SCRIPTS[key]); });
  a.onerror = () => { if (my === token) speakLive(SCRIPTS[key]); };
  return true;
}

// Call from inside a tap handler. Primes the shared element (silent) so later swaps can autoplay on iOS.
export function unlockVoice() {
  if (voUnlocked.value) return; voUnlocked.value = true;
  const a = el(); if (a) { try { a.muted = true; a.src = `${base}voiceover/ob_age.mp3`; const p = a.play(); const done = () => { a.pause(); a.muted = false; };
    p && p.then ? p.then(done, done) : done(); } catch (e) { a.muted = false; } }
  try { const s = synth(); if (s) s.getVoices(); } catch (e) { /* ignore */ }
}

export function setVoMuted(m) { voMuted.value = !!m; try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { /* ignore */ } if (m) stopVoice(); }
export function useVoiceover() { return { muted: voMuted, unlocked: voUnlocked, speaking: voSpeaking, play: playVoice, speakLive, stop: stopVoice, unlock: unlockVoice, setMuted: setVoMuted }; }
