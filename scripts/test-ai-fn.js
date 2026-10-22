// Tests netlify/functions/ai.js with mocked token verification, Firestore and fetch.
const assert = require('assert');
const { handler } = require('../netlify/functions/ai');
const { buildRequest } = require('../netlify/functions/lib/aiPrompts');
process.env.OPENAI_API_KEY = 'test-key-not-real';
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };

const mkDb = (credits = 5, pro = { isPro: true, plan: 'yearly' }) => {
  const state = { credits };
  return { state, doc: () => ({ get: async () => ({ exists: true, data: () => ({ ...pro, credits: state.credits }) }) }), runTransaction: async (fn) => fn({ get: async () => ({ exists: true, data: () => ({ credits: state.credits }) }), update: (_r, d) => { state.credits = d.credits; } }) };
};
const mkFetch = (okRes = true) => { const calls = []; const f = async (url, opts) => { calls.push({ url, opts }); return { ok: okRes, json: async () => ({ choices: [{ message: { content: '{"a":1}' } }] }) }; }; f.calls = calls; return f; };
const verify = async (t) => { if (t !== 'good') throw new Error('bad'); return { uid: 'u1' }; };
const ev = (body, token = 'good') => ({ httpMethod: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) });
const IMG = 'A'.repeat(200);

(async () => {
  ok((await handler({ httpMethod: 'GET', headers: {} }, {}, {})).statusCode === 405, 'GET rejected');
  ok((await handler(ev({ task: 'workout' }, null), {}, { verify, db: mkDb() })).statusCode === 401, 'no token');
  ok((await handler(ev({ task: 'workout' }, 'bad'), {}, { verify, db: mkDb() })).statusCode === 401, 'bad token');
  ok((await handler(ev({ task: 'chat', input: {} }), {}, { verify, fetch: mkFetch(), db: mkDb() })).statusCode === 400, 'unknown task');

  let f = mkFetch(); let r = await handler(ev({ task: 'workout', input: { daysPerWeek: 99, maxPerDay: 3, goal: 'x`y' } }), {}, { verify, fetch: f, db: mkDb() });
  ok(r.statusCode === 200 && JSON.parse(r.body).content === '{"a":1}', 'workout ok');
  ok(f.calls[0].url === 'https://api.openai.com/v1/chat/completions', 'calls OpenAI');
  ok(f.calls[0].opts.headers.Authorization === 'Bearer test-key-not-real', 'uses server env key');
  const sent = JSON.parse(f.calls[0].opts.body); ok(sent.messages[0].content.includes('7-day'), 'days clamped'); ok(!sent.messages[0].content.includes('`y'), 'backticks stripped');
  ok(!r.body.includes('test-key'), 'key never in response');

  let db = mkDb(3); f = mkFetch(); r = await handler(ev({ task: 'meal-image', input: { imageBase64: IMG } }), {}, { verify, fetch: f, db });
  ok(r.statusCode === 200 && db.state.credits === 2 && JSON.parse(r.body).creditsLeft === 2, 'image deducts 1 credit');
  db = mkDb(0); f = mkFetch(); r = await handler(ev({ task: 'meal-image', input: { imageBase64: IMG } }), {}, { verify, fetch: f, db });
  ok(r.statusCode === 402 && f.calls.length === 0, 'no credits -> 402, no OpenAI call');
  db = mkDb(1); r = await handler(ev({ task: 'meal-image', input: { imageBase64: IMG } }), {}, { verify, fetch: mkFetch(false), db });
  ok(r.statusCode === 502 && db.state.credits === 1, 'OpenAI failure refunds credit');
  ok((await handler(ev({ task: 'meal-image', input: { imageBase64: 'not base64!!' } }), {}, { verify, fetch: mkFetch(), db: mkDb(5) })).statusCode === 400, 'bad image');
  ok((await handler(ev({ task: 'meal-text', input: { food: '' } }), {}, { verify, fetch: mkFetch(), db: mkDb() })).statusCode === 400, 'empty food');
  ok(buildRequest('meal-text', { food: 'x'.repeat(999) }).body.messages[0].content.length < 400, 'food capped');
  // server-side Pro enforcement
  f = mkFetch(); r = await handler(ev({ task: 'workout' }), {}, { verify, fetch: f, db: mkDb(5, { isPro: false, plan: 'free' }) });
  ok(r.statusCode === 402 && f.calls.length === 0, 'free user -> 402, no OpenAI call');
  f = mkFetch(); r = await handler(ev({ task: 'workout' }), {}, { verify, fetch: f, db: mkDb(5, { isPro: true, plan: 'monthly', proExpiresAt: new Date(Date.now() - 1000) }) });
  ok(r.statusCode === 402, 'expired Pro -> 402');
  r = await handler(ev({ task: 'workout' }), {}, { verify, fetch: mkFetch(), db: mkDb(5, { isPro: true, plan: 'lifetime', proExpiresAt: new Date(0) }) });
  ok(r.statusCode === 200, 'lifetime never expires');
  r = await handler(ev({ task: 'workout' }), {}, { verify, fetch: mkFetch(), db: mkDb(5, { isPro: 'true', plan: 'yearly' }) });
  ok(r.statusCode === 402, 'non-boolean isPro rejected');
  delete process.env.OPENAI_API_KEY;
  ok((await handler(ev({ task: 'workout' }), {}, { verify, fetch: mkFetch(), db: mkDb() })).statusCode === 500, 'missing env -> 500');
  console.log(`test-ai-fn: ${pass} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
