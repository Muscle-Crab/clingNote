// The one robot voice (ElevenLabs). Keep voiceId in sync with src/voiceover/scripts.js VOICE (scripts/test-tts-fn.js checks it).
// ELEVENLABS_VOICE_ID / ELEVENLABS_MODEL env vars may override at deploy time; the API key is env-only (ELEVENLABS_API_KEY).
const VOICE_ID = 'iP95p4xoKVk53GoZ742B'; // "Chris": natural, warm, down-to-earth American male
const LIVE_MODEL = 'eleven_turbo_v2_5'; // low latency for live lines; pre-recorded MP3s use eleven_multilingual_v2
const SETTINGS = { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true };
const OUTPUT = 'mp3_44100_64';
module.exports = { VOICE_ID, LIVE_MODEL, SETTINGS, OUTPUT };
