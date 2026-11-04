// Voice-to-create: after Save succeeds the modal closes and its state clears; on a failed save it stays open with an error toast.
// Runs HomeView's real confirmVoiceItems with stubs. Regression: VoiceModal emits COPIES of its rows, so the old identity filter
// (voiceItems.filter(x => !done.includes(x))) never emptied the list and the modal stayed open.
import fs from 'fs'; import assert from 'assert';
const src = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
const a = src.indexOf('const confirmVoiceItems = async (items) => {'); const b = src.indexOf('\nconst relistenVoice', a);
assert.ok(a > 0 && b > a, 'confirmVoiceItems found');
const body = src.slice(a, b);
const run = async (saveOk) => {
  const r = (v) => ({ value: v }); const env = { toasts: [], closed: 0 };
  const voiceBusy = r(false), voiceError = r(''), voiceItems = r([{ type: 'task', title: 'Buy milk', date: 'Mon' }]), voiceAdded = r([]), newTask = r({}), capOverride = r(false), error = r('');
  const cancelVoiceInput = () => { env.closed++; voiceItems.value = []; voiceError.value = ''; };
  const fn = new Function('voiceBusy', 'voiceError', 'voiceItems', 'voiceAdded', 'newTask', 'capOverride', 'error', 'cancelVoiceInput', 'showNoteToast', 'addNewTask', 'saveReminder', 'scheduleLocal', 'blankTask', 'blankSchedule', 'deferredDateFor', 'getTodayId', 'lastAddPersistRef',
    body.replace('await lastAddPersist', 'await lastAddPersistRef') + '\nreturn confirmVoiceItems;')(voiceBusy, voiceError, voiceItems, voiceAdded, newTask, capOverride, error, cancelVoiceInput,
    (t, o) => env.toasts.push({ t, ...o }), async () => (saveOk ? 1 : (error.value = 'Daily limit reached', 0)), async () => ({ ok: true }), () => {}, () => ({}), () => ({}), () => null, () => 'Mon', true);
  await fn(voiceItems.value.map((x) => ({ ...x }))); // the modal emits copies
  return { env, voiceItems: voiceItems.value, voiceError: voiceError.value, added: voiceAdded.value.length };
};
let n = 0;
let s = await run(true); assert.ok(s.env.closed === 1 && s.voiceItems.length === 0 && !s.env.toasts.length && s.added === 1, 'save ok -> modal closed, state cleared'); n++;
s = await run(false); assert.ok(s.env.closed === 0 && s.voiceItems.length === 1 && s.voiceError && s.env.toasts[0].error, 'save failed -> stays open, item kept, error toast'); n++;
console.log(`voice confirm: ${n} passed`);
