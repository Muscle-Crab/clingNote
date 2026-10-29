// Lock guide hardening (build 36): assistant closes before the guide, repeat calls don't reset it, loop stops on done:true, picker timeout never leaves busy stuck.
import assert from 'assert'; import { readFileSync } from 'fs';
import { withTimeout } from '../src/utils/appLockNames.js';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok -', m); };
const h = readFileSync('src/views/HomeView.vue', 'utf8'), g = readFileSync('src/components/home/LockGuideSheet.vue', 'utf8');
const fn = (name) => h.slice(h.indexOf(`const ${name} = `), h.indexOf('\nconst ', h.indexOf(`const ${name} = `) + 10));
const byName = fn('lockByName'), pick = fn('lockGuidePick');
ok(/if \(lockGuide\.value\.open\) return guideOpen\(/.test(byName) && byName.indexOf('lockGuide.value.open)') < byName.indexOf('lockGuide.value = '), 'repeat call returns before reassigning lockGuide');
ok(/open_app_picker'\) \{ askOpen\.value = false; lockGuide\.value =/.test(byName), 'open_app_picker closes assistant before opening guide');
ok(/'onboard'\) \{ askOpen\.value = false; lockGuide\.value =/.test(byName), 'onboard branch closes assistant before opening guide');
ok(byName.includes("onboarding: true, done: true") && byName.includes("note: 'Guide is open; do not call lock tools again this turn.'"), 'onboarding result carries done + note');
ok(/withTimeout\(clingLock\.requestAuthorization\(\), LOCK_PICK_TIMEOUT_MS\)/.test(pick) && /withTimeout\(clingLock\.pickNamedApps\(/.test(pick) && h.includes('LOCK_PICK_TIMEOUT_MS = 60000'), 'both native awaits have 60s timeout');
ok(/finally \{ lockGuide\.value = \{ \.\.\.lockGuide\.value, busy: false \}; \}/.test(pick) && pick.includes("Apple's app list didn't open. Try again."), 'busy reset in finally + timeout message');
ok(/class="btn-secondary" @click="\$emit\('close'\)">Not now/.test(g) && !/lockGuideClose = \(\) => \{ if \(!lockGuide\.value\.busy\)/.test(h), 'Not now stays enabled and closes while busy');
// behavior: timeout rejects with code, resolve passes through
await assert.rejects(withTimeout(new Promise(() => {}), 20), (e) => e.code === 'timeout'); ok(true, 'withTimeout rejects a hung promise');
ok((await withTimeout(Promise.resolve(7), 50)) === 7, 'withTimeout passes through results');
// simulate lockGuidePick's busy lifecycle with a hung picker
let state = { busy: false, error: '' };
const sim = async () => { state = { ...state, busy: true }; try { await withTimeout(new Promise(() => {}), 20); } catch (e) { state = { ...state, error: e.code === 'timeout' ? "Apple's app list didn't open. Try again." : 'x' }; } finally { state = { ...state, busy: false }; } };
await sim(); ok(state.busy === false && state.error.startsWith("Apple's"), 'timeout resets busy and shows error');
// assistant loop ends the turn on done:true
const { createRequire } = await import('module'); const { load } = createRequire(import.meta.url)('./lib/srcRequire');
const { runAgentTurn } = load('utils/assistantLoop.js'); const T = load('utils/assistantTools.js'); const b = T.buildContext({ tasks: [] });
let calls = 0; const out = await runAgentTurn({ text: 'lock tiktok', call: async () => { calls++; return { parts: [{ text: '' }], toolCalls: [{ name: 'open_app_picker', args: {} }] }; },
  executor: { snapshot: () => ({ refs: b.refs, context: b.context, tasksByKey: new Map(), today: '2026-10-29', limitRemaining: 5 }), run: async () => ({ onboarding: true, done: true, summary: 'Opened the app list guide.' }) }, confirm: async () => true });
ok(calls === 1 && out.reply === 'Opened the app list guide.', 'loop stops after a done:true tool result');
console.log(`${n} lock-guide tests passed`);
