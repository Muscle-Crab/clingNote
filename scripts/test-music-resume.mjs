import assert from 'assert';
import { loadPrefs, savePrefs, KEY, tapAction, restoreFromBackup, DEFAULTS } from '../src/utils/bgPrefs.js';
import { needsNewContext } from '../src/composables/useBackgroundAudio.js';
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } }; };
// persistence: every music setting round-trips (simulated app close/reopen = fresh load from same storage)
const st = mem(); const saved = { anim: 'rain', track: 'cafe-corner', volume: 0.35, forceMotion: false, musicOn: true, image: 'night', autoRotate: true, rotateMins: 30 };
savePrefs(saved, st); assert.deepEqual(loadPrefs(st), saved, 'track/volume/auto-rotate/interval restored after reopen');
assert.deepEqual(loadPrefs(mem()), { ...DEFAULTS }, 'fresh install = defaults');
// native backup restore only when localStorage copy was wiped
assert.equal(restoreFromBackup('{"track":"lofi"}', JSON.stringify(saved)), null, 'local copy wins');
assert.deepEqual(restoreFromBackup(null, JSON.stringify(saved)), saved, 'wiped localStorage -> restored from native backup');
assert.equal(restoreFromBackup(null, 'garbage'), null); assert.equal(restoreFromBackup(null, null), null);
// resume logic
assert.equal(tapAction(true, 'running'), 'pause');
for (const s of ['suspended', 'interrupted', 'closed', 'none']) assert.equal(tapAction(true, s), 'play', 'stale "playing" + ' + s + ' -> tap starts audio');
assert.equal(tapAction(false, 'running'), 'play');
for (const s of [undefined, 'closed', 'interrupted']) assert.equal(needsNewContext(s), true, 'recreate on ' + s);
for (const s of ['running', 'suspended']) assert.equal(needsNewContext(s), false, 'reuse on ' + s);
assert.ok(KEY);
console.log('test-music-resume: ok');
