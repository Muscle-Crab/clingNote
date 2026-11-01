// Run: node scripts/test-reddit-install-fn.js  (Reddit first-open function with a fake fetch; no network, no secrets)
const path = require('path'); const assert = require('assert');
const fn = require(path.join(__dirname, '../netlify/functions/reddit-install.js'));
(async () => {
  let n = 0; const t = async (name, f) => { await f(); n++; console.log('ok -', name); };
  const NOW = 1798000000000; const ID = '6F9619FF-8B86-D011-B42D-00C04FC964FF';
  const req = (body, method = 'POST', headers = { 'user-agent': 'ClingNote/42 CFNetwork', 'x-nf-client-connection-ip': '198.51.100.7' }) => ({ httpMethod: method, headers, body: JSON.stringify(body) });
  const env = { REDDIT_ADS_ACCOUNT_ID: 'a2_test', REDDIT_CONVERSIONS_TOKEN: 'tok_test' };
  const mkFetch = (status = 200) => { const calls = []; const f = async (url, opts) => { calls.push({ url, opts }); return { ok: status < 300, status }; }; f.calls = calls; return f; };
  await t('405 on GET, 400 on bad body', async () => {
    const f = mkFetch(); assert.equal((await fn._handler(req({}, 'GET'), { env, fetch: f })).statusCode, 405);
    assert.equal((await fn._handler({ httpMethod: 'POST', body: '{' }, { env, fetch: f })).statusCode, 400);
    assert.equal((await fn._handler(req({ installId: 'x', platform: 'ios' }), { env, fetch: f })).statusCode, 400);
    assert.equal((await fn._handler(req({ installId: ID, platform: 'android' }), { env, fetch: f })).statusCode, 400);
    assert.equal(f.calls.length, 0);
  });
  await t('no-op 200 when env vars missing (no network call)', async () => {
    for (const e of [{}, { REDDIT_ADS_ACCOUNT_ID: 'a2_x' }, { REDDIT_CONVERSIONS_TOKEN: 't' }]) {
      const f = mkFetch(); const r = await fn._handler(req({ installId: ID, platform: 'ios' }), { env: e, fetch: f });
      assert.equal(r.statusCode, 200); assert.equal(JSON.parse(r.body).skipped, 'not-configured'); assert.equal(f.calls.length, 0);
    }
  });
  await t('sends one CUSTOM AppFirstOpen APP event with bearer token, hashed install id, ip + UA', async () => {
    const f = mkFetch(); const r = await fn._handler(req({ installId: ID, platform: 'ios', eventAt: NOW - 1000 }), { env, fetch: f, now: () => NOW });
    assert.equal(r.statusCode, 200); assert.equal(f.calls.length, 1);
    const c = f.calls[0]; assert.equal(c.url, 'https://ads-api.reddit.com/api/v3/pixels/a2_test/conversion_events');
    assert.equal(c.opts.headers.Authorization, 'Bearer tok_test');
    const ev = JSON.parse(c.opts.body).data.events[0];
    assert.equal(ev.action_source, 'APP'); assert.deepEqual(ev.type, { tracking_type: 'CUSTOM', custom_event_name: 'AppFirstOpen' });
    assert.equal(ev.event_at, NOW - 1000); assert.equal(ev.metadata.conversion_id, 'install-' + ID);
    assert.match(ev.user.external_id, /^[0-9a-f]{64}$/);
    assert.equal(ev.user.ip_address, '198.51.100.7'); assert.equal(ev.user.user_agent, 'ClingNote/42 CFNetwork'); assert.ok(!('idfa' in ev.user));
    assert.ok(!r.body.includes('tok_test'));
  });
  await t('bogus/stale eventAt falls back to server time', async () => {
    const f = mkFetch(); await fn._handler(req({ installId: ID, platform: 'ios', eventAt: 5 }), { env, fetch: f, now: () => NOW });
    assert.equal(JSON.parse(f.calls[0].opts.body).data.events[0].event_at, NOW);
  });
  await t('upstream error -> 502 (app retries next launch), token not leaked', async () => {
    const r = await fn._handler(req({ installId: ID, platform: 'ios' }), { env, fetch: mkFetch(401) }); assert.equal(r.statusCode, 502); assert.ok(!r.body.includes('tok_test'));
    const r2 = await fn._handler(req({ installId: ID, platform: 'ios' }), { env, fetch: async () => { throw new Error('net'); } }); assert.equal(r2.statusCode, 502);
  });
  console.log(`reddit-install: ${n} tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
