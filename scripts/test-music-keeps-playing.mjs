// Focus music stays up through UI sounds, notification scheduling, and dictation.
// The first Play tap starts it in the same turn as the gesture. Run: node scripts/test-music-keeps-playing.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as A from '../src/utils/audioSession.js';
import { foregroundPlan } from '../src/utils/musicResume.js';

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

console.log('music keeps playing: sounds, notifications, first tap, dictation');
