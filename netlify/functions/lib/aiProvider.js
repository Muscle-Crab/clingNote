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
const callChat = async (body, { fetch: f = fetch, prefer } = {}) => {
  const provider = pickProvider(body, { prefer });
  if (!provider) throw Object.assign(new Error('Server not configured'), { status: 500 });
  if (provider === 'gemini') {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body: JSON.stringify(toGemini(body)),
    });
    const data = await r.json().catch(() => ({}));
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
  const model = process.env.GEMINI_AGENT_MODEL || process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
  const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body: JSON.stringify(reqBody),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('gemini error', r.status, model, JSON.stringify(data && data.error));
    throw Object.assign(new Error('AI request failed'), { status: r.status === 429 ? 429 : 502 });
  }
  return { parts: data.candidates?.[0]?.content?.parts || [], finishReason: data.candidates?.[0]?.finishReason || '' };
};
module.exports = { callChat, pickProvider, toGemini, callGeminiRaw };
