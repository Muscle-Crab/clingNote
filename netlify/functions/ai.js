// POST /.netlify/functions/ai   Authorization: Bearer <Firebase ID token>
// Body: { task: 'meal-image' | 'meal-text' | 'workout', input: {...} } -> { content }
// task 'ask' (Ask Anything): any signed-in user, ASK_LIMITS.FREE_PER_DAY/day free, Pro unlimited (lib/askConfig.js); Gemini if GEMINI_API_KEY is set.
// Other tasks: Pro only (server-checked users/{uid}.isPro + proExpiresAt). OPENAI_API_KEY stays on the server. 'meal-image' costs 1 credit, deducted here in a transaction (clients can't write credits).
const { getAdmin } = require('./lib/firebaseAdmin');
const { requirePro, userIsPro } = require('./lib/requirePro');
const { verifyUser } = require('./lib/notify');
const { callChat, callAgentRaw } = require('./lib/aiProvider');
const { ASK_LIMITS, AGENT_LIMITS } = require('./lib/askConfig');
const agentLib = require('./lib/agentTools');
const { buildRequest, normalizeBreakdown } = require('./lib/aiPrompts');

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const spendCredit = async (db, uid) => db.runTransaction(async (tx) => {
  const ref = db.doc(`users/${uid}`);
  const snap = await tx.get(ref);
  const credits = Number(snap.exists ? snap.data().credits : 0) || 0;
  if (credits <= 0) throw Object.assign(new Error('No credits left'), { status: 402 });
  tx.update(ref, { credits: credits - 1 });
  return credits - 1;
});
const refundCredit = async (db, uid) => db.runTransaction(async (tx) => {
  const ref = db.doc(`users/${uid}`); const snap = await tx.get(ref);
  tx.update(ref, { credits: (Number(snap.data()?.credits) || 0) + 1 });
});

// Per-user daily counter (UTC day) for Ask Anything: aiUsage/{uid}_{YYYY-MM-DD}, written only by this function (admin SDK).
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const takeAskQuota = async (db, uid, limit) => db.runTransaction(async (tx) => {
  const ref = db.doc(`aiUsage/${uid}_${dayKey()}`); const snap = await tx.get(ref);
  const used = Number(snap.exists ? snap.data().ask : 0) || 0;
  if (limit != null && used >= limit) throw Object.assign(new Error('Daily limit reached'), { status: 429, used, limit });
  tx.set(ref, { ask: used + 1, uid, day: dayKey() }, { merge: true });
  return used + 1;
});
const giveBackAsk = async (db, uid) => db.runTransaction(async (tx) => {
  const ref = db.doc(`aiUsage/${uid}_${dayKey()}`); const snap = await tx.get(ref);
  tx.set(ref, { ask: Math.max(0, (Number(snap.exists ? snap.data().ask : 0) || 0) - 1) }, { merge: true });
});
const handleAsk = async (event, body, deps) => {
  const uid = await verifyUser(event.headers, deps.verify || ((t) => getAdmin().auth().verifyIdToken(t))); // 401 without a valid Firebase token
  const req = buildRequest('ask', body.input || {}); // 400 on empty question
  const db = deps.db || getAdmin().firestore();
  const pro = await userIsPro(db, uid);
  const limit = pro ? ASK_LIMITS.PRO_PER_DAY : ASK_LIMITS.FREE_PER_DAY;
  let used;
  try { used = await takeAskQuota(db, uid, limit); }
  catch (e) { if (e.status === 429) return json(429, { error: pro ? 'Daily limit reached' : `Free plan: ${limit} questions a day. Upgrade to Pro for unlimited.`, limit, remaining: 0, pro }); throw e; }
  try {
    const out = await callChat(req.body, { fetch: deps.fetch, prefer: 'gemini' });
    return json(200, { content: out.content, pro, limit, remaining: limit == null ? null : Math.max(0, limit - used) });
  } catch (e) {
    await giveBackAsk(db, uid).catch(() => {});
    return json(e.status === 500 ? 500 : 502, { error: e.status === 500 ? 'Server not configured' : 'AI request failed' });
  }
};

// task 'breakdown' (task card "Break it down"): any signed-in user, shares the free daily 'ask' quota (Pro unlimited); a failed or unusable reply
// gives the quota back. Reply: { steps: [{ title, minutes }] } (validated here; the client adds points with the app's own scoring).
const handleBreakdown = async (event, body, deps) => {
  const uid = await verifyUser(event.headers, deps.verify || ((t) => getAdmin().auth().verifyIdToken(t)));
  const req = buildRequest('breakdown', body.input || {}); // 400 on empty title
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) return json(500, { error: 'Server not configured' });
  const db = deps.db || getAdmin().firestore();
  const pro = await userIsPro(db, uid);
  const limit = pro ? ASK_LIMITS.PRO_PER_DAY : ASK_LIMITS.FREE_PER_DAY;
  let used;
  try { used = await takeAskQuota(db, uid, limit); }
  catch (e) { if (e.status === 429) return json(429, { error: pro ? 'Daily limit reached' : `Free plan: ${limit} AI requests a day. Upgrade to Pro for unlimited.`, limit, remaining: 0, pro }); throw e; }
  try {
    const out = await callChat(req.body, { fetch: deps.fetch, prefer: 'openai' });
    const steps = normalizeBreakdown(out.content);
    return json(200, { steps, pro, limit, remaining: limit == null ? null : Math.max(0, limit - used) });
  } catch (e) {
    await giveBackAsk(db, uid).catch(() => {});
    return json(e.status === 500 ? 500 : 502, { error: e.status === 500 ? 'Server not configured' : "Couldn't break this down right now" });
  }
};

