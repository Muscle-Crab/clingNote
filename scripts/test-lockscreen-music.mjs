import assert from 'assert';
import fs from 'fs';
import { TRACKS, stepTrack, trackInfo, sanitize } from '../src/utils/bgPrefs.js';
import { metadataFor, setNowPlaying, setPlaybackState, bindActions, ACTIONS } from '../src/utils/mediaSession.js';
import { createFileEngine } from '../src/composables/useFileAudio.js';
// all 11 original generated tracks kept, 10 recorded added
for (const id of ['lofi', 'lofi-night', 'ambient', 'lofi-rain', 'lofi-jazz', 'chill-beats', 'lofi-piano', 'midnight-drive', 'cafe-corner', 'sunset-tape', 'fireside']) assert.ok(TRACKS.some((t) => t.id === id && !t.src), 'kept ' + id);
const rec = TRACKS.filter((t) => t.src); assert.equal(rec.length, 10); assert.equal(TRACKS.length, 21);
const credits = fs.readFileSync(new URL('../LICENSES/music-credits.md', import.meta.url), 'utf8');
for (const t of rec) { assert.ok(fs.existsSync(new URL('../public/' + t.src, import.meta.url)), 'file ' + t.src); assert.ok(credits.includes('| ' + t.id + ' |'), 'credited ' + t.id); assert.equal(sanitize({ track: t.id }).track, t.id); }
assert.ok(!/BY-NC|BY-ND/.test(credits));
// prev/next wrap across the whole list
assert.equal(stepTrack('lofi', 1), TRACKS[1].id); assert.equal(stepTrack(TRACKS[0].id, -1), TRACKS[20].id); assert.equal(stepTrack(TRACKS[20].id, 1), TRACKS[0].id); assert.equal(stepTrack('bogus', 1), TRACKS[1].id);
assert.equal(trackInfo('nope').id, 'lofi');
// media session metadata + handlers
const m = metadataFor('oga-chills'); assert.equal(m.title, 'Chills'); assert.match(m.artist, /ClingNote/); assert.ok(m.artwork.length);
assert.equal(metadataFor('lofi').artist, 'ClingNote');
const handlers = {}; const nav = { mediaSession: { setActionHandler: (a, f) => { handlers[a] = f; } } };
const calls = []; const bound = bindActions(Object.fromEntries(ACTIONS.map((a) => [a, () => calls.push(a)])), nav);
assert.deepEqual(bound.sort(), [...ACTIONS].sort()); ACTIONS.forEach((a) => handlers[a]()); assert.deepEqual(calls, ACTIONS);
assert.ok(setNowPlaying('oga-dimly-lit', nav)); assert.equal(nav.mediaSession.metadata.title, 'Dimly lit');
setPlaybackState('playing', nav); assert.equal(nav.mediaSession.playbackState, 'playing');
assert.equal(setNowPlaying('lofi', {}), false); assert.deepEqual(bindActions({ play() {} }, {}), []);
// file engine drives an <audio>-like element
const ev = {}; const el = { volume: 1, src: '', currentTime: 5, paused: true, ended: false, setAttribute() {}, getAttribute() { return this.src; }, addEventListener: (n, f) => { ev[n] = f; }, play() { this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } };
const fe = createFileEngine(() => el); const states = []; fe.onStateChange = (s) => states.push(s);
await fe.start('oga-chills', 0.4); assert.equal(fe.state, 'running'); assert.match(el.src, /music\/oga-chills\.mp3$/); assert.equal(el.loop, true);
fe.setTrack('oga-dimly-lit'); assert.match(el.src, /oga-dimly-lit/); assert.equal(el.currentTime, 0);
el.paused = true; ev.pause(); assert.equal(fe.playing, false); assert.deepEqual(states.slice(-1), ['suspended']);
await fe.start('oga-chills'); await fe.stop(); assert.equal(el.paused, true); assert.equal(fe.state, 'suspended');
// iOS config
const plist = fs.readFileSync(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8'); assert.match(plist, /UIBackgroundModes<\/key>\s*<array>[\s\S]*?<string>audio<\/string>/);
const sw = fs.readFileSync(new URL('../ios/App/App/ClingNativePlugin.swift', import.meta.url), 'utf8'); assert.match(sw, /name: "setMusicSession"/); assert.match(sw, /@objc func setMusicSession/);
console.log('test-lockscreen-music: ok');
