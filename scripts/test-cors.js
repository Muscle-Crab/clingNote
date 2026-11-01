// Tests netlify/functions/lib/cors.js and that every HTTP function is wrapped (OPTIONS preflight answered, allow-listed origins only).
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const { withCors, isAllowedOrigin, ALLOWED_ORIGINS } = require('../netlify/functions/lib/cors');
const t = async (name, fn) => { await fn(); console.log('ok -', name); };
(async () => {
  await t('allow-list holds the app + site origins and never "*"', () => {
    for (const o of ['capacitor://localhost', 'https://localhost', 'clingnot://localhost', 'https://clingnot.netlify.app']) assert(ALLOWED_ORIGINS.includes(o), o);
    assert(!ALLOWED_ORIGINS.includes('*')); assert(!isAllowedOrigin('https://evil.example')); assert(!isAllowedOrigin('')); assert(!isAllowedOrigin('null'));
  });
  let called = 0; const h = withCors(async () => { called++; return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '{}' }; });
  await t('OPTIONS preflight from the iOS app: 204, no handler call, allows Authorization + Content-Type', async () => {
    const r = await h({ httpMethod: 'OPTIONS', headers: { origin: 'capacitor://localhost', 'access-control-request-headers': 'authorization,content-type' } });
    assert.strictEqual(r.statusCode, 204); assert.strictEqual(called, 0);
    assert.strictEqual(r.headers['Access-Control-Allow-Origin'], 'capacitor://localhost');
    assert(/Authorization/.test(r.headers['Access-Control-Allow-Headers']) && /Content-Type/.test(r.headers['Access-Control-Allow-Headers']));
    assert(/POST/.test(r.headers['Access-Control-Allow-Methods']) && /OPTIONS/.test(r.headers['Access-Control-Allow-Methods']));
  });
  await t('preflight from a foreign origin: 403 and no allow-origin header', async () => {
    const r = await h({ httpMethod: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    assert.strictEqual(r.statusCode, 403); assert(!r.headers['Access-Control-Allow-Origin']);
  });
  await t('real response gets CORS headers for allowed origins (case-insensitive), none for others', async () => {
    let r = await h({ httpMethod: 'POST', headers: { Origin: 'clingnot://LOCALHOST' } });
    assert.strictEqual(r.statusCode, 200); assert.strictEqual(r.headers['Access-Control-Allow-Origin'], 'clingnot://localhost'); assert.strictEqual(r.headers['Content-Type'], 'application/json'); assert.strictEqual(r.headers.Vary, 'Origin');
    r = await h({ httpMethod: 'POST', headers: { origin: 'https://evil.example' } }); assert(!r.headers['Access-Control-Allow-Origin']);
    r = await h({ httpMethod: 'POST', headers: {} }); assert(!r.headers['Access-Control-Allow-Origin']); assert.strictEqual(r.statusCode, 200);
  });
  await t('a throwing handler still yields a 500 JSON response with CORS headers', async () => {
    const r = await withCors(async () => { throw new Error('boom'); })({ httpMethod: 'POST', headers: { origin: 'https://localhost' } });
    assert.strictEqual(r.statusCode, 500); assert.strictEqual(r.headers['Access-Control-Allow-Origin'], 'https://localhost'); assert(!/boom/.test(r.body));
  });
  await t('every HTTP function is wrapped with withCors (daily-report is scheduled, no HTTP)', () => {
    const dir = path.join(__dirname, '../netlify/functions');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'daily-report.js')) assert(/withCors\(/.test(fs.readFileSync(path.join(dir, f), 'utf8')), f + ' is not wrapped with withCors');
  });
  await t('no client code calls a relative /.netlify/functions URL (must go through fnUrl())', () => {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'assets' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
    for (const f of walk(path.join(__dirname, '../src')).filter((x) => /\.(vue|js)$/.test(x) && !x.endsWith('config/api.js'))) {
      for (const line of fs.readFileSync(f, 'utf8').split('\n')) if (/fetch\(\s*['"`]\/\.netlify\//.test(line) || /=\s*['"`]\/\.netlify\/functions/.test(line)) assert.fail(f + ': ' + line.trim());
    }
  });
  console.log('cors tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
