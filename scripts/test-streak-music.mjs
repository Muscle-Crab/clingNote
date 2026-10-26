// Streak music: escalating steps 1→5, a longer fanfare, all gated by the Sounds toggle.
import assert from 'assert';
import fs from 'fs';
const src = fs.readFileSync(new URL('../src/composables/useSounds.js', import.meta.url), 'utf8');
const mod = await import('data:text/javascript,' + encodeURIComponent(src.replace(/^import .*$/m, 'const ref=(v)=>({value:v}),watch=()=>{};')));
const { streakStepNotes, streakHitNotes } = mod;
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const end = (n) => Math.max(...n.map(([, s, d]) => s + d));
for (let s = 1; s < 5; s++) {
  const a = streakStepNotes(s), b = streakStepNotes(s + 1);
  ok(b.length > a.length && b[0][0] > a[0][0] && Math.max(...b.map((x) => x[0])) > Math.max(...a.map((x) => x[0])), `step ${s + 1} escalates over ${s}`);
  ok(a.every((x, i) => i === 0 || x[0] > a[i - 1][0]), `step ${s} rises`);
}
ok(end(streakStepNotes(5)) < 0.8, 'steps are short');
ok(end(streakHitNotes()) > 2 && end(streakHitNotes()) > 3 * end(streakStepNotes(5)), 'fanfare is longer');
ok(/if \(!soundEnabled\.value\) return;/.test(src.slice(src.indexOf('const playSound'))), 'respects Sounds toggle');
const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
ok(/playSound\('streakHit'\)/.test(home) && /playSound\('streakStep'/.test(home), 'wired on completion');
console.log(`test-streak-music: ${pass} passed`);
