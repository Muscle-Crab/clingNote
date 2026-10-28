import assert from 'assert';
import { sanitize, loadPrefs, savePrefs, DEFAULTS, KEY, IMAGES, CUSTOM_KEY, MAX_CUSTOM_CHARS, isCustomImage, loadCustomImage, saveCustomImage, clearCustomImage, fitSize, effectiveImage } from '../src/utils/bgPrefs.js';
import { particleCount, makeScene, stepScene } from '../src/utils/bgScenes.js';
import { initialsOf, cropRect, isAvatarSrc } from '../src/utils/avatar.js';
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } }; };
assert.deepEqual(loadPrefs(mem()), { anim: 'none', track: 'lofi', volume: 0.5, forceMotion: false, musicOn: false, image: 'forest', autoRotate: false, rotateMins: 20 }, 'default = current look (no animation)');
const st = mem(); savePrefs({ anim: 'rain', track: 'ambient', volume: 0.2, forceMotion: true, musicOn: true, image: 'night', autoRotate: false, rotateMins: 20 }, st); assert.deepEqual(loadPrefs(st), { anim: 'rain', track: 'ambient', volume: 0.2, forceMotion: true, musicOn: true, image: 'night', autoRotate: false, rotateMins: 20 }, 'saved per device incl. music-on (survives restart)');
assert.deepEqual(sanitize({ anim: 'lava', track: 'x', volume: 9 }), { anim: 'none', track: 'lofi', volume: 1, forceMotion: false, musicOn: false, image: 'forest', autoRotate: false, rotateMins: 20 }, 'bad values fall back');
const bad = mem(); bad.setItem(KEY, '{nope'); assert.deepEqual(loadPrefs(bad), { ...DEFAULTS });
for (const a of ['snow', 'rain', 'fire']) { const sc = makeScene(a, 390, 844); assert.ok(particleCount(a, 390, 844) > 0); stepScene(sc, 0.016); }
assert.equal(initialsOf('Dalton Vee'), 'DV'); assert.equal(initialsOf('', 'zz.test@example.com'), 'ZT'); assert.equal(initialsOf('', ''), '?');
assert.deepEqual(cropRect(400, 200), { sx: 100, sy: 0, s: 200 });
assert.ok(isAvatarSrc('data:image/jpeg;base64,AAAA')); assert.ok(!isAvatarSrc('')); assert.ok(!isAvatarSrc('javascript:alert(1)')); assert.ok(!isAvatarSrc('http://x/y.png'));
// background picture: built-in choices, sanitised, default = current forest look
assert.deepEqual(IMAGES.map((i) => i.id), ['forest', 'night', 'ocean', 'sunrise', 'mountains', 'dark']);
assert.equal(sanitize({ image: 'url(javascript:1)' }).image, 'forest'); assert.equal(sanitize({ image: 'custom' }).image, 'custom'); assert.equal(sanitize({}).image, 'forest');
assert.equal(sanitize({ image: 'ocean', musicOn: true }).musicOn, true, 'image does not disturb music-on persistence');
const imgSt = mem(); savePrefs({ image: 'sunrise' }, imgSt); assert.equal(loadPrefs(imgSt).image, 'sunrise', 'picture choice survives a restart');
const okImg = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
assert.ok(isCustomImage(okImg)); assert.ok(!isCustomImage('')); assert.ok(!isCustomImage('http://x/y.jpg')); assert.ok(!isCustomImage('data:image/svg+xml;base64,AAAA')); assert.ok(!isCustomImage('data:image/jpeg;base64,AA"); background:url(x'));
assert.ok(!isCustomImage('data:image/jpeg;base64,' + 'A'.repeat(MAX_CUSTOM_CHARS)), 'size guard');
const cs = mem(); assert.equal(loadCustomImage(cs), ''); assert.equal(saveCustomImage(okImg, cs), true); assert.equal(loadCustomImage(cs), okImg); assert.equal(cs.getItem(CUSTOM_KEY), okImg);
assert.equal(saveCustomImage('nope', cs), false); assert.equal(saveCustomImage(okImg, { setItem() { throw new Error('quota'); } }), false, 'quota error is reported, not thrown');
clearCustomImage(cs); assert.equal(loadCustomImage(cs), '', 'reset removes the upload');
assert.deepEqual(fitSize(4000, 2000), { w: 1000, h: 500 }); assert.deepEqual(fitSize(600, 400), { w: 600, h: 400 }, 'never upscales'); assert.deepEqual(fitSize(1000, 3000), { w: 333, h: 1000 });
assert.equal(effectiveImage('custom', ''), 'forest', 'custom without a saved photo falls back to the default'); assert.equal(effectiveImage('custom', okImg), 'custom'); assert.equal(effectiveImage('night', ''), 'night'); assert.equal(effectiveImage('zzz', ''), 'forest');
console.log('test-bg-avatar: ok');
