// Pre-start time confirm: spoken line with the task name, Start / Skip / adjust, "Don't ask again" per user + the Settings toggle.
// Run: node scripts/test-start-confirm.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../src/utils/startConfirm.js', import.meta.url), 'utf8').replace(/^import .*$/m, 'const ClingVoice = {}; const nativeVoiceAvailable = () => false;');
const m = await import('data:text/javascript,' + encodeURIComponent(src));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const mem = () => { const d = {}; return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); } }; };
t('spoken line names the task + minutes', () => assert.equal(m.confirmLine('car inspection', 20), 'Hey, are you sure you can finish car inspection in 20 minutes? Going over costs points.'));
t('on by default; "Don\'t ask again" is per user; Settings turns it back on', () => { const s = mem();
  assert.equal(m.confirmStartOn(s, 'u1'), true); m.setConfirmStart(s, 'u1', false); assert.equal(m.confirmStartOn(s, 'u1'), false); assert.equal(m.confirmStartOn(s, 'u2'), true);
  m.setConfirmStart(s, 'u1', true); assert.equal(m.confirmStartOn(s, 'u1'), true); });
t('adjust clamps 5..600', () => { assert.equal(m.adjustMinutes(20, 5), 25); assert.equal(m.adjustMinutes(5, -5), 5); assert.equal(m.adjustMinutes(600, 5), 600); });
t('wiring: play asks unless off, Skip = current time, Start = adjusted, speech stopped; Settings row', () => {
  const h = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
  assert.match(h, /if \(!confirmStartOn\(localStorage, userId\.value\)\) return launchTimer\(index, mins\);/);
  assert.match(h, /speakConfirm\(confirmLine\(t\.title, mins\)\)/); assert.match(h, /stopConfirm\(\); startConfirm\.value = null;\n  if \(c\.dontAsk\) setConfirmStart\(localStorage, userId\.value, false\);/);
  assert.match(h, /launchTimer\(c\.index, useAdjusted \? c\.minutes : c\.base\)/); assert.match(h, /@skip="finishStartConfirm\(false\)"/);
  const sh = fs.readFileSync(new URL('../src/components/home/StartConfirmSheet.vue', import.meta.url), 'utf8'); assert.match(sh, /Don't ask again/); assert.match(sh, /start-confirm-skip/);
  const p = fs.readFileSync(new URL('../src/views/Profile.vue', import.meta.url), 'utf8'); assert.match(p, /Confirm time before starting/); assert.match(p, /onConfirmStart\(\$event\.target\.checked\)/); });
console.log(`${n} start-confirm tests passed`);
