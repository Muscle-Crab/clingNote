// B44 lock-screen focus timer gap: pomodoro preset (25/5 ×4) with the phase on the Live Activity. Run: node scripts/test-b44-pomodoro.mjs
import fs from 'fs'; import path from 'path'; import assert from 'assert'; import { fileURLToPath } from 'url';
import { POMO, startPomoPatch, nextPomoPatch, pomoLabel, isPomo, pomoTotalMinutes } from '../src/utils/pomodoro.js';
import { focusActivityState, focusContentSig } from '../src/utils/focusActions.js';
const here = path.dirname(fileURLToPath(import.meta.url)); const rd = (p) => fs.readFileSync(path.join(here, '..', p), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const NOW = Date.UTC(2026, 9, 30, 14, 0, 0); const M = 60000;
const task = () => ({ id: 'ZZTEST_p', title: 'ZZTEST deep work', timerActive: true, ...startPomoPatch(NOW) });

t('start: 25 min focus round 1/4', () => {
  const x = task(); assert.ok(isPomo(x)); assert.strictEqual(Date.parse(x.timerEndTime), NOW + 25 * M); assert.strictEqual(pomoLabel(x), 'Focus 1/4');
  assert.strictEqual(pomoTotalMinutes(), 115); assert.deepStrictEqual(POMO, { work: 25, brk: 5, rounds: 4 });
});
t('cycles focus -> break -> focus back-to-back; ends after round 4 focus', () => {
  let x = task(); const seen = [];
  for (;;) { const p = nextPomoPatch(x, Date.parse(x.timerEndTime)); if (!p) break; x = { ...x, ...p }; seen.push(pomoLabel(x)); assert.strictEqual(Date.parse(x.timerEndTime) - Date.parse(x.timerStartedAt), (x.timerPomo.phase === 'work' ? 25 : 5) * M); }
  assert.deepStrictEqual(seen, ['Break 1/4', 'Focus 2/4', 'Break 2/4', 'Focus 3/4', 'Break 3/4', 'Focus 4/4']);
  assert.strictEqual(Date.parse(x.timerEndTime), NOW + 115 * M);
});
t('phases missed while the app was closed are skipped, not restarted', () => {
  const p = nextPomoPatch(task(), NOW + 33 * M); assert.strictEqual(pomoLabel({ timerPomo: p.timerPomo }), 'Focus 2/4'); assert.strictEqual(Date.parse(p.timerEndTime), NOW + 55 * M);
  assert.strictEqual(nextPomoPatch(task(), NOW + 200 * M), null, 'whole session over');
});
t('plain timer is untouched', () => { assert.strictEqual(nextPomoPatch({ timerActive: true, timerEndTime: new Date(NOW).toISOString() }, NOW), null); assert.strictEqual(pomoLabel({}), ''); });
t('Live Activity state carries the phase; content sig changes per phase', () => {
  const a = focusActivityState(task(), { now: NOW }); assert.strictEqual(a.phase, 'Focus 1/4');
  const b = focusActivityState({ ...task(), ...nextPomoPatch(task(), NOW + 25 * M) }, { now: NOW + 25 * M }); assert.strictEqual(b.phase, 'Break 1/4');
  assert.notStrictEqual(focusContentSig(a), focusContentSig(b));
  assert.ok(!('phase' in focusActivityState({ title: 'x', timerActive: true, timerEndTime: new Date(NOW + M).toISOString() }, { now: NOW })));
});
t('wiring: 🍅 in the existing ⋯ menu, watcher advances phases, copies drop it, Swift shows the phase', () => {
  const card = rd('src/components/home/TaskCard.vue'); const menu = card.slice(card.indexOf('class="task-actions"'), card.indexOf('class="move-row"'));
  assert.match(menu, /data-test="pomodoro-btn"/); assert.match(card, /defineEmits\(\['breakdown', 'pomodoro'/);
  const h = rd('src/views/HomeView.vue'); assert.strictEqual((h.match(/@pomodoro="startPomodoro\(realIndex\(task\)\)"/g) || []).length, 2); assert.match(h, /startTimer\(\{ pomo: true \}\)/); assert.match(h, /nextPomoPatch\(task, Date\.now\(\)\)/); assert.match(h, /timerLockedMin, timerPomo, boss/);
  assert.match(rd('ios/App/Shared/FocusActivityAttributes.swift'), /var phase: String\? = nil/);
  assert.match(rd('ios/App/App/ClingNativePlugin.swift'), /phase: \(call\.getString\("phase"\)/);
  assert.match(rd('ios/App/ClingNoteWidget/FocusLiveActivity.swift'), /state\.phase \?\? "Focus"/);
});
console.log(`\n${n} b44 pomodoro tests passed`);
