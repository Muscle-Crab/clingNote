// Press-and-hold on the assistant face (Home robot FAB + global assistant FAB): tolerant of drift, one shared threshold, iOS-safe CSS.
import { readFileSync } from 'fs'; import assert from 'assert';
import { createLongPress, HOLD_MS, MOVE_TOL } from '../src/utils/longPress.js';
const mk = () => { let fn = null; const o = { long: 0, tap: 0 }; const lp = createLongPress({ onLong: () => o.long++, onTap: () => o.tap++, setTimer: (f) => { fn = f; return 1; }, clearTimer: () => { fn = null; } }); return { lp, o, fire: () => fn && fn() }; };
const ev = (x = 0, y = 0, extra = {}) => ({ clientX: x, clientY: y, pointerId: 1, button: 0, cancelable: true, preventDefault() { this.dp = true; }, ...extra });
{ const { lp, o, fire } = mk(); lp.down(ev(100, 100)); lp.move(ev(100 + MOVE_TOL - 1, 100 - MOVE_TOL + 1)); fire(); assert.equal(o.long, 1, 'small drift keeps the hold'); const u = ev(); lp.up(u); assert(u.dp && o.tap === 0 && lp.wasLong(), 'release after hold is not a tap'); }
{ const { lp, o, fire } = mk(); lp.down(ev(100, 100)); lp.move(ev(100, 100 + MOVE_TOL + 5)); fire(); assert.equal(o.long, 0, 'a real drag cancels'); }
{ const { lp, o, fire } = mk(); lp.down(ev()); lp.cancel(); fire(); assert.equal(o.long, 0, 'pointercancel cancels'); }
{ const { lp, o } = mk(); lp.down(ev()); lp.up(ev()); assert(o.tap === 1 && o.long === 0 && !lp.wasLong(), 'short press is a tap'); }
{ const { lp, o, fire } = mk(); lp.down(ev()); fire(); lp.up(ev()); lp.down(ev()); assert(!lp.wasLong(), 'next press resets'); lp.cancel(); lp.down(ev(0, 0, { button: 2 })); fire(); assert.equal(o.long, 1, 'right-click ignored'); }
assert(HOLD_MS >= 400 && HOLD_MS <= 600, 'hold threshold');
import { HOLD_MS as A } from '../src/utils/sergeantMenu.js'; import { HOLD_MS as B } from '../src/utils/assistantFab.js';
assert(A === HOLD_MS && B === HOLD_MS, 'one hold length for every assistant face');
for (const f of ['src/components/home/FabButtons.vue', 'src/components/shell/AssistantFab.vue']) {
  const s = readFileSync(f, 'utf8');
  assert(/@pointercancel="lp\.cancel"/.test(s) && /@pointermove="lp\.move"/.test(s) && /@contextmenu\.prevent/.test(s), f + ' wires the shared handlers');
  assert(!/@pointerleave/.test(s), f + ': pointerleave must not cancel the hold');
  assert(/touch-action:\s*none/.test(s) && /-webkit-touch-callout:\s*none/.test(s), f + ': iOS keeps the touch (no pan/callout)');
}
console.log('long-press ok');
