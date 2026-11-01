// Shared CORS helper for every Netlify function. The iOS app (Capacitor WKWebView) calls these endpoints cross-origin
// (origin capacitor://localhost, https://localhost or clingnot://localhost), and the authenticated calls send an Authorization header,
// so the browser issues an OPTIONS preflight first. Usage:   exports.handler = withCors(handlerFn);
// Never answers with '*': only allow-listed origins are echoed back (plus Vary: Origin). Extra origins via env CORS_EXTRA_ORIGINS (comma separated).
const ALLOWED_ORIGINS = [
  'capacitor://localhost', // Capacitor iOS default scheme
  'https://localhost',     // Capacitor with an https scheme / Android
  'clingnot://localhost',  // capacitor.config.json ios.scheme = "ClingNot" (origins are lower-cased by WebKit)
  'https://clingnot.netlify.app', // production site
  'https://clingnote.netlify.app', // production site alias
];
const ALLOW_METHODS = 'GET, POST, DELETE, OPTIONS';
const ALLOW_HEADERS = 'Authorization, Content-Type';

const allowedOrigins = () => ALLOWED_ORIGINS.concat(String(process.env.CORS_EXTRA_ORIGINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
const getHeader = (headers, name) => { const h = headers || {}; const k = Object.keys(h).find((x) => x.toLowerCase() === name); return k ? String(h[k]) : ''; };
const originOf = (event) => getHeader(event && event.headers, 'origin').trim().toLowerCase();
const isAllowedOrigin = (origin) => !!origin && allowedOrigins().includes(origin);

const corsHeaders = (event) => {
  const origin = originOf(event);
  const h = { Vary: 'Origin' };
  if (isAllowedOrigin(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = ALLOW_METHODS;
    h['Access-Control-Allow-Headers'] = ALLOW_HEADERS;
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
};

// Exactly 2 declared params: Netlify's Node 24 Lambda runtime rejects handlers with 3+ params as callback-style (502).
// Tests may still pass deps as a 3rd argument; it is read from `arguments` so behavior is unchanged.
const withCors = (handler) => async function corsHandler(event, ctx) {
  const deps = arguments[2];
  const e = event || {};
  if (String(e.httpMethod || '').toUpperCase() === 'OPTIONS') {
    // Preflight: answered here, never reaches the function body (no auth, no side effects).
    return { statusCode: isAllowedOrigin(originOf(e)) ? 204 : 403, headers: corsHeaders(e), body: '' };
  }
  let res;
  try { res = await handler(event, ctx, deps); } catch (err) { res = { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Server error' }) }; }
  const out = res && typeof res === 'object' ? res : { statusCode: 200, body: String(res == null ? '' : res) };
  return { ...out, headers: { ...(out.headers || {}), ...corsHeaders(e) } };
};

module.exports = { withCors, corsHeaders, isAllowedOrigin, ALLOWED_ORIGINS, ALLOW_METHODS, ALLOW_HEADERS };
