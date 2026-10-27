// The ONE robot voice. Every spoken line in ClingNote goes through this file (useSpeech.speak is a thin wrapper).
//  - Scripted segments: bundled MP3s (public/voiceover/<key>.mp3, scripts in src/voiceover/scripts.js).
//  - Static lines (src/voiceover/phrases.js): bundled MP3s (public/voiceover/p/<hash>.mp3), instant + offline.
//  - Anything else (reports, check-ins, assistant replies): the `tts` Netlify function (ElevenLabs, same voice), cached.
//  - If the live voice is unavailable (offline, no key, limit): the matching pre-recorded MP3 if there is one, else silence.
//    There is deliberately NO device TTS / speechSynthesis fallback (that was the robotic default voice).
// iOS WKWebView needs a user gesture before audio: unlock() on the first tap primes ONE shared <audio> element,
// after which later src swaps can play without a fresh gesture. Mute is remembered in localStorage ("Robot voice" setting).
import { ref } from 'vue';
import { SCRIPTS } from '@/voiceover/scripts';
import { PHRASE_KEYS, phraseKey, liveChunks, MAX_LIVE_CHARS } from '@/voiceover/phrases';
import { fnUrl } from '@/config/api';

const MUTE_KEY = 'clingnote.voMuted.v1'; // also read by utils/notifSound.js (VOICE_MUTE_KEY) for notification sounds
const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; } };
export const voMuted = ref(readMuted());
export const voUnlocked = ref(false);
export const voSpeaking = ref(false);
let audio = null; let token = 0;
const base = (typeof process !== 'undefined' && process.env && process.env.BASE_URL) || '/';
const el = () => { if (!audio && typeof Audio !== 'undefined') { audio = new Audio(); audio.preload = 'auto'; audio.addEventListener('ended', () => { voSpeaking.value = false; }); } return audio; };


export { liveChunks, MAX_LIVE_CHARS };
export const bundledSrc = (text) => { const k = phraseKey(text); return PHRASE_KEYS.has(k) ? `${base}voiceover/p/${k}.mp3` : ''; };

const urls = new Map(); // text -> object URL (session cache; the server also caches)
let getToken = async () => { try { const { auth } = await import('@/firebaseConfig'); return auth.currentUser ? await auth.currentUser.getIdToken() : ''; } catch (e) { return ''; } };
export const _setTokenGetter = (f) => { getToken = f; }; // tests
async function liveUrl(text) {
  if (urls.has(text)) return urls.get(text);
  if (typeof fetch === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return '';
  const tok = await getToken(); if (!tok) return '';
  const r = await fetch(fnUrl('tts'), { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!r.ok || !/audio/.test(r.headers.get('content-type') || '')) return '';
  const url = URL.createObjectURL(await r.blob()); urls.set(text, url);
  if (urls.size > 40) { const [k, v] = urls.entries().next().value; urls.delete(k); try { URL.revokeObjectURL(v); } catch (e) { /* ignore */ } }
  return url;
}

// Play one source on the shared element; onFail fires at most once and never after playback really started.
function playSrc(src, my, { onEnd, onFail }) {
  const a = el(); if (!a || my !== token) { onFail(); return; }
  let started = false; let failed = false;
  const fail = () => { if (failed || started || my !== token) return; failed = true; onFail(); };
  a.onplaying = () => { started = true; };
  a.onended = () => { if (my === token && onEnd) onEnd(); };
  a.onerror = fail;
  a.src = src; voSpeaking.value = true;
  try { const p = a.play(); if (p && p.catch) p.catch(fail); } catch (e) { fail(); }
}

export function stopVoice() {
  token++; voSpeaking.value = false;
  try { const a = audio; if (a) { a.pause(); a.currentTime = 0; } } catch (e) { /* ignore */ }
}

// Speak one chunk: bundled MP3 for a known static line, else the live voice, else fallbackKey's MP3, else silence.
function speakChunk(t, my, next, fallbackKey) {
  const fallback = () => { if (my !== token) return; if (fallbackKey && SCRIPTS[fallbackKey]) playSrc(`${base}voiceover/${fallbackKey}.mp3`, my, { onEnd: next, onFail: next }); else next(); };
  const live = () => liveUrl(t).then((u) => { if (my !== token) return; if (u) playSrc(u, my, { onEnd: next, onFail: fallback }); else fallback(); }, fallback);
  const local = bundledSrc(t);
  if (local) playSrc(local, my, { onEnd: next, onFail: live }); else live();
}

// Speak any line in the robot voice. Returns false only when muted / empty. onEnd runs when it finishes OR when no
// voice was available (so chained flows keep going); never after stopVoice(). fallbackKey: a SCRIPTS MP3 to play instead.
export function speakLive(text, { onEnd, fallbackKey } = {}) {
  const parts = liveChunks(text);
  if (voMuted.value || !parts.length) return false;
  stopVoice(); const my = token; voSpeaking.value = true;
  const step = (i) => { if (my !== token) return; if (i >= parts.length) { voSpeaking.value = false; if (onEnd) onEnd(); return; } speakChunk(parts[i], my, () => step(i + 1), fallbackKey); };
  step(0);
  return true;
}

// Play a scripted segment (stops anything already playing). Returns false if muted / not yet unlocked.
export function playVoice(key, { onEnd } = {}) {
  stopVoice(); if (voMuted.value || !voUnlocked.value || !SCRIPTS[key]) return false;
  const my = token;
  playSrc(`${base}voiceover/${key}.mp3`, my, { onEnd, onFail: () => { if (my === token) speakLive(SCRIPTS[key], { onEnd }); } });
  return true;
}

// One voice flow: optional live line, then a scripted MP3 segment, then a dynamic live line.
// stopVoice() (close / mute / new flow) cancels the rest of the sequence.
export function playFlow({ before = '', key = '', text = '' }) {
  if (voMuted.value) return false;
  if (before) return speakLive(before, { onEnd: () => playFlow({ key, text }) }); // onEnd never fires after a stop
  if (key && SCRIPTS[key] && voUnlocked.value) return playVoice(key, { onEnd: () => { if (text) speakLive(text); } });
  return text ? speakLive(text) : false;
}

// Call from inside a tap handler. Primes the shared element (silent) so later swaps can autoplay on iOS.
export function unlockVoice() {
  if (voUnlocked.value) return; voUnlocked.value = true;
  const a = el(); if (a) { try { a.muted = true; a.src = `${base}voiceover/ob_age.mp3`; const p = a.play(); const done = () => { a.pause(); a.muted = false; };
    p && p.then ? p.then(done, done) : done(); } catch (e) { a.muted = false; } }
}

export function setVoMuted(m) { voMuted.value = !!m; try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { /* ignore */ } if (m) stopVoice(); }
export function useVoiceover() { return { muted: voMuted, unlocked: voUnlocked, speaking: voSpeaking, play: playVoice, speakLive, stop: stopVoice, unlock: unlockVoice, setMuted: setVoMuted }; }
