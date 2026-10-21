// Run: node scripts/test-voice.js  (spoken-task splitting + capability detection)
const path = require('path'); const fs = require('fs'); const os = require('os'); const assert = require('assert');
(async () => {
const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'v-')), 'v.mjs'); fs.copyFileSync(path.join(__dirname, '../src/utils/voiceSplit.js'), f);
const V = await import(f);
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
t('single task', () => assert.deepEqual(V.splitSpokenTasks('buy milk'), ['Buy milk']));
t('"and then" / "next" / "then" split', () => assert.deepEqual(V.splitSpokenTasks('buy milk and then call mom next email Sam then walk the dog'), ['Buy milk', 'Call mom', 'Email Sam', 'Walk the dog']));
t('"next week" / "next Friday" kept', () => assert.deepEqual(V.splitSpokenTasks('plan trip next week and then dentist next Friday'), ['Plan trip next week', 'Dentist next Friday']));
t('fillers and punctuation', () => assert.deepEqual(V.splitSpokenTasks('um so pay rent. and also, book flights;'), ['Pay rent', 'Book flights']));
t('empty / noise', () => { assert.deepEqual(V.splitSpokenTasks(''), []); assert.deepEqual(V.splitSpokenTasks(' and then  next '), []); });
t('capability', () => {
  assert.equal(V.voiceCapability({}, {}), 'none');
  assert.equal(V.voiceCapability({ webkitSpeechRecognition: 1 }, { userAgent: 'Mozilla/5.0 (Windows) Chrome/120 Safari/537' }), 'full');
  assert.equal(V.voiceCapability({ webkitSpeechRecognition: 1 }, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17 Mobile Safari/604' }), 'partial');
});
t('undo window is 5 s', () => assert.equal(V.UNDO_MS, 5000));
console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
