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

// Tap stop while the permission prompt is up: nothing is left listening, no orphan listeners.
{ let rp; const L2 = {}; let started = 0; const p2 = { ...plugin, requestRecognitionPermission: () => new Promise((r) => { rp = r; }), startListening: async () => { started++; },
    addListener: async (nm, cb) => { L2[nm] = cb; return { remove() { delete L2[nm]; } }; } };
  const r = createDictation({ native: true, plugin: p2 }); const pr = r.toggle('', () => {}); await tick(); r.toggle('', () => {});
  rp({ granted: true }); await pr; await tick(); assert(!r.listening.value && started === 0 && !Object.keys(L2).length, 'stop during permission'); }

// Wiring: mic is the standalone FAB again (voice-to-create); the field has no mic.
const m = readFileSync('src/components/home/AddTaskModal.vue', 'utf8');
assert(!/nt-mic|createDictation/.test(m), 'no mic inside the task-name box (restored standalone mic FAB instead)');
const fab = readFileSync('src/components/home/FabButtons.vue', 'utf8'); const hv = readFileSync('src/views/HomeView.vue', 'utf8');
assert(/v-if="showVoice" @click="\$emit\('voice'\)" class="fab fab-voice"/.test(fab), 'standalone mic FAB restored');
assert(/<FabButtons[^>]*@voice="startVoiceInput"/.test(hv), 'mic FAB starts voice-to-create');
const sw = readFileSync('ios/App/App/ClingVoicePlugin.swift', 'utf8');
assert(/gen == self\.listenGen/.test(sw) && /teardown\(\) \{\n\s*listenGen \+= 1/.test(sw), 'stale recognition callbacks cannot kill a new session');
const src = readFileSync('src/composables/useDictation.js', 'utf8');
assert(!/fetch\(|netlify|parse|agent|addTask|emit/i.test(src.replace(/^\/\/.*$/gm, '')), 'dictation does nothing but fill text');
console.log('ok   dictation (task-name mic)');
