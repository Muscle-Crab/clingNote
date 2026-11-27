// Focus Mode track picker uses the same player as the Background sheet. Run: node scripts/test-focus-tracks.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRACKS, pickFocusTrack } from '../src/utils/bgPrefs.js';

const player = {
  prefs: { track: 'lofi', volume: 0.4 },
  playing: true,
  setTrack(id) { this.prefs.track = id; this.switched = id; },
  play() { this.started = true; this.playing = true; },
};
assert.equal(pickFocusTrack(player, 'fireside'), 'fireside');
assert.equal(player.prefs.track, 'fireside', 'a pick switches the playing track');
assert.equal(player.switched, 'fireside');
assert.equal(player.volume, undefined);
assert.equal(player.prefs.volume, 0.4, 'volume stays on the shared player');
assert.notEqual(player.started, true, 'already playing: do not restart');

const idle = { prefs: { track: 'lofi', volume: 0.2 }, playing: { value: false }, setTrack(id) { this.prefs.track = id; }, play() { this.playing.value = true; this.didPlay = true; } };
pickFocusTrack(idle, 'ambient');
assert.equal(idle.prefs.track, 'ambient');
assert.equal(idle.playing.value, true, 'a pick starts the shared player when it is paused');
assert.equal(pickFocusTrack(player, 'nope'), 'fireside', 'unknown id is ignored');

const screen = readFileSync(new URL('../src/components/home/FocusMode.vue', import.meta.url), 'utf8');
assert.match(screen, /pickFocusTrack\(bg, t\.id\)/);
assert.match(screen, /useBackground\(\)/);
for (const t of TRACKS) assert.match(screen, /TRACKS/, t.id);
assert.match(screen, /data-test="focus-tracks"/);
assert.match(screen, /:data-test="'focus-track-' \+ t\.id"/);
assert.match(screen, /bg\.prefs\.track === t\.id/);
assert.doesNotMatch(screen, /Play focus music|continues on the Home Screen|data-test="focus-music"/);
assert.doesNotMatch(readFileSync(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8'), /<string>audio<\/string>/);
console.log('focus tracks: picker switches the shared player');
