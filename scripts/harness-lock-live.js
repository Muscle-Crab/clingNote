// LIVE harness (not in npm run check): sends a few real assistant turns through netlify/functions/ai.js (OpenAI path, GEMINI_API_KEY unset)
// and checks the model picks lock_apps / unlock_apps with the right args. Run: env -u GEMINI_API_KEY node scripts/harness-lock-live.js
delete process.env.GEMINI_API_KEY;
const { handler } = require('../netlify/functions/ai');
const docs = {};
const db = { doc: (p) => ({ path: p, get: async () => ({ exists: p.startsWith('users/'), data: () => ({ isPro: true, plan: 'lifetime' }) }) }),
  runTransaction: async (fn) => fn({ get: async (r) => ({ exists: !!docs[r.path], data: () => docs[r.path] }), set: (r, d) => { docs[r.path] = { ...(docs[r.path] || {}), ...d }; } }) };
const verify = async () => ({ uid: 'harness' });
const ctx = (apps) => ({ tasks: [], now: '2026-10-28T15:00', tz: 'America/New_York', pro: true, route: '/home', lockApps: apps });
const saved = [{ name: 'TikTok', locked: false }, { name: 'YouTube', locked: true }, { name: 'Instagram', locked: false }];
const cases = [
  ['lock tiktok', saved, (c) => c.name === 'lock_apps' && /tik/i.test(c.args.apps.join()) && !c.args.minutes],
  ['lock TikTok and Instagram for 2 hours', saved, (c) => c.name === 'lock_apps' && c.args.apps.length === 2 && c.args.minutes === 120],
  ['block YT for 45 min', saved, (c) => c.name === 'lock_apps' && /yt|youtube/i.test(c.args.apps.join()) && c.args.minutes === 45],
  ['unlock youtube', saved, (c) => c.name === 'unlock_apps' && /you/i.test(c.args.apps.join())],
  ['lock Snapchat for 30 minutes', saved, (c) => c.name === 'lock_apps' && /snap/i.test(c.args.apps.join()) && c.args.minutes === 30], // not picked: still lock_apps, phone onboards
  ['lock TikTok', [], (c) => c.name === 'lock_apps'], // first ever lock, nothing picked yet
];
(async () => {
  let pass = 0;
  for (const [text, apps, check] of cases) {
    const r = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer x' }, body: JSON.stringify({ task: 'agent', input: { contents: [{ role: 'user', parts: [{ text }] }], context: ctx(apps) } }) }, {}, { verify, db });
    const b = JSON.parse(r.body || '{}'); const calls = b.toolCalls || [];
    const good = r.statusCode === 200 && calls.length === 1 && check(calls[0]);
    if (good) pass++;
    console.log(`${good ? 'PASS' : 'FAIL'} "${text}" -> ${r.statusCode} ${JSON.stringify(calls)}${calls.length ? '' : ` text=${JSON.stringify(b.text || b.error || '').slice(0, 120)}`}`);
  }
  console.log(`live lock harness: ${pass}/${cases.length}`); process.exit(pass === cases.length ? 0 : 1);
})();
