// Pluggable chat provider. Takes an OpenAI-style request body ({ model, messages, temperature, max_tokens, response_format })
// and returns the reply text. Uses Gemini (GEMINI_API_KEY, model GEMINI_MODEL, default gemini-2.5-flash) when preferred/available,
// otherwise OpenAI (OPENAI_API_KEY). Image requests (content arrays) stay on OpenAI.
const hasImage = (body) => (body.messages || []).some((m) => Array.isArray(m.content));
const pickProvider = (body, { prefer = 'gemini' } = {}) => {
  const g = !!process.env.GEMINI_API_KEY && !hasImage(body); const o = !!process.env.OPENAI_API_KEY;
  if (prefer === 'gemini') return g ? 'gemini' : o ? 'openai' : null;
  return o ? 'openai' : g ? 'gemini' : null;
};
const toGemini = (body) => {
  const sys = (body.messages || []).filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = (body.messages || []).filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
  const generationConfig = { temperature: body.temperature ?? 0.7, maxOutputTokens: body.max_tokens || 800 };
  if (body.response_format && body.response_format.type === 'json_object') generationConfig.responseMimeType = 'application/json';
  return { ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}), contents, generationConfig };
};
// Gemini retires models (404 "no longer available"). Try the configured model, then known-current fallbacks.
const GEMINI_FALLBACKS = ['gemini-3.8-flash', 'gemini-flash-latest'];
const geminiGenerate = async (f, primary, reqBody) => {
  const models = [primary, ...GEMINI_FALLBACKS.filter((m) => m !== primary)];
  let r; let data; let model;
  for (model of models) {
    r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body: JSON.stringify(reqBody),
    });
    data = await r.json().catch(() => ({}));
    if (r.status !== 404) break;
    console.error('gemini model unavailable, trying fallback', model);
  }
  return { r, data, model };
};
const callChat = async (body, { fetch: f = fetch, prefer } = {}) => {
  const provider = pickProvider(body, { prefer });
  if (!provider) throw Object.assign(new Error('Server not configured'), { status: 500 });
  if (provider === 'gemini') {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const { r, data } = await geminiGenerate(f, model, toGemini(body));
    if (!r.ok) throw Object.assign(new Error('AI request failed'), { status: 502 });
    return { provider, content: (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('') };
  }
  const r = await f('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('AI request failed'), { status: 502 });
  return { provider, content: data.choices?.[0]?.message?.content || '' };
};
// Native Gemini call (function calling): returns the model's raw parts so the client can echo thought signatures back.
const callGeminiRaw = async (reqBody, { fetch: f = fetch } = {}) => {
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error('Server not configured'), { status: 500 });
  const { r, data, model } = await geminiGenerate(f, process.env.GEMINI_AGENT_MODEL || process.env.GEMINI_MODEL || 'gemini-3-flash-preview', reqBody);
  if (!r.ok) {
    console.error('gemini error', r.status, model, JSON.stringify(data && data.error));
    throw Object.assign(new Error('AI request failed'), { status: r.status === 429 ? 429 : 502 });
  }
  return { parts: data.candidates?.[0]?.content?.parts || [], finishReason: data.candidates?.[0]?.finishReason || '' };
};
// OpenAI tool-calling path for the agent: converts the Gemini-style request (systemInstruction, contents, functionDeclarations)
// to Chat Completions and maps the reply back to Gemini-style parts ({functionCall:{name,args}} | {text}).
const toOpenAISchema = (s) => {
  if (Array.isArray(s)) return s.map(toOpenAISchema);
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'type' && typeof v === 'string') out.type = v.toLowerCase();
    else if (k === 'enum') { const e = (Array.isArray(v) ? v : []).filter((x) => x !== '' && x != null); if (e.length) out.enum = e; }
    else if (k === 'nullable' || k === 'propertyOrdering') continue;
    else out[k] = toOpenAISchema(v);
  }
  return out;
};
const toOpenAITools = (tools) => (tools || []).flatMap((t) => t.functionDeclarations || []).map((d) => ({
  type: 'function', function: { name: d.name, description: d.description || '', parameters: d.parameters ? toOpenAISchema(d.parameters) : { type: 'object', properties: {} } },
}));
const toOpenAIMessages = (req) => {
  const msgs = []; const sys = (req.systemInstruction?.parts || []).map((p) => p.text || '').join('\n');
  if (sys) msgs.push({ role: 'system', content: sys });
  const pending = []; let n = 0; // queue of {id,name} awaiting functionResponse
  for (const c of req.contents || []) {
    const parts = c.parts || [];
    if (c.role === 'model') {
      const text = parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
      const calls = parts.filter((p) => p.functionCall).map((p) => { const id = p.functionCall.id || `call_${n++}`; pending.push({ id, name: p.functionCall.name }); return { id, type: 'function', function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args || {}) } }; });
      if (text || calls.length) msgs.push({ role: 'assistant', content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
    } else {
      for (const p of parts.filter((x) => x.functionResponse)) {
        const fr = p.functionResponse; const i = pending.findIndex((q) => (fr.id ? q.id === fr.id : q.name === fr.name));
        const id = i >= 0 ? pending.splice(i, 1)[0].id : (fr.id || `call_${n++}`);
        if (i < 0) { msgs.push({ role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name: fr.name, arguments: '{}' } }] }); }
        msgs.push({ role: 'tool', tool_call_id: id, content: JSON.stringify(fr.response ?? {}) });
      }
      const text = parts.filter((p) => typeof p.text === 'string').map((p) => p.text).join('');
      if (text) msgs.push({ role: 'user', content: text });
    }
  }
  // OpenAI requires every tool_call to be answered; fill any unanswered ones.
  for (const q of pending) { const at = msgs.findIndex((m) => m.tool_calls && m.tool_calls.some((t) => t.id === q.id)); msgs.splice(at + 1, 0, { role: 'tool', tool_call_id: q.id, content: '{"error":"no result"}' }); }
  return msgs;
};
const fromOpenAIMessage = (m) => {
  const parts = [];
  if (m && typeof m.content === 'string' && m.content) parts.push({ text: m.content });
  for (const t of (m && m.tool_calls) || []) {
    if (t.type && t.type !== 'function') continue;
    let args = {}; try { args = JSON.parse(t.function.arguments || '{}') || {}; } catch (e) { args = {}; }
    parts.push({ functionCall: { name: t.function.name, args } });
  }
  return parts;
};
const callOpenAIAgent = async (reqBody, { fetch: f = fetch } = {}) => {
  if (!process.env.OPENAI_API_KEY) throw Object.assign(new Error('Server not configured'), { status: 500 });
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const tools = toOpenAITools(reqBody.tools);
  const body = { model, messages: toOpenAIMessages(reqBody), temperature: reqBody.generationConfig?.temperature ?? 0.4, max_tokens: reqBody.generationConfig?.maxOutputTokens || 1200, ...(tools.length ? { tools, tool_choice: 'auto' } : {}) };
  const r = await f('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('openai error', r.status, model, JSON.stringify(data && data.error && { type: data.error.type, code: data.error.code, message: data.error.message })); throw Object.assign(new Error('AI request failed'), { status: r.status === 429 ? 429 : 502 }); }
  const ch = data.choices?.[0] || {};
  return { parts: fromOpenAIMessage(ch.message), finishReason: ch.finish_reason || '', provider: 'openai' };
};
// Agent: prefer OpenAI when OPENAI_API_KEY is set, else Gemini.
const callAgentRaw = (reqBody, opts = {}) => (process.env.OPENAI_API_KEY ? callOpenAIAgent(reqBody, opts) : callGeminiRaw(reqBody, opts));
module.exports = { callChat, pickProvider, toGemini, callGeminiRaw, callOpenAIAgent, callAgentRaw, toOpenAISchema, toOpenAITools, toOpenAIMessages, fromOpenAIMessage };
