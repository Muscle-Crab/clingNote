import assert from 'assert';
import { safeRadialGradient } from '../src/utils/canvasSafe.js';
import { drawScene } from '../src/utils/bgScenes.js';
const strict = { createRadialGradient(...a) { for (const v of a) if (!Number.isFinite(v)) throw new TypeError('non-finite'); if (a[2] < 0 || a[5] < 0) throw new Error('IndexSizeError'); return { addColorStop() {} }; } };
assert.strictEqual(safeRadialGradient(strict, NaN, 0, 0, 0, 0, 5), null);
assert.strictEqual(safeRadialGradient(strict, 0, 0, 0, 0, 0, 0), null);
assert.strictEqual(safeRadialGradient(strict, 0, 0, 0, 0, 0, Infinity), null);
assert.strictEqual(safeRadialGradient(strict, 0, 0, -1, 0, 0, 5), null);
assert.ok(safeRadialGradient(strict, 1, 2, 0, 1, 2, 5));
console.log('test-canvas-safe: ok');
import { makeScene, stepScene } from '../src/utils/bgScenes.js';
import { makeAmbience, stepAmbience, drawAmbience } from '../src/utils/heroAmbience.js';
import { drawFire2D } from '../src/utils/fireGL.js';
// A context proxy that throws exactly like the browser on bad radial gradients; every other method is a no-op.
const mkCtx = () => new Proxy({}, { get(t, k) { if (k === 'createRadialGradient') return strict.createRadialGradient; if (k === 'createLinearGradient') return () => ({ addColorStop() {} }); if (k in t) return t[k]; return () => {}; }, set(t, k, v) { t[k] = v; return true; } });
for (const [w, h] of [[0, 0], [NaN, NaN], [0, 600], [390, 0]]) {
  for (const kind of ['fire', 'rain', 'snow']) { const s = makeScene(kind, w, h, () => 0.5); stepScene(s, 0.016, () => 0.5); assert.doesNotThrow(() => drawScene(mkCtx(), s), `${kind} ${w}x${h}`); }
  for (const img of ['campfire', 'forest', 'night']) { const a = makeAmbience(img, 'none', w, h); stepAmbience(a, 0.016); assert.doesNotThrow(() => drawAmbience(mkCtx(), a, null), `amb ${img} ${w}x${h}`); if (a.sc.fire) assert.doesNotThrow(() => drawFire2D(mkCtx(), 1, a)); }
}
console.log('test-canvas-safe: draw loops ok on zero/NaN sizes');
