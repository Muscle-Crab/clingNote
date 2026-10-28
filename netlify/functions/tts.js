// POST /.netlify/functions/tts  Authorization: Bearer <Firebase ID token>  { text }  -> audio/mpeg (base64 body)
// Live robot speech (reports, check-ins, assistant replies) in the single ElevenLabs voice. No device TTS anywhere.
// Abuse limits: signed-in users only, <= MAX_CHARS per line, per-user daily character budget (cache hits are free).
// Cache: in-memory per warm instance + Firestore ttsCache/{sha256(voice|model|text)} (admin-only collection).
// Needs ELEVENLABS_API_KEY in the Netlify env (never committed, never logged). Without it: 503 -> app falls back to MP3s.
const crypto = require('crypto');
const { getAdmin } = require('./lib/firebaseAdmin');
const { verifyUser } = require('./lib/notify');
const V = require('./lib/voice');

const MAX_CHARS = 400;
const DAILY_CHARS = 4000;
const MEM_MAX = 200;
const mem = new Map();
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const audio = (b64, hit) => ({ statusCode: 200, isBase64Encoded: true, body: b64,
  headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=604800', 'X-TTS-Cache': hit } });
const norm = (t) => String(t || '').replace(/[*_#`>]/g, '').replace(/\s+/g, ' ').trim();
const remember = (k, b64) => { mem.set(k, b64); if (mem.size > MEM_MAX) mem.delete(mem.keys().next().value); };

const rawHandler = async (event, ctx, deps = {}) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const env = deps.env || process.env;
    const verify = deps.verify || ((t) => getAdmin().auth().verifyIdToken(t));
    const uid = await verifyUser(event.headers, verify);
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
    const text = norm(body.text);
    if (!text) return json(400, { error: 'No text' });
    if (text.length > MAX_CHARS) return json(413, { error: `Max ${MAX_CHARS} characters` });
    const voiceId = env.ELEVENLABS_VOICE_ID || V.VOICE_ID; const model = env.ELEVENLABS_MODEL || V.LIVE_MODEL;
    const key = crypto.createHash('sha256').update(`${voiceId}|${model}|${text}`).digest('hex');
    if (mem.has(key)) return audio(mem.get(key), 'mem');
    const db = deps.db || getAdmin().firestore();
    const cached = await db.doc(`ttsCache/${key}`).get().catch(() => null);
    if (cached && cached.exists && cached.data().b64) { remember(key, cached.data().b64); return audio(cached.data().b64, 'store'); }
    const apiKey = env.ELEVENLABS_API_KEY;
    if (!apiKey) return json(503, { error: 'Voice unavailable' });

    const day = new Date().toISOString().slice(0, 10);
    const cap = Number(env.TTS_DAILY_CHARS) || DAILY_CHARS;
    const usage = db.doc(`ttsUsage/${uid}_${day}`);
    const allowed = await db.runTransaction(async (tx) => {
      const s = await tx.get(usage); const used = (s.exists && Number(s.data().chars)) || 0;
      if (used + text.length > cap) return false;
      tx.set(usage, { uid, day, chars: used + text.length, updatedAt: new Date() }, { merge: true }); return true;
    });
    if (!allowed) return json(429, { error: 'Daily voice limit reached' });

    const f = deps.fetch || fetch;
    const r = await f(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${V.OUTPUT}`, {
      method: 'POST', headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model, voice_settings: V.SETTINGS }),
    });
    if (!r.ok) { // refund the budget: a provider failure must not eat the user's daily voice chars
      await db.runTransaction(async (tx) => { const s = await tx.get(usage); const used = (s.exists && Number(s.data().chars)) || 0; tx.set(usage, { chars: Math.max(0, used - text.length), updatedAt: new Date() }, { merge: true }); }).catch(() => {});
      return json(502, { error: `Voice provider ${r.status}` }); // status only: never echo headers/key
    }
    const b64 = Buffer.from(await r.arrayBuffer()).toString('base64');
    remember(key, b64);
    if (b64.length < 900000) await db.doc(`ttsCache/${key}`).set({ b64, text, voiceId, model, at: new Date() }).catch(() => {});
    return audio(b64, 'miss');
  } catch (e) { return json(e.status || 500, { error: e.status ? e.message : 'Error' }); }
};
const { withCors } = require('./lib/cors');
exports.handler = withCors(rawHandler);
exports.rawHandler = rawHandler;
exports._mem = mem;
