// POST /.netlify/functions/ai   Authorization: Bearer <Firebase ID token>
// Body: { task: 'meal-image' | 'meal-text' | 'workout', input: {...} } -> { content }
// OPENAI_API_KEY stays on the server. 'meal-image' costs 1 credit, deducted here in a transaction (clients can't write credits).
const { verifyUser, getAdmin } = require('./lib/notify');
const { buildRequest } = require('./lib/aiPrompts');

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

exports.handler = async (event, ctx, deps = {}) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const uid = await verifyUser(event.headers, deps.verify);
    if (!process.env.OPENAI_API_KEY) return json(500, { error: 'Server not configured' });
    let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
    const req = buildRequest(body.task, body.input);
    const db = deps.db || (req.costsCredit ? getAdmin().firestore() : null);
    let creditsLeft;
    if (req.costsCredit) creditsLeft = await spendCredit(db, uid);
    const r = await (deps.fetch || fetch)('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(req.body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { if (req.costsCredit) await refundCredit(db, uid).catch(() => {}); return json(502, { error: 'AI request failed' }); }
    return json(200, { content: data.choices?.[0]?.message?.content || '', creditsLeft });
  } catch (e) {
    return json(e.status || 500, { error: e.message });
  }
};
