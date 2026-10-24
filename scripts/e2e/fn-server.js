// Local harness: serves netlify/functions/manager-pal.js on :8888 against the emulators (demo-clingnote). No production access.
process.env.GCLOUD_PROJECT = 'demo-clingnote';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
for (const k of ['FIREBASE_SERVICE_ACCOUNT', 'GOOGLE_APPLICATION_CREDENTIALS_BASE64', 'GOOGLE_APPLICATION_CREDENTIALS_BASE', 'ONESIGNAL_REST_API_KEY']) delete process.env[k];
const http = require('http');
const { handler } = require('../../netlify/functions/manager-pal');
http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => { body += c; });
  req.on('end', async () => {
    const u = new URL(req.url, 'http://x');
    const r = await handler({ httpMethod: req.method, headers: req.headers, body, queryStringParameters: Object.fromEntries(u.searchParams), path: u.pathname });
    res.writeHead(r.statusCode, r.headers || {}); res.end(r.body || '');
  });
}).listen(8888, () => console.log('fn harness on :8888'));
