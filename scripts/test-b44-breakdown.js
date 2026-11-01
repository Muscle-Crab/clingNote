// B44: AI task breakdown completion. The live ai function has no key, so every model call here is a mocked fetch.
// Covers: no-key -> calm message, full mocked round trip (ai handler -> scoreSteps -> appendSteps), stale-list safe confirm.
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const sr = require('./lib/srcRequire'); const { handler } = require('../netlify/functions/ai');
const bd = sr.load('utils/breakdown.js');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok -', m); };
const verify = async (t) => { if (t !== 'good') throw new Error('bad'); return { uid: 'ZZTEST_u1' }; };
const mkDb = () => { const st = { ask: 0 }; return { st, doc: () => ({ get: async () => ({ exists: true, data: () => ({ plan: 'free' }) }) }),
  runTransaction: async (fn) => fn({ get: async () => ({ exists: true, data: () => ({ ask: st.ask }) }), set: (_r, d) => { if ('ask' in d) st.ask = d.ask; }, update: () => {} }) }; };
const ev = (body) => ({ httpMethod: 'POST', headers: { authorization: 'Bearer good' }, body: JSON.stringify(body) });
const mockFetch = (content) => { const f = async () => { f.calls++; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) }; }; f.calls = 0; return f; };
(async () => {
  const saved = { o: process.env.OPENAI_API_KEY, g: process.env.GEMINI_API_KEY }; delete process.env.OPENAI_API_KEY; delete process.env.GEMINI_API_KEY;
  const f0 = mockFetch('{}'); const r0 = await handler(ev({ task: 'breakdown', input: { title: 'ZZTEST taxes' } }), {}, { verify, db: mkDb(), fetch: f0 });
  ok(r0.statusCode === 500 && f0.calls === 0, 'live state (no key): 500, no model call');
  const msg = bd.breakdownError({ status: r0.statusCode, message: JSON.parse(r0.body).error });
  ok(/isn't available/.test(msg) && !/configured|500/.test(msg), 'no-key -> calm "AI isn\'t available", no server text');
  process.env.OPENAI_API_KEY = 'mock-not-real';
  const f = mockFetch(JSON.stringify({ steps: [{ title: 'Find last year\'s return', minutes: 5 }, { title: 'Gather W-2s', minutes: 10 }, { title: 'Open tax software', minutes: 3 }] }));
  const r = await handler(ev({ task: 'breakdown', input: { title: 'ZZTEST taxes' } }), {}, { verify, db: mkDb(), fetch: f });
  const steps = bd.scoreSteps(JSON.parse(r.body).steps, 'ZZTEST taxes');
  ok(r.statusCode === 200 && f.calls === 1 && steps.length === 3 && steps.every((s) => s.points > 0), 'mocked round trip -> 3 scored steps');
  const subs = bd.appendSteps([], steps); ok(subs.length === 3 && subs.every((s) => s.done === false && s.id), 'appended as open subtasks');
  delete process.env.OPENAI_API_KEY; if (saved.o !== undefined) process.env.OPENAI_API_KEY = saved.o; if (saved.g !== undefined) process.env.GEMINI_API_KEY = saved.g;
  // stale list while the sheet was open
  const t = { id: 'ZZTEST_t1', title: 'ZZTEST taxes', createdAt: 'c1' }; const fresh = [{ id: 'x', title: 'other' }, { ...t, notes: 'reloaded' }];
  ok(bd.findTaskIndex([t], t) === 0, 'same object -> index');
  ok(bd.findTaskIndex(fresh, t) === 1, 're-read list -> found by id');
  ok(bd.findTaskIndex([{ title: 'ZZTEST taxes', createdAt: 'c1' }], { title: 'ZZTEST taxes', createdAt: 'c1' }) === 0, 'no id -> createdAt+title');
  ok(bd.findTaskIndex([{ id: 'x' }], t) === -1 && bd.findTaskIndex(null, t) === -1, 'deleted meanwhile -> -1');
  const home = fs.readFileSync(path.join(__dirname, '../src/views/HomeView.vue'), 'utf8');
  ok(/findTaskIndex\(selectedDayRoutine\.value, task\)/.test(home) && /Steps not added/.test(home), 'confirm re-finds the task, tells the user if it is gone');
  console.log(`\n${n} b44 breakdown tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
