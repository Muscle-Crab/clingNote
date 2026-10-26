// Boss voiceover: bundled neural-TTS MP3s (public/voiceover/<key>.mp3, scripts in src/voiceover/scripts.js),
// speechSynthesis fallback (offline / missing file) and for dynamic lines (morning report, overdue alerts).
// iOS WKWebView needs a user gesture before audio: unlock() on the first tap primes ONE shared <audio> element,
// after which later src swaps can play without a fresh gesture. Mute is remembered in localStorage.
import { ref } from 'vue';
import { SCRIPTS } from '@/voiceover/scripts';
import { ClingVoice as _CV, nativeVoiceAvailable as _nva } from '@/utils/clingVoice';

const MUTE_KEY = 'clingnote.voMuted.v1';
const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; } };
export const voMuted = ref(readMuted());
export const voUnlocked = ref(false);
export const voSpeaking = ref(false);
let audio = null; let token = 0;
const base = (typeof process !== 'undefined' && process.env && process.env.BASE_URL) || '/';
const el = () => { if (!audio && typeof Audio !== 'undefined') { audio = new Audio(); audio.preload = 'auto'; audio.addEventListener('ended', () => { voSpeaking.value = false; }); } return audio; };
const synth = () => (typeof window !== 'undefined' && window.speechSynthesis) || null;

// Drill-sergeant delivery: deep, forceful, clipped. Natural male voice; pitch lowered, rate a touch brisk, short pause between barked lines.
export const SGT_PITCH = 0.78; export const SGT_RATE = 1.06; // native: multiplier of AVSpeechUtteranceDefaultSpeechRate
export const MALE_VOICES = ['evan', 'nathan', 'aaron', 'tom', 'reed', 'alex', 'fred'];
const FEMALE = /(samantha|ava|allison|susan|victoria|karen|moira|tessa|fiona|zoe|nicky|joelle|serena|kate|female|woman|zira|aria|jenny|libby|sonia|emma|michelle)/i;
// Web: best male English voice (same names as iOS: Premium > Enhanced; then any male en-US; last resort any en-US).
export function bestVoice(list) {
  const s = synth(); const all = list || (s ? s.getVoices() : []); if (!all.length) return null;
  const en = all.filter((v) => /^en/i.test(v.lang));
  const nameRank = (v) => { const n = String(v.name).toLowerCase(); const i = MALE_VOICES.findIndex((m) => n.startsWith(m) || n.includes(` ${m}`) || n.includes(`(${m}`)); return i < 0 ? 0 : MALE_VOICES.length - i; };
  const male = (v) => nameRank(v) > 0 || /\b(male|man|guy|david|mark|george|ryan|andrew|christopher|eric|brian|daniel|thomas|davis|jason|tony|roger|steffan)\b/i.test(v.name);
  const score = (v) => (/premium/i.test(v.name) ? 300 : 0) + (/enhanced|natural|neural|online/i.test(v.name) ? 200 : 0) + nameRank(v) * 20 + (male(v) && !FEMALE.test(v.name) ? 100 : 0)
    + (/^en[-_]US/i.test(v.lang) ? 10 : 0) - (FEMALE.test(v.name) ? 500 : 0);
  return [...en].sort((a, b) => score(b) - score(a))[0] || null;
}
// Short, punchy lines: one per sentence (long sentences split at commas).
export function barkLines(text) {
  return String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).flatMap((x) => (x.length > 90 ? x.split(/,\s+/) : [x])).map((x) => x.trim()).filter(Boolean);
}
let nativeVoice = null; // lazy: ClingVoice plugin (iOS AVSpeechSynthesizer)
const native = () => { if (nativeVoice === null) { try { nativeVoice = _nva() ? _CV : false; } catch (e) { nativeVoice = false; } } return nativeVoice; };
export const voiceQuality = ref(''); // 'premium' | 'enhanced' | 'default' (iOS), '' unknown
export async function loadVoiceInfo() { const n = native(); if (!n) return null; try { const i = await n.voiceInfo(); voiceQuality.value = i.quality || ''; return i; } catch (e) { return null; } }

export function stopVoice() {
  token++; voSpeaking.value = false;
  try { const a = audio; if (a) { a.pause(); a.currentTime = 0; } } catch (e) { /* ignore */ }
  try { synth()?.cancel(); } catch (e) { /* ignore */ }
  try { const n = native(); if (n) n.stop().catch(() => {}); } catch (e) { /* ignore */ }
}

export function speakLive(text, { onEnd } = {}) {
  if (voMuted.value || !text) return false;
  const lines = barkLines(text); if (!lines.length) return false;
  const n = native();
  if (n) {
    const my = token; voSpeaking.value = true;
    n.speak({ lines, pitch: SGT_PITCH, rate: SGT_RATE }).then(() => { if (my === token) { voSpeaking.value = false; onEnd && onEnd(); } }).catch(() => { voSpeaking.value = false; });
    return true;
  }
  const s = synth(); if (!s || typeof SpeechSynthesisUtterance === 'undefined') return false;
  try {
    s.cancel(); const v = bestVoice(); const my = token; voSpeaking.value = true;
    lines.forEach((line, i) => {
      const u = new SpeechSynthesisUtterance(line); if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = SGT_RATE; u.pitch = SGT_PITCH; u.volume = 1;
      if (i === lines.length - 1) u.onend = () => { if (my === token) { voSpeaking.value = false; onEnd && onEnd(); } };
      s.speak(u);
    });
    return true;
  } catch (e) { return false; }
}

// Play a scripted segment (stops anything already playing). Returns false if muted / not yet unlocked.
export function playVoice(key, { onEnd } = {}) {
  stopVoice(); if (voMuted.value || !voUnlocked.value || !SCRIPTS[key]) return false;
  const my = token; const a = el();
  const fallback = () => { if (my === token) speakLive(SCRIPTS[key], { onEnd }); };
  if (!a) return speakLive(SCRIPTS[key], { onEnd });
  a.src = `${base}voiceover/${key}.mp3`; voSpeaking.value = true;
  a.onended = () => { if (my === token && onEnd) onEnd(); };
  a.play().catch(fallback);
  a.onerror = fallback;
  return true;
}

// One voice flow: a scripted MP3 segment (natural neural voice), then dynamic text via speechSynthesis.
// stopVoice() (close / mute / new flow) cancels the rest of the sequence.
export function playFlow({ before = '', key = '', text = '' }) {
  if (voMuted.value) return false;
  if (before) { const my = token; return speakLive(before, { onEnd: () => { if (my === token) playFlow({ key, text }); } }); }
  if (key && SCRIPTS[key] && voUnlocked.value) { const my = token + 1; return playVoice(key, { onEnd: () => { if (my === token && text) speakLive(text); } }); }
  return speakLive(key && SCRIPTS[key] ? `${SCRIPTS[key]} ${text}` : text);
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
