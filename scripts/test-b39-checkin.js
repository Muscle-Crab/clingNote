// B39 mood check-in: pure helpers, Start Day wiring (no new box), owner-only rule text. Run: node scripts/test-b39-checkin.js
// (Rule behaviour is checked against the emulator by scripts/emu-b39-checkin.test.mjs.)
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const { load } = require('./lib/srcRequire');
const C = load('utils/checkin.js');
const rd = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let n = 0; const t = (name, f) => { f(); n++; console.log('ok', name); };
t('5 moods, 3 energy levels', () => { assert.strictEqual(C.MOODS.length, 5); assert.deepStrictEqual(C.ENERGY.map((e) => e.v), ['low', 'med', 'high']); });
t('patch: one tap each, validated', () => {
  assert.deepStrictEqual(C.checkinPatch({}, 'mood', 4, '2026-10-30'), { mood: 4, date: '2026-10-30' });
  assert.deepStrictEqual(C.checkinPatch({ mood: 4 }, 'energy', 'high', '2026-10-30'), { energy: 'high', date: '2026-10-30' });
  assert.strictEqual(C.checkinPatch({ mood: 4 }, 'mood', 4, '2026-10-30'), null);
  [0, 6, 2.5, '3'].forEach((v) => assert.strictEqual(C.checkinPatch({}, 'mood', v, '2026-10-30'), null));
  assert.strictEqual(C.checkinPatch({}, 'energy', 'max', '2026-10-30'), null);
  assert.strictEqual(C.checkinPatch({}, 'mood', 3, 'today'), null);
  assert.strictEqual(C.checkinPatch({}, 'note', 'x', '2026-10-30'), null);
});
t('path + clean', () => {
  assert.deepStrictEqual(C.checkinPath('u1', '2026-10-30'), ['users', 'u1', 'dailyCheckins', '2026-10-30']);
  assert.strictEqual(C.checkinPath('', '2026-10-30'), null); assert.strictEqual(C.checkinPath('u1', '2026/10/30'), null);
  assert.deepStrictEqual(C.cleanCheckin({ mood: 9, energy: 'med', x: 1 }), { energy: 'med' });
  assert.strictEqual(C.moodEmoji(5), '😄'); assert.strictEqual(C.moodEmoji(0), '');
});
t('rendered inside the existing Start Day UI via a slot (both entry points), no new card', () => {
  const home = rd('src/views/HomeView.vue');
  assert.strictEqual((home.match(/<template #checkin><CheckinRow :value="checkin" @pick="saveCheckin" \/><\/template>/g) || []).length, 2);
  assert.ok(/<slot name="checkin" \/>\s*<button type="button" class="dsp-btn dsp-btn--primary" data-test="day-prompt-next"/.test(rd('src/components/eighthour/DayStartPrompt.vue')));
  assert.ok(rd('src/components/home/StartDayPrompt.vue').includes('<slot name="checkin" />'));
  const row = rd('src/components/home/CheckinRow.vue');
  assert.ok(!/(border|background)\s*:\s*(?!none)[^;]*;/.test(row.split('<style')[1].replace(/\.ci-mood[^}]*}/, '').replace(/\.ci-en[^}]*}/, '')), 'row has no box styling');
  assert.ok(home.includes("setDoc(doc(db, ...path), { ...patch, at: serverTimestamp() }, { merge: true })"));
});
t('firestore.rules: owner-only dailyCheckins with field checks, before the default deny', () => {
  const r = rd('firestore.rules');
  const i = r.indexOf('match /users/{userId}/dailyCheckins/{date}'); const deny = r.indexOf('// Default deny all other collections');
  assert.ok(i > 0 && i < deny);
  const block = r.slice(i, r.indexOf('\n    }', i));
  assert.ok(block.includes('allow read, delete: if isOwner(userId);'));
  assert.ok(block.includes('allow create, update: if isOwner(userId)'));
  ["hasOnly(['mood', 'energy', 'date', 'at'])", 'mood <= 5', "['low', 'med', 'high']", 'request.resource.data.date == date'].forEach((s) => assert.ok(block.includes(s), s));
  assert.ok(!/allow [^;]*if true/.test(block));
});
console.log(`test-b39-checkin: ${n} passed`);
