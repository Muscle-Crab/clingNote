// Daily progress live animations + central sfx: pure logic checks (no DOM).
import assert from 'node:assert/strict';
import fs from 'node:fs';
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
const { sfx, sfxAllowed, coinTickTimes, SFX_KINDS, __sfxTest } = await import('../src/utils/sfx.js');
const { readSeen, writeSeen, tweenNumber } = await import('../src/utils/countUp.js');
for (const k of ['tap', 'open', 'add', 'complete', 'timerStart', 'timerStop', 'coin', 'points', 'levelUp', 'grow', 'impact', 'charge', 'error']) assert.ok(SFX_KINDS.includes(k), k);
// muted by default / no gesture => silent
assert.equal(sfx('tap'), false);
// throttle
__sfxTest.reset(); assert.equal(sfxAllowed('impact', 1000), true); assert.equal(sfxAllowed('impact', 1500), false); assert.equal(sfxAllowed('impact', 2300), true);
// coin ticks: capped at 12 for big jumps, at least 1, inside the window
assert.equal(coinTickTimes(500, 800).length, 12); assert.equal(coinTickTimes(3, 800).length, 1); assert.ok(coinTickTimes(40, 800).every((t) => t >= 0 && t < 800));
// last-seen per user (+ per day for the stage)
writeSeen('stage', 'ZZTEST_a', 2, '2026-10-30'); assert.equal(readSeen('stage', 'ZZTEST_a', '2026-10-30'), 2); assert.equal(readSeen('stage', 'ZZTEST_a', '2026-10-31'), null); assert.equal(readSeen('stage', 'ZZTEST_b', '2026-10-30'), null);
writeSeen('streak', 'ZZTEST_a', 3); assert.equal(readSeen('streak', 'ZZTEST_a'), 3);
// tween falls back to instant without rAF
let got = null; tweenNumber(0, 10, 500, (v) => { got = v; }); assert.equal(got, 10);
// ProgressBar wiring
const pb = fs.readFileSync(new URL('../src/components/home/ProgressBar.vue', import.meta.url), 'utf8');
for (const s of ['prefers-reduced-motion', "sfx('grow')", "sfx('impact')", "sfx('charge'", "sfx('coin'", 'data-test="streak-fx"', 'scene--zoom', 'milestone-dot--pop', "readSeen('stage'"]) assert.ok(pb.includes(s), s);
const hv = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
assert.ok(hv.includes(':uid="userId'));
console.log('test-grow-anim: ok');
