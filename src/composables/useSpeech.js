// Single voice channel: every ad-hoc spoken line goes through the robot voice (useVoiceover.speakLive: bundled MP3 or the
// ElevenLabs tts function). No device TTS. Skipped while another line is playing so two lines never overlap.
import { speakLive, voSpeaking } from '@/composables/useVoiceover';
let last = ''; let lastAt = 0;
export const speak = (text) => {
  if (!text || voSpeaking.value) return false;
  const now = Date.now(); if (text === last && now - lastAt < 1500) return false; // dedupe double-triggered calls
  last = text; lastAt = now;
  return speakLive(text);
};
