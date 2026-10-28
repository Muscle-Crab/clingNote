// Static robot lines that are pre-recorded (public/voiceover/p/<key>.mp3) so they play instantly and offline.
// speakLive(text): exact (whitespace-normalised) match -> bundled MP3; anything else -> live `tts` function (same voice).
// Built from the source tables, so editing a line there and running `npm run voiceover` keeps them in sync.
// Lines with {placeholders} are dynamic and only spoken live.
import { REPORT_LINES } from '../utils/sergeantReport.js';
import { CHEER, STREAK, ROAST } from '../utils/bossCoach.js';
import { RELAPSE_MESSAGE } from '../utils/recovery.js';

export const EXTRA_PHRASES = [
  "That's everything! Great work. The rest of the day is yours.", // HomeView: day complete
  "Got it. That one's important.", "Okay, it's not marked important anymore.", // HomeView: importance toggle
  'Nice work. Another clean day.', RELAPSE_MESSAGE, // addiction.vue
  'Nice! Your manager just sent you a bonus.', // pressure.js celebrations
  "You missed the goal, but your shield saved the streak. Let's make tomorrow count.",
  "You missed the goal, and the streak reset. That's okay. Tomorrow we hit it.",
  'Voice is on.', // voice toggle confirmation
];

export const normPhrase = (t) => String(t || '').replace(/\s+/g, ' ').trim();
// FNV-1a 32-bit -> stable short file key (same in the browser and the node generator).
export const phraseKey = (t) => { let h = 0x811c9dc5; for (const c of normPhrase(t)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return `p_${h.toString(16).padStart(8, '0')}`; };

const tables = [...Object.values(REPORT_LINES).flat(), ...CHEER, ...STREAK, ...ROAST];
export const PHRASES = [...new Set([...tables.filter((s) => !/\{\w+\}/.test(s)), ...EXTRA_PHRASES].map(normPhrase))];
export const PHRASE_KEYS = new Set(PHRASES.map(phraseKey));

export const MAX_LIVE_CHARS = 400; // matches netlify/functions/tts.js
// Clean a line for the voice and split it into <= max-char chunks at sentence ends (long reports play as a chain).
export function liveChunks(text, max = MAX_LIVE_CHARS) {
  const t = normPhrase(String(text || '').replace(/[*_#`>]/g, '')); if (!t) return [];
  const out = []; let cur = '';
  for (const s of t.split(/(?<=[.!?])\s+/)) {
    const piece = s.length > max ? s.slice(0, max) : s;
    if (cur && cur.length + 1 + piece.length > max) { out.push(cur); cur = piece; } else cur = cur ? `${cur} ${piece}` : piece;
  }
  if (cur) out.push(cur);
  return out;
}
