// B39 feature 1: "Break it down" — server prompt/route (quota, validation, errors), client scoring + subtasks, UI wiring.
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const sr = require('./lib/srcRequire');
const { handler } = require('../netlify/functions/ai');
const { buildRequest, normalizeBreakdown } = require('../netlify/functions/lib/aiPrompts');
const bd = sr.load('utils/breakdown.js'); const est = sr.load('utils/taskEstimate.js');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

// prompt
const req = buildRequest('breakdown', { title: 'Clean the garage`', notes: 'it is a mess' });
ok(req.body.response_format && req.body.response_format.type === 'json_object', 'JSON mode');
ok(/3 to 6/.test(req.body.messages[0].content) && /minutes/.test(req.body.messages[0].content), 'prompt asks 3-6 steps with minutes');
ok(req.body.messages[1].content.includes('Clean the garage') && !req.body.messages[1].content.includes('`'), 'title clipped/sanitised');
assert.throws(() => buildRequest('breakdown', { title: '  ' }), /Empty task/); pass++;
// server-side validation
const n = normalizeBreakdown('```json\n{"steps":[{"title":"1. Open the door","minutes":3},{"title":"Pick up trash","minutes":"999"},{"title":"pick up trash","minutes":5},{"title":"","minutes":5},{"title":"Sweep floor"}]}\n```');
ok(n.length === 3 && n[0].title === 'Open the door' && n[1].minutes === 120 && n[2].minutes === 10, 'normalize: fences, numbering, dupes, clamps, defaults');
ok(normalizeBreakdown({ steps: Array.from({ length: 9 }, (_, i) => ({ title: 'Step ' + i, minutes: 5 })) }).length === 6, 'max 6');
assert.throws(() => normalizeBreakdown('not json'), (e) => e.status === 502); pass++;
assert.throws(() => normalizeBreakdown('{"steps":[{"title":"one"}]}'), (e) => e.status === 502); pass++;

// route
const mkDb = (pro = false, used = 0) => { const st = { ask: used }; return { st, doc: () => ({ get: async () => ({ exists: true, data: () => (pro ? { isPro: true, plan: 'yearly' } : { plan: 'free' }) }) }),
  runTransaction: async (fn) => fn({ get: async () => ({ exists: true, data: () => ({ ask: st.ask }) }), set: (_r, d) => { if ('ask' in d) st.ask = d.ask; }, update: () => {} }) }; };
