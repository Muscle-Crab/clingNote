// Background music fix: in-app sounds must never take exclusive audio while the user's own music plays.
import assert from 'assert';
import { readFileSync } from 'fs';
const A = await import('../src/utils/audioSession.js');
assert.equal(A.sessionTypeFor({}), 'ambient');
assert.equal(A.sessionTypeFor({ music: false, otherAudio: true }), 'ambient');
assert.equal(A.sessionTypeFor({ music: true, otherAudio: true }), 'ambient', 'Spotify playing: in-app music mixes');
assert.equal(A.sessionTypeFor({ music: true, otherAudio: false }), 'playback');
// fake iOS shell
const plugin = { calls: [], playing: true, ensureMix() { this.calls.push('ensureMix'); return Promise.resolve(); }, otherAudioPlaying() { return Promise.resolve({ playing: this.playing }); }, setMusicPlaying(o) { this.calls.push('music:' + o.playing); return Promise.resolve(); } };
const sess = { type: 'auto' };
globalThis.window = { Capacitor: { getPlatform: () => 'ios', Plugins: { ClingVoice: plugin } } };
Object.defineProperty(globalThis, 'navigator', { value: { audioSession: sess }, configurable: true });
A.initAudioSession(); assert.equal(sess.type, 'ambient'); assert.ok(plugin.calls.includes('ensureMix'));
await A.refreshOtherAudio(); assert.equal(A.otherAudioBusy(), true);
A.setMusicPlaying(true); assert.equal(sess.type, 'ambient'); await new Promise((r) => setTimeout(r, 0)); assert.equal(sess.type, 'ambient', 'never non-mixable playback over Spotify');
A.ensureAmbient(); assert.equal(sess.type, 'ambient');
plugin.playing = false; A.setMusicPlaying(false); A.setMusicPlaying(true); await new Promise((r) => setTimeout(r, 0)); assert.equal(sess.type, 'playback', 'alone: lock-screen playback');
A.setMusicPlaying(false); assert.equal(sess.type, 'ambient');
// native: one mixable category; speech input mixes; resume re-asserts
const sw = readFileSync(new URL('../ios/App/App/ClingVoicePlugin.swift', import.meta.url), 'utf8');
assert.ok(/name: "ensureMix"/.test(sw)); assert.ok(/playAndRecord[^\n]*mixWithOthers/.test(sw));
assert.ok(!/setCategory\(\.playback[^\n]*options: \[\]\)/.test(sw));
assert.ok(/ClingVoicePlugin\.mixWithOthers\(\)/.test(readFileSync(new URL('../ios/App/App/AppDelegate.swift', import.meta.url), 'utf8')));
// a random tap must not restart in-app music while other audio plays
assert.ok(/if \(otherAudioBusy\(\)\) return;/.test(readFileSync(new URL('../src/composables/useBackground.js', import.meta.url), 'utf8')));
console.log('test-audio-mix: ok');
