// Switching tracks, skipping ahead, or crossfading must leave exactly one track connected.
// A load that finishes after a newer choice must not start. Run: node scripts/test-music-one-track.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
globalThis.window = {};
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });

function audioParam() {
  const p = { value: 0, setValueAtTime(v) { p.value = v; }, exponentialRampToValueAtTime(v) { p.value = v; }, linearRampToValueAtTime(v) { p.value = v; }, cancelScheduledValues() {} };
  return p;
}
function audioNode() {
  const n = {
    started: false,
    halted: false,
    disconnected: false,
    connected: false,
    buffer: null,
    src: '',
    loop: false,
    connect() { n.connected = true; return n; },
    disconnect() { n.disconnected = true; n.connected = false; },
    start() { n.started = true; },
    stop(when) { if (when === 0 || when == null) n.halted = true; },
    frequency: audioParam(),
    detune: audioParam(),
    gain: audioParam(),
    Q: audioParam(),
    type: '',
    fftSize: 0,
    getByteTimeDomainData(a) { if (a) a.fill(128); },
  };
  FakeAudioContext.all.push(n);
  return n;
}
class FakeAudioContext {
  constructor() {
    FakeAudioContext.made += 1;
    this.state = 'suspended';
    this.currentTime = 5;
    this.sampleRate = 8000;
    this.destination = audioNode();
    this.onstatechange = null;
    this.holdResume = FakeAudioContext.holdResume;
  }
  resume() {
    if (this.holdResume) {
      return new Promise((resolve) => {
        this.releaseResume = () => {
          this.holdResume = false;
          this.state = 'running';
          this.resumes = (this.resumes || 0) + 1;
          if (this.onstatechange) this.onstatechange();
          resolve();
        };
      });
    }
    this.state = 'running';
    this.resumes = (this.resumes || 0) + 1;
    if (this.onstatechange) this.onstatechange();
    return Promise.resolve();
  }
  suspend() { this.state = 'suspended'; FakeAudioContext.suspends += 1; return Promise.resolve(); }
  close() { this.state = 'closed'; FakeAudioContext.closes += 1; return Promise.resolve(); }
  createGain() { return audioNode(); }
  createOscillator() { return audioNode(); }
  createBiquadFilter() { return audioNode(); }
  createAnalyser() { return audioNode(); }
  createBufferSource() { const n = audioNode(); n.src = 'buffer-source'; return n; }
  createBuffer() { return { getChannelData: () => new Float32Array(8) }; }
}
FakeAudioContext.made = 0;
FakeAudioContext.closes = 0;
FakeAudioContext.suspends = 0;
FakeAudioContext.all = [];
FakeAudioContext.holdResume = true;
window.AudioContext = FakeAudioContext;

const active = () => FakeAudioContext.all.filter((n) => n.started && !n.halted && !n.disconnected);
const tracksOf = (list) => [...new Set(list.map((n) => n.__track).filter(Boolean))];
const oneTrack = (list, id) => {
  assert.ok(list.length >= 1, 'the current track has a connected source');
  assert.deepEqual(tracksOf(list), [id], 'only one track is connected');
  assert.equal(new Set(list.map((n) => n.__gen)).size, 1, 'those sources belong to one generation');
};

const engineSrc = read('../src/composables/useBackgroundAudio.js');
const bg = read('../src/composables/useBackground.js');
assert.match(bg, /engine\.crossfadeTo\(r\.next\)/, 'next track goes through the crossfade');
assert.match(bg, /engine\.setTrack\(prefs\.track\)/, 'the sheet and Focus Mode picker share setTrack');
assert.match(engineSrc, /gen !== my/, 'a stale load checks the generation before it starts');
assert.match(engineSrc, /clearTimeout\(fadeTimer\)/, 'a newer choice cancels the pending crossfade');
assert.doesNotMatch(engineSrc, /ctx\.close\(/, 'a track change does not close the shared context');
assert.doesNotMatch(read('../ios/App/App/Info.plist'), /<string>audio<\/string>/, 'no background audio mode');

const { createEngine } = await import('../src/composables/useBackgroundAudio.js');
const player = createEngine();

try {
const pending = player.start('lofi', 0.5);
const ctx = player.context;
assert.equal(ctx.state, 'suspended', 'the first start is waiting on its audio load');
player.setTrack('fireside');
const duringLoad = active();
oneTrack(duringLoad, 'fireside');
ctx.releaseResume();
await pending;
await new Promise((r) => setTimeout(r, 0));
assert.equal(active().length, duringLoad.length, 'the late load does not start the track it captured');
oneTrack(active(), 'fireside');
assert.equal(FakeAudioContext.made, 1, 'the late load reuses the one context');
assert.equal(FakeAudioContext.closes, 0);

player.queueAhead(8);
const queued = active().slice();
assert.ok(queued.length > duringLoad.length, 'notes were already scheduled ahead');
for (const id of ['lofi-piano', 'midnight-drive', 'cafe-corner', 'sunset-tape', 'ambient']) {
  for (const n of active()) n.src = 'stale-' + (n.__track || '');
  const previous = active().slice();
  player.setTrack(id);
  oneTrack(active(), id);
  for (const n of previous) {
    assert.equal(n.disconnected, true, 'the previous source is disconnected');
    assert.equal(n.halted, true, 'the previous source is stopped');
    assert.equal(n.buffer, null, 'the previous buffer is cleared');
    assert.equal(n.src, '', 'the previous source is cleared');
  }
}

const beforeFade = active().slice();
player.crossfadeTo('night', 0.2);
player.crossfadeTo('cafe-corner', 0.04);
await new Promise((r) => setTimeout(r, 120));
oneTrack(active(), 'cafe-corner');
for (const n of beforeFade) assert.equal(n.disconnected, true, 'the track that was playing before the crossfade is gone');
assert.ok(!active().some((n) => n.__track === 'night'), 'the cancelled crossfade never starts');

const beforeRebuild = active().slice();
assert.equal(player.rebuild(), true);
oneTrack(active(), 'cafe-corner');
for (const n of beforeRebuild) assert.equal(n.disconnected, true, 'rebuild disconnects the old graph');
assert.notEqual(active()[0].__gen, beforeRebuild[0].__gen);

await player.start('fireside', 0.5);
oneTrack(active(), 'fireside');
assert.equal(FakeAudioContext.made, 1, 'Play after a track change does not open a second context');
assert.equal(FakeAudioContext.closes, 0);
} finally {
  await player.stop();
}

console.log('music one track: switch, crossfade, pending load');