// task 'agent' (ClingNote assistant): OpenAI tool calling if OPENAI_API_KEY is set, else Gemini function calling; tools executed on the client. input: { contents (Gemini turns), context, step }.
// 1 quota unit per NEW user message (shared with 'ask'); tool-result round trips are free but capped (per turn + per day).
const takeSteps = async (db, uid) => db.runTransaction(async (tx) => {
  const ref = db.doc(`aiUsage/${uid}_${dayKey()}`); const snap = await tx.get(ref);
  const used = Number(snap.exists ? snap.data().agentSteps : 0) || 0;
  if (used >= AGENT_LIMITS.STEPS_PER_DAY) throw Object.assign(new Error('Daily limit reached'), { status: 429 });
  tx.set(ref, { agentSteps: used + 1, uid, day: dayKey() }, { merge: true });
});
const handleAgent = async (event, body, deps) => {
  const uid = await verifyUser(event.headers, deps.verify || ((t) => getAdmin().auth().verifyIdToken(t)));
  const input = body.input || {};
  const contents = agentLib.sanitizeContents(input.contents);
  if (!contents.length || contents[contents.length - 1].role !== 'user') return json(400, { error: 'Empty conversation' });
  const step = Math.round(Number(input.step)) || 0;
  if (step < 0 || step > AGENT_LIMITS.MAX_STEPS_PER_TURN) return json(400, { error: 'Too many steps' });
  const fresh = agentLib.isNewUserTurn(contents);
  if (!fresh && step === 0) return json(400, { error: 'Bad step' });
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) return json(500, { error: 'Server not configured' });
  const db = deps.db || getAdmin().firestore();
  const pro = await userIsPro(db, uid);
  const limit = pro ? AGENT_LIMITS.PRO_PER_DAY : ASK_LIMITS.FREE_PER_DAY;
  let used = null;
  try { if (fresh) used = await takeAskQuota(db, uid, limit); else await takeSteps(db, uid); }
  catch (e) { if (e.status === 429) return json(429, { error: pro ? 'Daily limit reached' : `Free plan: ${limit} assistant messages a day. Upgrade to Pro for more.`, limit, remaining: 0, pro }); throw e; }
  try {
    const out = await callAgentRaw(agentLib.buildAgentRequest(contents, input.context), { fetch: deps.fetch });
    const parts = out.parts.filter((p) => p && (typeof p.text === 'string' || p.functionCall)).map((p) => (p.functionCall && !agentLib.TOOL_NAMES.has(p.functionCall.name) ? null : p)).filter(Boolean);
    const toolCalls = parts.filter((p) => p.functionCall).map((p) => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));
    const text = parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('').trim();
    return json(200, { parts, toolCalls, text, pro, limit, remaining: used == null ? undefined : Math.max(0, limit - used) });
  } catch (e) {
    console.error('agent error', e && e.status, e && e.message);
    if (fresh) await giveBackAsk(db, uid).catch(() => {});
    return json(e.status === 500 ? 500 : 502, { error: e.status === 500 ? 'Server not configured' : 'AI request failed' });
  }
};

const rawHandler = async (event, ctx, deps = {}) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
    if (body && body.task === 'ask') return await handleAsk(event, body, deps);
    if (body && body.task === 'agent') return await handleAgent(event, body, deps);
    if (body && body.task === 'breakdown') return await handleBreakdown(event, body, deps);
    const uid = await requirePro(event, { verify: deps.verify, db: deps.db }); // 401 / 402 unless Pro
    if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) return json(500, { error: 'Server not configured' });
    const req = buildRequest(body.task, body.input);
    const db = deps.db || getAdmin().firestore();
    let creditsLeft;
    if (req.costsCredit) creditsLeft = await spendCredit(db, uid);
    let out;
    try { out = await callChat(req.body, { fetch: deps.fetch, prefer: 'openai' }); }
    catch (e) { if (req.costsCredit) await refundCredit(db, uid).catch(() => {}); return json(e.status === 500 ? 500 : 502, { error: e.status === 500 ? 'Server not configured' : 'AI request failed' }); }
    return json(200, { content: out.content, creditsLeft });
  } catch (e) {
    return json(e.status || 500, { error: e.message });
  }
};
const { withCors } = require('./lib/cors');
exports.handler = withCors(rawHandler);
