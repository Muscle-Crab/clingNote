// Long-press-then-drag on Home task cards (useSmoothReorder): 400 ms hold, scroll-safe, tap-safe, saves via TaskSections drop.
import { readFileSync } from 'fs'; import assert from 'assert';
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const r = src('src/composables/useSmoothReorder.js');
const num = (k) => Number((r.match(new RegExp(`export const ${k} = (\\d+)`)) || [])[1]);
assert.strictEqual(num('HOLD_MS'), 400, 'hold is ~400 ms'); assert(num('HOLD_TOL') >= 6 && num('HOLD_TOL') <= 14, 'small drift tolerance');
const holdMoved = new Function('HOLD_TOL', `return ${r.match(/export const holdMoved = ([^;]+);/)[1]}`)(num('HOLD_TOL'));
assert(!holdMoved(100, 100, 105, 96), 'a still finger keeps the hold'); assert(holdMoved(100, 100, 100, 130), 'a vertical swipe (scroll) drops the hold'); assert(holdMoved(100, 100, 130, 100));
assert(/touchmove', holdMove, \{ passive: true \}/.test(r), 'pending hold never blocks native scroll');
assert(/document\.addEventListener\('scroll', cancelHold, true\)/.test(r), 'any scroll cancels a pending hold');
assert(/touchmove', blockTouch, \{ passive: false \}/.test(r), 'once lifted, the page stops scrolling under the finger');
assert(/lightHaptic\(\)/.test(r) && /reorder-lift/.test(r) && /scale\(1\.03\)/.test(r), 'light haptic + subtle lift');
assert(/swallowClick/.test(r), 'a drop is not also a tap'); assert(/classList\.contains\('task-card'\)/.test(r), 'only task cards (not section headers) are held');
const NO = r.match(/export const NO_HOLD = '([^']+)'/)[1]; for (const k of ['button', 'input', 'a', 'label']) assert(NO.split(', ').includes(k), 'controls keep their own press: ' + k);
const card = src('src/components/home/TaskCard.vue');
assert(/const onPressStart = \(e\) => \{ if \(!props\.dragDisabled\) return;/.test(card), 'old 550 ms hold-to-edit only when reordering is off');
assert(/\.task-card \{ -webkit-touch-callout: none; \}/.test(card), 'no iOS callout on hold');
const sec = src('src/components/home/TaskSections.vue'); assert(/useSmoothReorder\(/.test(sec) && /emit\('drop'/.test(sec), 'drop still saves through TaskSections');
console.log('card drag: 13 checks ok');
