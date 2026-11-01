// Tests the OpenAI tool-calling path for the assistant (lib/aiProvider.js callOpenAIAgent + ai.js routing) with mocked fetch.
const assert = require('assert');
const P = require('../netlify/functions/lib/aiProvider');
const agent = require('../netlify/functions/lib/agentTools');
const { handler } = require('../netlify/functions/ai');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const oa = (message, status = 200) => { const calls = []; const f = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body), headers: opts.headers }); return { ok: status < 300, status, json: async () => (status < 300 ? { choices: [{ message, finish_reason: 'stop' }] } : { error: { message: 'x' } }) }; }; f.calls = calls; return f; };
const walk = (s, fn) => { if (Array.isArray(s)) return s.forEach((x) => walk(x, fn)); if (s && typeof s === 'object') { fn(s); Object.values(s).forEach((v) => walk(v, fn)); } };
(async () => {
  const saved = { o: process.env.OPENAI_API_KEY, g: process.env.GEMINI_API_KEY, m: process.env.OPENAI_MODEL };
  process.env.OPENAI_API_KEY = 'sk-test-not-real'; process.env.GEMINI_API_KEY = 'gem-test-not-real'; delete process.env.OPENAI_MODEL;
  // schema conversion
  const s = P.toOpenAISchema({ type: 'OBJECT', properties: { p: { type: 'STRING', enum: ['', 'low', 'high'] }, q: { type: 'STRING', enum: [''] }, a: { type: 'ARRAY', items: { type: 'INTEGER' } } }, required: ['p'] });
  ok(s.type === 'object' && s.properties.p.type === 'string' && s.properties.a.items.type === 'integer', 'types lowercased');
  ok(s.properties.p.enum.join() === 'low,high' && !('enum' in s.properties.q), 'empty enum values dropped / empty enum removed');
  const tools = P.toOpenAITools([{ functionDeclarations: agent.DECLARATIONS }]);
  ok(tools.length === agent.DECLARATIONS.length && tools.every((t) => t.type === 'function' && t.function.parameters.type === 'object'), 'all declarations converted');
  walk(tools, (o) => { if (typeof o.type === 'string') ok(o.type === o.type.toLowerCase(), 'lowercase type'); if ('enum' in o) ok(o.enum.length && !o.enum.includes(''), 'non-empty enum'); });
  // contents conversion
  const msgs = P.toOpenAIMessages({ systemInstruction: { parts: [{ text: 'SYS' }] }, contents: [
    { role: 'user', parts: [{ text: 'add milk' }] },
    { role: 'model', parts: [{ text: 'ok', thought: true }, { functionCall: { name: 'create_tasks', args: { items: [{ title: 'Milk' }] } }, thoughtSignature: 'x' }] },
    { role: 'user', parts: [{ functionResponse: { name: 'create_tasks', response: { ok: true } } }] },
    { role: 'model', parts: [{ text: 'Added.' }] }, { role: 'user', parts: [{ text: 'thanks' }] }] });
  ok(msgs[0].role === 'system' && msgs[0].content === 'SYS' && msgs[1].role === 'user', 'system + user');
  ok(msgs[2].role === 'assistant' && msgs[2].content === null && msgs[2].tool_calls[0].function.name === 'create_tasks' && JSON.parse(msgs[2].tool_calls[0].function.arguments).items[0].title === 'Milk', 'functionCall -> tool_calls (thought dropped)');
  ok(msgs[3].role === 'tool' && msgs[3].tool_call_id === msgs[2].tool_calls[0].id && JSON.parse(msgs[3].content).ok === true, 'functionResponse -> tool msg with matching id');
  ok(msgs[4].role === 'assistant' && msgs[4].content === 'Added.' && msgs[5].content === 'thanks' && msgs.length === 6, 'text turns');
  const orphan = P.toOpenAIMessages({ contents: [{ role: 'model', parts: [{ functionCall: { name: 'a', args: {} } }] }, { role: 'user', parts: [{ text: 'hi' }] }] });
  ok(orphan[1].role === 'tool' && orphan[1].tool_call_id === orphan[0].tool_calls[0].id, 'unanswered tool_call gets placeholder');
  // response mapping
  let f = oa({ role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'create_tasks', arguments: '{"items":[{"title":"Milk"}]}' } }, { id: 'c2', type: 'function', function: { name: 'x', arguments: 'not json' } }] });
  let out = await P.callOpenAIAgent(agent.buildAgentRequest([{ role: 'user', parts: [{ text: 'add milk' }] }], { today: '2026-10-28' }), { fetch: f });
  ok(out.parts[0].functionCall.name === 'create_tasks' && out.parts[0].functionCall.args.items[0].title === 'Milk' && Object.keys(out.parts[1].functionCall.args).length === 0, 'tool_calls -> functionCall parts');
  ok(f.calls[0].url.includes('api.openai.com') && f.calls[0].body.model === 'gpt-4o-mini' && f.calls[0].body.tool_choice === 'auto' && f.calls[0].body.tools.length === agent.DECLARATIONS.length, 'request shape, default model');
  ok(f.calls[0].headers.Authorization === 'Bearer sk-test-not-real', 'auth header');
  process.env.OPENAI_MODEL = 'gpt-test'; f = oa({ role: 'assistant', content: 'Hi there!' });
  out = await P.callOpenAIAgent({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }, { fetch: f });
  ok(out.parts.length === 1 && out.parts[0].text === 'Hi there!' && f.calls[0].body.model === 'gpt-test' && !f.calls[0].body.tools, 'text reply + OPENAI_MODEL');
  await assert.rejects(P.callOpenAIAgent({ contents: [] }, { fetch: oa(null, 429) }), (e) => e.status === 429); pass++;
  await assert.rejects(P.callOpenAIAgent({ contents: [] }, { fetch: oa(null, 400) }), (e) => e.status === 502); pass++;
  // handler routing: OpenAI preferred, Gemini fallback
  const db = { doc: (p) => ({ path: p, get: async () => ({ exists: false, data: () => ({}) }) }), runTransaction: async (fn) => fn({ get: async () => ({ exists: false, data: () => ({}) }), set: () => {} }) };
  const ev = { httpMethod: 'POST', headers: { authorization: 'Bearer good' }, body: JSON.stringify({ task: 'agent', input: { contents: [{ role: 'user', parts: [{ text: 'add milk' }] }], context: {} } }) };
  const verify = async () => ({ uid: 'u1' });
  f = oa({ role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'create_tasks', arguments: '{"items":[{"title":"Milk"}]}' } }] });
  let r = await handler(ev, {}, { verify, db, fetch: f }); let b = JSON.parse(r.body);
  ok(r.statusCode === 200 && f.calls[0].url.includes('openai') && b.toolCalls[0].name === 'create_tasks' && b.parts[0].functionCall.args.items[0].title === 'Milk', 'handler uses OpenAI when key set');
  delete process.env.OPENAI_API_KEY; const gcalls = [];
  r = await handler(ev, {}, { verify, db, fetch: async (url) => { gcalls.push(url); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'hey' }] } }] }) }; } });
  ok(r.statusCode === 200 && gcalls[0].includes('generativelanguage') && JSON.parse(r.body).text === 'hey', 'Gemini fallback without OpenAI key');
  delete process.env.GEMINI_API_KEY; process.env.OPENAI_API_KEY = 'sk-test-not-real';
  r = await handler(ev, {}, { verify, db, fetch: oa({ role: 'assistant', content: 'ok' }) });
  ok(r.statusCode === 200, 'OpenAI-only config works');
  for (const [k, v] of [['OPENAI_API_KEY', saved.o], ['GEMINI_API_KEY', saved.g], ['OPENAI_MODEL', saved.m]]) { if (v == null) delete process.env[k]; else process.env[k] = v; }
  console.log(`test-agent-openai: ${pass} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
