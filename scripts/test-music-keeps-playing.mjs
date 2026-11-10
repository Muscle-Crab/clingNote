// Focus music stays up through UI sounds, notification scheduling, and dictation.
// The first Play tap starts it in the same turn as the gesture. Run: node scripts/test-music-keeps-playing.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as A from '../src/utils/audioSession.js';
import { foregroundPlan, shouldRebuild } from '../src/utils/musicResume.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const plugin = {
  calls: [],
  playing: false,
  ensureMix() { this.calls.push('ensureMix'); return Promise.resolve(); },
  otherAudioPlaying() { return Promise.resolve({ playing: this.playing }); },
  setMusicPlaying(o) { this.calls.push('music:' + o.playing); return Promise.resolve(); },
  prepareForegroundMusic() { return Promise.resolve({ active: true }); },
};
const sess = { type: 'auto' };
globalThis.window = { Capacitor: { getPlatform: () => 'ios', Plugins: { ClingVoice: plugin } } };
Object.defineProperty(globalThis, 'navigator', { value: { audioSession: sess }, configurable: true });

A.initAudioSession();
assert.equal(sess.type, 'ambient');
A.setMusicPlaying(true);
assert.equal(sess.type, 'playback', 'first start picks playback in the same turn, before any refresh');
A.markMusicAudible(true);
plugin.playing = true;
await A.refreshOtherAudio();
assert.equal(sess.type, 'playback', 'a later "other audio" refresh does not retarget a live music context');
A.ensureAmbient();
assert.equal(sess.type, 'playback', 'a UI sound does not switch the session while music is audible');
A.markMusicAudible(false);
A.setMusicPlaying(false);
assert.equal(sess.type, 'ambient');

const sfx = read('../src/utils/sfx.js');
const sounds = read('../src/composables/useSounds.js');
const notify = read('../src/utils/localNotify.js');
const voice = read('../src/composables/useVoiceover.js');
const engine = read('../src/composables/useBackgroundAudio.js');
const bg = read('../src/composables/useBackground.js');
assert.doesNotMatch(sfx, /new AC\(|new AudioContext|webkitAudioContext\(\)/, 'sound effects do not open a second audio context');
assert.doesNotMatch(sounds, /new AC\(|new AudioContext|webkitAudioContext\(\)/, 'UI sounds do not open a second audio context');
assert.match(sfx, /musicContext\(\) \|\| sharedAudioContext\(\)/);
assert.match(sounds, /musicContext\(\) \|\| sharedAudioContext\(\)/);
assert.match(notify, /audioRestored\('notification'\)/);
assert.doesNotMatch(notify, /musicOn\s*=\s*false/);
assert.match(voice, /audioRestored\('voice'\)/, 'the robot voice gives the music context back when the clip ends');
assert.match(engine, /ctx\.resume\(\)/);
assert.match(engine, /markMusicAudible\(true\)/);
assert.doesNotMatch(engine.slice(engine.indexOf('start(id'), engine.indexOf('async resume')), /await /, 'the first tap resumes audio before any await');
const play = bg.slice(bg.indexOf('play() {'), bg.indexOf('async pause'));
assert.match(play, /engine\.start\(/);
assert.doesNotMatch(play.slice(0, play.indexOf('engine.start')), /await /, 'Play starts inside the tap, before any await');
assert.match(bg, /addEventListener\('cn:audio-restored'/);
assert.equal(foregroundPlan({ musicOn: true, state: 'interrupted' }), 'resume', 'dictation ends by resuming the same context');
assert.equal(foregroundPlan({ musicOn: false, state: 'interrupted' }), 'idle');
assert.doesNotMatch(read('../ios/App/App/Info.plist'), /<string>audio<\/string>/, 'no background audio mode');

function audioParam() {
  const p = { value: 0, setValueAtTime(v) { p.value = v; }, exponentialRampToValueAtTime(v) { p.value = v; }, linearRampToValueAtTime(v) { p.value = v; }, cancelScheduledValues() {} };
  return p;
}
function audioNode() {
  return { connect() { return this; }, disconnect() {}, start() {}, stop() {}, frequency: audioParam(), detune: audioParam(), gain: audioParam(), Q: audioParam(), type: '', buffer: null, loop: false, fftSize: 0, getByteTimeDomainData(a) { if (a) a.fill(128); } };
}
class FakeAudioContext {
  constructor() { FakeAudioContext.made += 1; this.state = 'suspended'; this.currentTime = 1; this.sampleRate = 8000; this.destination = audioNode(); this.onstatechange = null; }
  resume() { this.state = 'running'; this.resumes = (this.resumes || 0) + 1; if (this.onstatechange) this.onstatechange(); return Promise.resolve(); }
  suspend() { this.state = 'suspended'; FakeAudioContext.suspends += 1; return Promise.resolve(); }
  close() { this.state = 'closed'; FakeAudioContext.closes += 1; return Promise.resolve(); }
  createGain() { FakeAudioContext.gains += 1; const n = audioNode(); if (!FakeAudioContext.master) FakeAudioContext.master = n; return n; }
  createOscillator() { FakeAudioContext.osc += 1; return audioNode(); }
  createBiquadFilter() { return audioNode(); }
  createAnalyser() { return audioNode(); }
  createBufferSource() { return audioNode(); }
  createBuffer() { return { getChannelData: () => new Float32Array(16) }; }
}
FakeAudioContext.made = 0; FakeAudioContext.closes = 0; FakeAudioContext.suspends = 0; FakeAudioContext.osc = 0; FakeAudioContext.gains = 0; FakeAudioContext.master = null;
window.AudioContext = FakeAudioContext;
const { createEngine } = await import('../src/composables/useBackgroundAudio.js');
const player = createEngine();
await player.start('lofi', 0.5);
assert.equal(player.state, 'running', 'Play resumes the audio context');
assert.ok(FakeAudioContext.osc > 0, 'Play schedules audible notes');
assert.equal(FakeAudioContext.closes, 0, 'Play does not close the context');
assert.equal(FakeAudioContext.made, 1, 'Play uses one context');
const firstCtx = FakeAudioContext.made;
await player.stop();
assert.equal(FakeAudioContext.closes, 0, 'pause keeps the context so the next Play can resume it');
await player.start('fireside', 0.5);
assert.equal(FakeAudioContext.made, firstCtx, 'the next Play reuses the same context');
assert.equal(player.state, 'running');
assert.ok(player.context.resumes >= 2, 'the second Play resumes audio inside the tap');
player.setVolume(1);
assert.equal(FakeAudioContext.master.gain.value, 0.9, 'dragging the slider sets the live gain');
const before = FakeAudioContext.osc;
player.crossfadeTo('night', 0.05);
await new Promise((r) => setTimeout(r, 80));
assert.ok(FakeAudioContext.osc > before, 'a crossfade keeps scheduling notes');
assert.equal(FakeAudioContext.master.gain.value, 0.9, 'a crossfade does not leave the gain at silence');
assert.equal(shouldRebuild('interrupted', 'running'), true);
assert.equal(shouldRebuild('running', 'running'), false, 'a running blip does not restart the graph');
assert.equal(foregroundPlan({ musicOn: true, state: 'running' }), 'keep');
assert.equal(foregroundPlan({ musicOn: true, state: 'interrupted' }), 'resume');
await player.stop();

console.log('music keeps playing: sounds, notifications, first tap, dictation');
