// Regression: the task-name mic is bare speech-to-text (tap -> words fill the input -> tap again / pause stops). Guards against it silently disappearing.
import { readFileSync } from 'fs'; import assert from 'assert';
const { createDictation } = await import('../src/composables/useDictation.js');
const tick = () => new Promise((r) => setTimeout(r, 0));

// Web: SpeechRecognition fills the field, keeps existing text, stops on pause (continuous=false) and on second tap.
let inst; class FakeSR { constructor() { inst = this; } start() { this.started = true; } stop() { this.stopped = true; this.onend && this.onend(); } }
let val = 'Buy';
const w = createDictation({ native: false, WebSR: FakeSR });
assert.equal(w.supported, true);
await w.toggle(val, (t) => { val = t; });
assert(inst.started && w.listening.value && inst.continuous === false && inst.interimResults === true);
inst.onresult({ results: [[{ transcript: 'milk' }]] }); assert.equal(val, 'Buy milk');
inst.onresult({ results: [[{ transcript: 'milk' }], [{ transcript: ' and eggs' }]] }); assert.equal(val, 'Buy milk and eggs');
w.toggle(val, () => {}); assert(inst.stopped && !w.listening.value, 'second tap stops');
await w.toggle('', (t) => { val = t; }); inst.onend(); assert(!w.listening.value, 'pause ends it');
inst.onerror({ error: 'not-allowed' }); assert(/blocked/.test(w.error.value));
assert.equal(createDictation({ native: false, WebSR: null }).supported, false);

// Native (iOS ClingVoice): partials fill, isFinal (pause) stops, tap stops.
const L = {}; let stops = 0;
const plugin = { requestRecognitionPermission: async () => ({ granted: true }), startListening: async () => {}, stopListening: async () => { stops++; },
  addListener: async (n, cb) => { L[n] = cb; return { remove() { delete L[n]; } }; } };
const n = createDictation({ native: true, plugin }); let nv = '';
await n.toggle('', (t) => { nv = t; }); await tick();
assert(n.listening.value); L.partialResults({ matches: ['call mom'] }); assert.equal(nv, 'call mom');
L.partialResults({ matches: ['call mom tonight'], isFinal: true }); assert.equal(nv, 'call mom tonight'); assert(!n.listening.value && stops === 1, 'pause stops');
await n.toggle('', () => {}); await tick(); n.toggle('', () => {}); assert(!n.listening.value && stops === 2, 'tap stops');
const d = createDictation({ native: true, plugin: { ...plugin, requestRecognitionPermission: async () => ({ granted: false }) } });
await d.toggle('', () => {}); assert(!d.listening.value && /access is off/.test(d.error.value));

// Wiring: the mic sits in the Add task name field, fills newTask.title only. No AI / auto-create.
const m = readFileSync('src/components/home/AddTaskModal.vue', 'utf8');
assert(/data-test="nt-mic"[^>]*@click="dict\.toggle\(newTask\.title, \(t\) => \{ newTask\.title = t; \}\)"/.test(m), 'mic button wired to title');
const src = readFileSync('src/composables/useDictation.js', 'utf8');
assert(!/fetch\(|netlify|parse|agent|addTask|emit/i.test(src.replace(/^\/\/.*$/gm, '')), 'dictation does nothing but fill text');
console.log('ok   dictation (task-name mic)');
