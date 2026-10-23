import assert from 'assert';
import { sanitize, loadPrefs, savePrefs, DEFAULTS, KEY } from '../src/utils/bgPrefs.js';
import { particleCount, makeScene, stepScene } from '../src/utils/bgScenes.js';
import { initialsOf, cropRect, isAvatarSrc } from '../src/utils/avatar.js';
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; };
assert.deepEqual(loadPrefs(mem()), { anim: 'none', track: 'lofi', volume: 0.5, forceMotion: false }, 'default = current look (no animation)');
const st = mem(); savePrefs({ anim: 'rain', track: 'ambient', volume: 0.2, forceMotion: true }, st); assert.deepEqual(loadPrefs(st), { anim: 'rain', track: 'ambient', volume: 0.2, forceMotion: true }, 'saved per device');
assert.deepEqual(sanitize({ anim: 'lava', track: 'x', volume: 9 }), { anim: 'none', track: 'lofi', volume: 1, forceMotion: false }, 'bad values fall back');
const bad = mem(); bad.setItem(KEY, '{nope'); assert.deepEqual(loadPrefs(bad), { ...DEFAULTS });
for (const a of ['snow', 'rain', 'fire']) { const sc = makeScene(a, 390, 844); assert.ok(particleCount(a, 390, 844) > 0); stepScene(sc, 0.016); }
assert.equal(initialsOf('Dalton Vee'), 'DV'); assert.equal(initialsOf('', 'zz.test@example.com'), 'ZT'); assert.equal(initialsOf('', ''), '?');
assert.deepEqual(cropRect(400, 200), { sx: 100, sy: 0, s: 200 });
assert.ok(isAvatarSrc('data:image/jpeg;base64,AAAA')); assert.ok(!isAvatarSrc('')); assert.ok(!isAvatarSrc('javascript:alert(1)')); assert.ok(!isAvatarSrc('http://x/y.png'));
console.log('test-bg-avatar: ok');
