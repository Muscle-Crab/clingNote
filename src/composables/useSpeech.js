// Single voice channel: every ad-hoc spoken line goes through the boss voice (useVoiceover.speakLive), never a raw
// default (female) speechSynthesis utterance. Skipped while another line is playing so two voices never overlap.
import { speakLive, voSpeaking } from '@/composables/useVoiceover';
let last = ''; let lastAt = 0;
export const speak = (text) => {
  if (!text || voSpeaking.value) return false;
  const now = Date.now(); if (text === last && now - lastAt < 1500) return false; // dedupe double-triggered calls
  last = text; lastAt = now;
  return speakLive(text);
};
