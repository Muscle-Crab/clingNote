// Run: node scripts/test-intent-drain.mjs  (central Siri "Add task" drain: single-flight, no duplicates, drains from any route)
import fs from 'fs'; import os from 'os'; import path from 'path'; import assert from 'assert'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idrain-'));
fs.copyFileSync(path.join(here, '../src/utils/intentQueue.js'), path.join(dir, 'intentQueue.mjs'));
fs.writeFileSync(path.join(dir, 'intentDrain.mjs'), fs.readFileSync(path.join(here, '../src/native/intentDrain.js'), 'utf8').replace("'@/utils/intentQueue'", "'./intentQueue.mjs'"));
const D = await import(path.join(dir, 'intentDrain.mjs')); const Q = await import(path.join(dir, 'intentQueue.mjs'));
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const nativeQ = (items) => { let q = [...items]; return { push: (x) => q.push(x), take: async () => { const r = q; q = []; await new Promise((s) => setTimeout(s, 5)); return { items: r } } }; };

await t('pull without a saver keeps items in the buffer (nothing lost off Home)', async () => {
  const store = mem(); const nq = nativeQ([{ title: 'Buy milk', ts: 1 }]);
  assert.strictEqual(await D.runIntentDrain({ take: nq.take, store }), 1);
  assert.strictEqual(Q.readBuffer(store).length, 1);
});
await t('concurrent triggers (resume + appStateChange + visibility) save each task exactly once', async () => {
  const store = mem(); const nq = nativeQ([{ title: 'Call mom', ts: 2 }, { title: 'Gym', ts: 3, start: '18:00' }]); const saved = [];
  const off = D.registerIntentHandler(async () => { const b = Q.readBuffer(store); for (const it of b) { await new Promise((s) => setTimeout(s, 3)); saved.push(it.title); } Q.writeBuffer(store, []); });
  await Promise.all([D.runIntentDrain({ take: nq.take, store }, 'resume'), D.runIntentDrain({ take: nq.take, store }, 'active'), D.runIntentDrain({ take: nq.take, store }, 'home')]);
  assert.deepStrictEqual(saved, ['Call mom', 'Gym']); assert.strictEqual(Q.readBuffer(store).length, 0); off();
});
await t('a task queued while a drain is saving is picked up by the coalesced rerun, not lost', async () => {
  const store = mem(); const nq = nativeQ([{ title: 'A', ts: 4 }]); const saved = [];
  const off = D.registerIntentHandler(async () => { const b = Q.readBuffer(store); saved.push(...b.map((x) => x.title)); if (b[0] && b[0].title === 'A') { nq.push({ title: 'B', ts: 5 }); D.runIntentDrain({ take: nq.take, store }); } Q.writeBuffer(store, []); });
  await D.runIntentDrain({ take: nq.take, store }); await new Promise((s) => setTimeout(s, 30));
  assert.deepStrictEqual(saved, ['A', 'B']); off();
});
await t('same native item delivered twice is deduped', async () => {
  const store = mem(); const nq = nativeQ([{ title: 'X', ts: 9 }, { title: 'X', ts: 9 }]);
  await D.runIntentDrain({ take: nq.take, store }); await D.runIntentDrain({ take: async () => ({ items: [{ title: 'X', ts: 9 }] }), store });
  assert.strictEqual(Q.readBuffer(store).length, 1);
});
await t('shouldOpenHome: only with waiting tasks, signed in, Home not mounted, not mid auth/paywall', () => {
  assert.ok(D.shouldOpenHome({ pending: 1, hasHandler: false, signedIn: true, path: '/upcoming' }));
  assert.ok(!D.shouldOpenHome({ pending: 0, hasHandler: false, signedIn: true, path: '/upcoming' }));
  assert.ok(!D.shouldOpenHome({ pending: 1, hasHandler: true, signedIn: true, path: '/home' }));
  assert.ok(!D.shouldOpenHome({ pending: 1, hasHandler: false, signedIn: false, path: '/login' }));
  for (const p of ['/login', '/onboarding', '/paywall', '/gate']) assert.ok(!D.shouldOpenHome({ pending: 1, hasHandler: false, signedIn: true, path: p }), p);
});
await t('installIntentDrain wires appStateChange(isActive), resume and sign-in; opens Home from another route', async () => {
  const L = {}; const pushed = []; const store = mem(); let authCb;
  const kick = D.installIntentDrain({ CapApp: { addListener: (e, f) => { L[e] = f; } }, router: { currentRoute: { value: { path: '/community' } }, push: async (p) => pushed.push(p) },
    store, take: async () => ({ items: [{ title: 'From Siri', ts: 11 }] }), signedIn: () => true, onSignedIn: (cb) => { authCb = cb; } });
  assert.ok(L.appStateChange && L.resume && authCb);
  await kick('active'); assert.deepStrictEqual(pushed, ['/home']);
  L.appStateChange({ isActive: false }); await new Promise((s) => setTimeout(s, 20)); assert.strictEqual(pushed.length, 1);
});
await t('wiring: Swift intent opens the app; HomeView saves via the central drain only; main.js installs it', () => {
  const sw = fs.readFileSync(path.join(here, '../ios/App/App/ClingIntents.swift'), 'utf8');
  assert.ok(/struct AddTaskIntent[\s\S]*?openAppWhenRun: Bool = true/.test(sw));
  const hv = fs.readFileSync(path.join(here, '../src/views/HomeView.vue'), 'utf8');
  assert.ok(hv.includes('registerIntentHandler(saveBufferedIntents)') && !hv.includes('clingNative.takeIntents()'));
  assert.ok(fs.readFileSync(path.join(here, '../src/main.js'), 'utf8').includes('installIntentDrain('));
});
console.log(`\n${n} intent-drain tests passed`);
