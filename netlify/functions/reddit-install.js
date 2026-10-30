// POST /.netlify/functions/reddit-install   body: { installId, platform: 'ios', eventAt? }
// Sends ONE first-open event per app install to the Reddit Conversions API v3 (token stays server-side).
// Env (Netlify): REDDIT_ADS_ACCOUNT_ID (the Reddit pixel id, same as the ad account id, e.g. a2_xxx / t2_xxx) and REDDIT_CONVERSIONS_TOKEN.
// If either is missing the function is a no-op (200 {skipped:'not-configured'}).
// Limits (Reddit docs, CAPI v3): there is no APP_INSTALL tracking_type, so this is a CUSTOM "AppFirstOpen" event with action_source APP.
// Without an IDFA (we never prompt for ATT) Reddit can only match on IP + user agent, so it is a signal for reporting/optimization,
// NOT deterministic app-install attribution. Real Reddit APP_INSTALLS campaign attribution needs an MMP (AppsFlyer/Adjust/Branch...) + SKAdNetwork.
const crypto = require('crypto');
const { withCors } = require('./lib/cors');
const ENDPOINT = (pixel) => `https://ads-api.reddit.com/api/v3/pixels/${encodeURIComponent(pixel)}/conversion_events`;
const json = (statusCode, o) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const hdr = (h, n) => { h = h || {}; const k = Object.keys(h).find((x) => x.toLowerCase() === n); return k ? String(h[k]) : ''; };

const buildEvent = ({ installId, eventAt, ip, userAgent }) => {
  const user = { external_id: crypto.createHash('sha256').update(installId).digest('hex') };
  if (ip) user.ip_address = ip;
  if (userAgent) user.user_agent = userAgent.slice(0, 512);
  return { event_at: eventAt, action_source: 'APP', type: { tracking_type: 'CUSTOM', custom_event_name: 'AppFirstOpen' },
    metadata: { conversion_id: 'install-' + installId }, user };
};

const handler = async (event, deps = {}) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
  const installId = typeof body.installId === 'string' ? body.installId : '';
  if (!ID_RE.test(installId) || body.platform !== 'ios') return json(400, { error: 'Bad request' });
  const env = deps.env || process.env;
  const pixel = (env.REDDIT_ADS_ACCOUNT_ID || '').trim(); const token = (env.REDDIT_CONVERSIONS_TOKEN || '').trim();
  if (!pixel || !token) return json(200, { ok: true, skipped: 'not-configured' });
  const now = deps.now ? deps.now() : Date.now();
  const at = Number(body.eventAt); const eventAt = Number.isFinite(at) && at > now - 7 * 864e5 && at <= now + 6e4 ? Math.floor(at) : now;
  const h = event.headers || {};
  const ip = (hdr(h, 'x-nf-client-connection-ip') || hdr(h, 'x-forwarded-for').split(',')[0] || '').trim();
  const ev = buildEvent({ installId, eventAt, ip, userAgent: hdr(h, 'user-agent') });
  try {
    const r = await (deps.fetch || fetch)(ENDPOINT(pixel), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ data: { events: [ev] } }) });
    if (!r.ok) { console.error('[reddit-install] reddit status', r.status); return json(502, { error: 'upstream' }); }
    return json(200, { ok: true, sent: true });
  } catch (e) { console.error('[reddit-install] fetch failed'); return json(502, { error: 'upstream' }); }
};
exports.handler = withCors((e) => handler(e));
exports._handler = handler; exports._buildEvent = buildEvent;
