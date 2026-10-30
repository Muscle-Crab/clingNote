// applyAiEstimate is wired into task creation (HomeView refineWithAi) and an unavailable AI keeps the local estimate.
const fs = require('fs'); const path = require('path');
const sr = require('./lib/srcRequire');
const ai = sr.load('utils/aiEstimate.js'); const est = sr.load('utils/taskEstimate.js');
let pass = 0; const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } pass++; };
(async () => {
  const base = { title: 'ZZTEST plan garden party', createdAt: 'x', ...est.estimateFor({ title: 'ZZTEST plan garden party' }) };
  ok(base.estimateSource === 'local', 'created with local estimate');
  // unavailable AI -> 0 (local estimate kept), never throws
  const fails = {
    'no ask': null,
    'server 500 (no key)': async () => { throw Object.assign(new Error('Server not configured'), { status: 500 }); },
    'not pro 402': async () => { throw Object.assign(new Error('Pro required'), { status: 402 }); },
    'offline': async () => { throw new TypeError('Failed to fetch'); },
    'bad json': async () => ({ content: 'sure! about an hour' }),
    'out of range': async () => ({ content: '{"minutes": -4}' }),
    'null data': async () => null,
    'hang (timeout)': () => new Promise(() => {}),
  };
  for (const [name, ask] of Object.entries(fails)) ok(await ai.requestAiEstimate(base, ask, { timeoutMs: 50 }) === 0, `graceful: ${name}`);
  // success
  let seen = null;
  const m = await ai.requestAiEstimate(base, async (task, input) => { seen = { task, input }; return { content: '```json\n{"minutes": 95}\n```' }; });
  ok(m === 95 && seen.task === 'estimate' && seen.input.title === base.title, 'success parses minutes + calls task estimate');
  ok(await ai.requestAiEstimate({ ...base, estimateMin: 20 }, async () => ({ content: '{"minutes":95}' })) === 0, 'typed estimate: AI not asked');
  const p = est.withAiEstimate(base, 95);
  ok(p && p.minutes === 95 && p.estimateSource === 'ai' && p.points > 0 && p.complexity > 0, 'applyAiEstimate -> minutes/points/complexity');
  ok(est.withAiEstimate({ ...base, pointsSource: 'ai' }, 95) === null, 'assistant-rated points untouched');
  ok(est.withAiEstimate({ ...base, estimateSource: 'user', estimateMin: 10 }, 95) === null, 'user estimate untouched');
  ok(est.withAiEstimate(base, 0) === null && est.withAiEstimate(base, NaN) === null, 'bad minutes ignored');
  // wiring
  const home = fs.readFileSync(path.join(sr.src, 'views/HomeView.vue'), 'utf8');
  ok(/refineWithAi\(task,/.test(home) && /requestAiEstimate\(/.test(home) && /withAiEstimate\(/.test(home), 'HomeView calls the AI estimate after a successful add');
  ok(/rcProActive\(u\.uid\) \|\| isProUser\(await loadUserDoc\(\)\)\) \|\| !\(await hasAiConsent\(\)\)/.test(home), 'only Pro + existing consent (no paywall / consent prompt)');
  const prompts = require('../netlify/functions/lib/aiPrompts');
  const r = prompts.buildRequest('estimate', { title: 'Wash car' });
  ok(r && r.costsCredit === false && /minutes/.test(r.body.messages[0].content), 'server task estimate exists');
  console.log(`test-ai-estimate-wiring: ${pass} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
