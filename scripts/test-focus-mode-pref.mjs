// Focus Mode preference: missing means on, and both off and on are saved on users/{uid}.focusMode.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { focusModeFromDoc, readFocusMode, saveFocusMode, FOCUS_MODE_FIELD } from '../src/utils/focusModePref.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

assert.equal(focusModeFromDoc(undefined), true, 'no profile means on');
assert.equal(focusModeFromDoc({}), true, 'a profile with no focusMode field means on');
assert.equal(focusModeFromDoc({ focusMode: true }), true);
assert.equal(focusModeFromDoc({ focusMode: false }), false);
assert.equal(readFocusMode(mem(), 'u1'), true, 'an empty cache means on');

const store = mem();
const writes = [];
const write = async (uid, fields) => { writes.push({ uid, fields }); };
assert.equal(await saveFocusMode({ store, uid: 'u1', on: false, write }), false);
assert.deepEqual(writes[0], { uid: 'u1', fields: { [FOCUS_MODE_FIELD]: false } });
assert.equal(readFocusMode(store, 'u1'), false);

assert.equal(await saveFocusMode({ store, uid: 'u1', on: true, write }), true);
assert.deepEqual(writes[1], { uid: 'u1', fields: { [FOCUS_MODE_FIELD]: true } });
assert.equal(readFocusMode(store, 'u1'), true);

const other = mem();
assert.equal(readFocusMode(other, 'u1'), true, 'another session starts on until the profile loads');
assert.equal(focusModeFromDoc({ focusMode: false }), false, 'the saved profile turns it off on the next session');

const home = readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../src/views/Profile.vue', import.meta.url), 'utf8');
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
assert.match(home, /const openFocus = !opts\.lock && !!focusModeOn\.value/);
assert.match(home, /if \(openFocus\) focusScreenKey\.value = taskKey\(task\)/);
assert.match(home, /focusModeOn\.value \|\| !confirmStartOn/);
assert.match(profile, /data-test="focus-mode-row"/);
assert.match(profile, /Focus Mode/);
assert.match(profile, /saveFocusMode\(/);
assert.match(profile, /focusModeFromDoc\(d\)/);
assert.doesNotMatch(rules, /focusMode/, 'users/{uid} owner updates already allow a non-billing boolean; no rules change');
console.log('focus mode pref: missing is on, off saves false, on saves true, profile reloads');