const reply = (content, okRes = true) => { const f = async (url, opts) => { f.calls.push({ url, opts }); return { ok: okRes, status: okRes ? 200 : 500, json: async () => ({ choices: [{ message: { content } }] }) }; }; f.calls = []; return f; };
const verify = async (t) => { if (t !== 'good') throw new Error('bad'); return { uid: 'u1' }; };
const ev = (body, token = 'good') => ({ httpMethod: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) });
const GOOD = JSON.stringify({ steps: [{ title: 'Put on shoes', minutes: 2 }, { title: 'Walk to the garage', minutes: 3 }, { title: 'Fill one trash bag', minutes: 10 }] });
(async () => {
  const saved = { o: process.env.OPENAI_API_KEY, g: process.env.GEMINI_API_KEY };
  delete process.env.GEMINI_API_KEY; process.env.OPENAI_API_KEY = 'test-key-not-real';
  ok((await handler(ev({ task: 'breakdown', input: { title: 'x' } }, null), {}, { verify, db: mkDb() })).statusCode === 401, 'needs sign-in');
  let db = mkDb(); let f = reply(GOOD); let r = await handler(ev({ task: 'breakdown', input: { title: 'Clean garage' } }), {}, { verify, db, fetch: f });
  let b = JSON.parse(r.body); ok(r.statusCode === 200 && b.steps.length === 3 && b.steps[0].title === 'Put on shoes', 'free user OK (not Pro-gated)');
  ok(db.st.ask === 1 && b.remaining === 9, 'uses the free daily quota');
  ok(!r.body.includes('test-key'), 'key never in response');
  db = mkDb(); r = await handler(ev({ task: 'breakdown', input: { title: 'Clean garage' } }), {}, { verify, db, fetch: reply('garbage') });
  ok(r.statusCode === 502 && db.st.ask === 0 && !/garbage/.test(r.body), 'unusable reply -> 502, quota given back');
  db = mkDb(); r = await handler(ev({ task: 'breakdown', input: { title: 'Clean garage' } }), {}, { verify, db, fetch: reply(GOOD, false) });
  ok(r.statusCode === 502 && db.st.ask === 0, 'provider error -> 502, quota given back');
  db = mkDb(false, 10); f = reply(GOOD); r = await handler(ev({ task: 'breakdown', input: { title: 'Clean garage' } }), {}, { verify, db, fetch: f });
  ok(r.statusCode === 429 && f.calls.length === 0, 'limit reached -> 429, no model call');
  r = await handler(ev({ task: 'breakdown', input: { title: '' } }), {}, { verify, db: mkDb(), fetch: reply(GOOD) });
  ok(r.statusCode === 400, 'empty title -> 400');
  delete process.env.OPENAI_API_KEY;
  r = await handler(ev({ task: 'breakdown', input: { title: 'x' } }), {}, { verify, db: mkDb(), fetch: reply(GOOD) });
  ok(r.statusCode === 500, 'no keys -> 500 server not configured');
  if (saved.o !== undefined) process.env.OPENAI_API_KEY = saved.o; if (saved.g !== undefined) process.env.GEMINI_API_KEY = saved.g;

  // client scoring
  const s = bd.scoreSteps([{ title: 'Clean garage', minutes: 5 }, { title: '- Put on shoes', minutes: 2 }, { title: 'Fill one trash bag' }, 'Sweep the floor', null], 'Clean garage');
  ok(s.length === 3 && s[0].title === 'Put on shoes', 'drops parent-title repeat + junk, strips bullets');
  ok(s[0].minutes === 2 && s[0].points === est.estimateFor({ title: 'Put on shoes', estimateMin: 2 }).points, 'points via existing estimateFor');
  ok(s[1].minutes > 0 && s[1].points > 0, 'missing minutes -> estimator minutes');
  ok(bd.totals(s).minutes === s.reduce((a, x) => a + x.minutes, 0), 'totals');
  const existing = [{ id: 'a', title: 'Put on shoes', done: true }];
  const out = bd.appendSteps(existing, s);
  ok(out.length === 3 && out[0] === existing[0] && existing.length === 1, 'appends, keeps existing, no dupes, new array');
  ok(out[1].done === false && out[1].id && out[1].minutes && out[1].points, 'subtask shape {id,title,done,minutes,points}');
  ok(/allow/.test(bd.breakdownError({ status: 'consent-declined' })) && /limit/i.test(bd.breakdownError({ status: 429 })) && /Try again/.test(bd.breakdownError({ status: 502, message: 'AI request failed' })), 'friendly errors');
  ok(!/502|AI request failed/.test(bd.breakdownError({ status: 502, message: 'AI request failed' })), 'no raw server text');

  // wiring (inside the existing ⋯ menu; sheet only on demand)
  const card = read('src/components/home/TaskCard.vue'); const home = read('src/views/HomeView.vue'); const sheet = read('src/components/home/BreakdownSheet.vue');
  const menu = card.slice(card.indexOf('class="task-actions"'), card.indexOf('class="move-row"'));
  ok(menu.includes('data-test="breakdown-btn"') && /\$emit\('breakdown'\)/.test(menu), '🪄 in the existing ⋯ menu');
  ok(/defineEmits\(\['breakdown'/.test(card), 'emit declared');
  ok((home.match(/@breakdown="openBreakdown\(task\)"/g) || []).length === 2, 'both TaskCard usages wired');
  ok(/<BreakdownSheet v-if="bd.open"/.test(home), 'sheet only rendered when opened (no new block on Home)');
  ok(/askAi\('breakdown'/.test(home) && /onSubtaskPatch\(idx, (?:task|cur), \{ subtasks: appendSteps/.test(home), 'calls AI, saves via subtask patch');
  ok(/breakdown-retry/.test(sheet) && /breakdown-add/.test(sheet) && /:disabled="loading \|\| !chosen.length"/.test(sheet), 'preview, retry, confirm');
  console.log(`test-b39-breakdown: ${pass} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
