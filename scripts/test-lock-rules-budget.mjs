// Static guard for the locked-day rule (full emulator proof: scripts/emu-lock-capacity.test.mjs). The old rule compared all 50 slots and re-read
// eightHour/{uid} many times; with ~11+ tasks it hit Firestore's 1000-expression limit and EVERY locked-day write (complete, timer) was denied,
// so the app reverted each change. Keep: one lock read, size-gated 10-slot blocks covering slots 0..49 exactly once.
import assert from 'assert';
import fs from 'fs';
const r = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
assert.ok(!/eightHourLocked|eightHourShut|lockedSlotSame/.test(r), 'old per-call lock helpers / 50-slot chain are back');
const lockFn = r.slice(r.indexOf('function eightHourLock('), r.indexOf('function dayFrozen('));
assert.equal((lockFn.match(/get\(eightHourPath/g) || []).length, 1, 'eightHourLock must read the lock doc once');
const routines = r.slice(r.indexOf('match /weeklyRoutines/'), r.indexOf('}', r.indexOf('allow delete', r.indexOf('match /weeklyRoutines/'))));
assert.equal((routines.match(/dayFrozen\(eightHourLock\(/g) || []).length, 2, 'create and delete still check dayFrozen once; updates stay allowed so a move is not denied');
const seen = new Map();
for (let c = 0; c < 5; c++) {
  const m = r.match(new RegExp(`function lockedSlots${c}\\(o, n, k\\) \\{\\s*return k <= ${c * 10} \\|\\| \\(k >= ${c * 10 + 10} \\? \\(([^]*?)\\) : \\(([^]*?)\\)\\);`));
  assert.ok(m, `lockedSlots${c} must be gated by k <= ${c * 10} and have a full-block fast path`);
  const full = [...m[1].matchAll(/n\[(\d+)\]\.diff\(o\[\1\]\)\.affectedKeys\(\)\.hasAny\(\['createdAt', 'points'\]\)/g)].map((x) => +x[1]);
  const part = [...m[2].matchAll(/n\[(\d+)\]\.diff\(o\[\1\]\)/g)].map((x) => +x[1]);
  const want = [...Array(10)].map((_, i) => c * 10 + i);
  assert.deepEqual(full, want, `block ${c} full path covers its 10 slots`);
  assert.deepEqual(part, want, `block ${c} partial path covers its 10 slots`);
  for (let i = c * 10 + 1; i < c * 10 + 10; i++) assert.ok(m[2].includes(`(k <= ${i} || !n[${i}]`), `slot ${i} gated in the partial path`);
  want.forEach((i) => seen.set(i, true));
}
assert.equal(seen.size, 50);
assert.ok(/return n\.size\(\) >= o\.size\(\) && o\.size\(\) <= 50 && lockedSlots\(o, n, o\.size\(\)\)/.test(r), 'append-only + cap + slot check');
console.log('test-lock-rules-budget: ok');
