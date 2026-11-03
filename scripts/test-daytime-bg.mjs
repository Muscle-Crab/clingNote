// Time-of-day backgrounds: hour -> scene mapping, Auto vs manual override, gallery, prefs persistence.
import assert from 'assert';
const D = await import('../src/utils/daytimeBg.js');
const P = await import('../src/utils/bgPrefs.js');
const H = await import('../src/utils/heroAmbience.js');
const at = (h, m = 0) => new Date(2026, 10, 3, h, m, 0);
// mapping incl. every boundary
const exp = { 0: 'night', 4: 'night', 5: 'morning', 10: 'morning', 11: 'noon', 15: 'noon', 16: 'evening', 19: 'evening', 20: 'night', 23: 'night' };
for (const [h, p] of Object.entries(exp)) assert.equal(D.periodForHour(Number(h)), p, 'hour ' + h);
for (let h = 0; h < 24; h++) assert.ok(['morning', 'noon', 'evening', 'night'].includes(D.periodForHour(h)));
assert.equal(D.periodForHour(4.99), 'night'); assert.equal(D.periodForHour(10.99), 'morning'); assert.equal(D.periodForHour(19.99), 'evening');
assert.equal(D.periodForHour(24), 'night'); assert.equal(D.periodForHour(-1), 'night'); assert.equal(D.periodForHour('x'), 'night');
assert.equal(D.periodAt(at(10, 59)), 'morning'); assert.equal(D.periodAt(at(11, 0)), 'noon');
// precise boundary timer
assert.equal(D.msUntilNextPeriod(at(10, 0)), 3600000); assert.equal(D.msUntilNextPeriod(at(21, 0)), 8 * 3600000); assert.ok(D.msUntilNextPeriod(at(4, 59)) <= 60000);
// override logic: only 'auto' follows the clock
assert.equal(D.resolveImage('auto', at(7)), 'dt-morning'); assert.equal(D.resolveImage('auto', at(13)), 'dt-noon');
assert.equal(D.resolveImage('auto', at(18)), 'dt-evening'); assert.equal(D.resolveImage('auto', at(2)), 'dt-night');
for (const h of [2, 7, 13, 18, 22]) { assert.equal(D.resolveImage('dt-night', at(h)), 'dt-night', 'manual daytime pick wins at ' + h); assert.equal(D.resolveImage('g-aurora', at(h)), 'g-aurora'); assert.equal(D.resolveImage('forest', at(h)), 'forest'); }
assert.equal(D.pickImage('g-mint', 'auto'), 'auto'); assert.equal(D.pickImage('auto', 'g-mint'), 'g-mint'); assert.equal(D.pickImage('g-mint', ''), 'g-mint');
assert.equal(D.isManual('auto'), false); assert.equal(D.isManual('dt-noon'), true);
// gallery: >= 8 extra scenes with labels + CSS, all distinct
assert.ok(D.GALLERY_IDS.length >= 8); assert.equal(D.DAYTIME_IDS.length, 4);
for (const id of D.GRADIENT_IDS) { assert.ok(/gradient\(/.test(D.gradientCss(id)), id); assert.ok(!/url\(/.test(D.gradientCss(id)), 'no network images'); }
assert.equal(new Set(D.GRADIENT_IDS.map(D.gradientCss)).size, D.GRADIENT_IDS.length);
// prefs: Auto is the default; manual picks persist; Auto restores clock control
assert.equal(P.DEFAULTS.image, 'auto'); assert.equal(P.sanitize({}).image, 'auto'); assert.equal(P.sanitize({ image: 'nope' }).image, 'auto');
for (const id of ['auto', ...D.GRADIENT_IDS, 'forest']) assert.equal(P.sanitize({ image: id }).image, id);
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; };
const st = mem(); P.savePrefs({ image: 'g-cosmos' }, st); assert.equal(P.effectiveImage(P.loadPrefs(st).image, '', at(7)), 'g-cosmos', 'manual pick survives restart and ignores time');
P.savePrefs({ image: 'auto' }, st); assert.equal(P.effectiveImage(P.loadPrefs(st).image, '', at(21)), 'dt-night');
assert.equal(P.effectiveImage('custom', '', at(13)), 'dt-noon', 'custom without a photo falls back to Auto');
// every scene has an ambience entry (no forest tree-warp on a gradient)
for (const id of D.GRADIENT_IDS) { assert.ok(H.SCENES[id], id); assert.ok(!H.SCENES[id].trees); }
assert.equal(H.animAllowed('dt-noon', 'rain'), false); assert.equal(H.animAllowed('dt-night', 'snow'), true);
console.log('test-daytime-bg: ok');
