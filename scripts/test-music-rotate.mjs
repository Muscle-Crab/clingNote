import assert from 'assert';
import { TRACKS, pickNextTrack, sanitize, ROTATE_MINS } from '../src/utils/bgPrefs.js';
import { STYLES } from '../src/composables/useBackgroundAudio.js';
const ids = TRACKS.map((t) => t.id);
assert.ok(ids.length >= 11, 'new lo-fi options added');
for (const id of TRACKS.filter((t) => !t.src).map((t) => t.id).filter((i) => !['lofi', 'lofi-night', 'ambient', 'fireside'].includes(i))) assert.ok(STYLES[id], 'engine style for ' + id); // recorded (src) tracks use the <audio> engine
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
let cur = 'lofi'; let bag = []; const seq = [];
for (let i = 0; i < ids.length * 6; i++) { const r = pickNextTrack(ids, cur, bag, rnd); assert.notEqual(r.next, cur, 'no immediate repeat'); assert.ok(ids.includes(r.next)); cur = r.next; bag = r.bag; seq.push(cur); }
const first = new Set(seq.slice(0, ids.length - 1)); assert.equal(first.size, ids.length - 1, 'first cycle visits every other track once');
assert.equal(new Set(seq).size, ids.length, 'cycles through all tracks');
assert.equal(pickNextTrack(['a'], 'a').next, 'a', 'single track: stays');
assert.deepEqual(ROTATE_MINS, [10, 20, 30]);
assert.equal(sanitize({}).autoRotate, false, 'off by default'); assert.equal(sanitize({}).rotateMins, 20, 'default 20 min');
assert.equal(sanitize({ rotateMins: 7 }).rotateMins, 20); assert.equal(sanitize({ autoRotate: true, rotateMins: '30' }).rotateMins, 30);
console.log('test-music-rotate: ok');
