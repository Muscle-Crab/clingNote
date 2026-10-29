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
assert.deepEqual(IMAGES.map((i) => i.id), ['forest', 'night', 'ocean', 'sunrise', 'mountains', 'campfire', 'dark']);
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
// weather fits the picture + calm, looping, depth-layered particles
{
  const { animAllowed, effectiveAnim, coverRect, makeAmbience, stepAmbience, treeShift } = await import('../src/utils/heroAmbience.js');
  const { windAt } = await import('../src/utils/bgScenes.js');
  for (const img of ['sunrise', 'ocean']) { assert.ok(!animAllowed(img, 'rain') && !animAllowed(img, 'snow'), img + ' is clear'); assert.equal(effectiveAnim(img, 'rain'), 'none'); assert.ok(!animAllowed(img, 'fire')); }
  assert.ok(animAllowed('campfire', 'fire') && animAllowed('campfire', 'snow') && !animAllowed('campfire', 'rain'), 'campfire: fire + snow, never rain');
  for (const img of ['forest', 'night', 'mountains', 'dark', 'custom']) assert.ok(!animAllowed(img, 'fire'), 'fire only on campfire');
  { const am = makeAmbience('campfire', 'fire', 390, 404); assert.ok(am.embers.length > 0 && am.embers.length <= 12, 'a few embers'); for (let i = 0; i < 200; i++) stepAmbience(am, 0.05); assert.ok(am.embers.every((e) => e.y < 404 && e.y > -50), 'embers loop'); }
  assert.ok(animAllowed('forest', 'rain') && animAllowed('forest', 'snow') && animAllowed('mountains', 'rain'));
  assert.ok(!animAllowed('night', 'rain') && animAllowed('night', 'snow'));
  const cr = coverRect(1024, 576, 390, 404); assert.ok(cr.w >= 390 - 0.01 && cr.h >= 404 - 0.01 && cr.x <= 0 && cr.y <= 0, 'cover fills the box');
  for (const a of ['snow', 'rain']) {
    const sc = makeScene(a, 390, 844, () => 0.5); for (let i = 0; i < 600; i++) stepScene(sc, 0.05);
    assert.ok(sc.p.every((p) => p.y < 844 + 60 && p.y > -140), a + ' loops (respawns above the top)');
    const zs = makeScene(a, 390, 844).p.map((p) => p.z); assert.ok(Math.min(...zs) < 0.3 && Math.max(...zs) > 0.5, a + ' has depth');
  }
  for (let t = 0; t < 120; t += 0.5) { const w = windAt(t, 'rain'); assert.ok(w > 0 && w < 1.2, 'calm wind'); }
  const am = makeAmbience('forest', 'rain', 390, 404); const s0 = treeShift(am, 0.9, 0.2); for (let i = 0; i < 20; i++) stepAmbience(am, 0.1); const s1 = treeShift(am, 0.9, 0.2);
  assert.ok(Math.abs(s1 - s0) > 0.5 && Math.abs(s1) < 24, 'tree tops sway visibly but softly'); assert.equal(treeShift(am, 0.9, 1.0), 0, 'trunk base stays put');
  assert.equal(treeShift(makeAmbience('sunrise', 'none', 390, 404), 0.9, 0.2), 0, 'no trees on sunrise');
}
{ const { buildTreeMask, SCENES } = await import('../src/utils/heroAmbience.js');
  const gw = 20, gh = 10, lum = new Float32Array(gw * gh).fill(8); lum[1 * gw + 16] = 200; // bright moon pixel in the sky
  const mk = buildTreeMask(lum, gw, gh, SCENES.forest.trees); assert.ok(mk.m[9 * gw + 18] > 0.8, 'dark low tree pixels sway'); assert.ok(mk.m[0 * gw + 12] < 0.1, 'sky above the skyline stays still'); }
console.log('weather-fit + scenes ok');
