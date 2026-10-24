// Run: node scripts/test-manager-pal.js — Manager & Pal function with an in-memory Firestore fake (ZZTEST data only, no network).
const assert = require('assert');
process.env.ONESIGNAL_APP_ID = 'zztest-app';
const M = require('../netlify/functions/lib/managerPal');
const { rawHandler, handler } = require('../netlify/functions/manager-pal');
const t = async (name, fn) => { await fn(); console.log('ok -', name); };

// Minimal Firestore fake: doc/collection/add/get/set/delete/orderBy/limit/batch/runTransaction.
const makeDb = () => {
  const store = new Map(); let auto = 0;
  const snap = (path) => { const v = store.get(path); return { exists: store.has(path), id: path.split('/').pop(), ref: docRef(path), data: () => v }; };
  const docRef = (path) => ({ path, get: async () => snap(path), set: async (v, o) => { store.set(path, o && o.merge ? { ...(store.get(path) || {}), ...v } : { ...v }); }, delete: async () => { store.delete(path); }, collection: (c) => col(`${path}/${c}`) });
  const col = (path, ord, lim) => ({
    add: async (v) => { const id = `id${++auto}`; store.set(`${path}/${id}`, v); return { id }; },
    orderBy: (f, dir) => col(path, [f, dir], lim), limit: (n) => col(path, ord, n),
    get: async () => { let docs = [...store.keys()].filter((k) => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1).map(snap);
      if (ord) docs.sort((a, b) => (+a.data()[ord[0]] - +b.data()[ord[0]]) * (ord[1] === 'desc' ? -1 : 1)); if (lim) docs = docs.slice(0, lim); return { docs }; },
  });
  return { store, doc: docRef, collection: (p) => col(p),
    batch: () => { const ops = []; return { delete: (r) => ops.push(r), commit: async () => { for (const r of ops) await r.delete(); } }; },
    runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o) }) };
};
const NOW = new Date(2026, 9, 23, 20, 0); // Friday
let tick = 0; const sent = []; const deps = (db) => ({ db, now: () => new Date(NOW.getTime() + (++tick)), verify: async (tok) => ({ uid: tok.replace('idtok-', '') }), sendPush: async (p) => sent.push(p) });
const asUser = (db, uid, body) => rawHandler({ httpMethod: 'POST', headers: { authorization: `Bearer idtok-${uid}` }, body: JSON.stringify(body) }, {}, deps(db));
const asManager = (db, body) => rawHandler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) }, {}, deps(db));
const view = (db, token) => rawHandler({ httpMethod: 'GET', headers: {}, queryStringParameters: { token } }, {}, deps(db));
const J = (r) => JSON.parse(r.body);

(async () => {
  await t('helpers: token shape, hash, pairId, code alphabet, overdue', () => {
    const tok = M.newToken(); assert(M.validTokenShape(tok)); assert.strictEqual(M.hashToken(tok).length, 64); assert.notStrictEqual(M.newToken(), tok);
    assert.strictEqual(M.pairId('b', 'a'), 'a_b'); assert.strictEqual(M.pairId('a', 'b'), 'a_b');
    assert(/^[A-HJ-NP-Z2-9]{8}$/.test(M.newPalCode()));
    assert(M.isOverdue({ title: 'x' }, 'Monday', NOW)); assert(!M.isOverdue({ title: 'x', completed: true }, 'Monday', NOW));
    assert(!M.isOverdue({ title: 'x' }, 'Saturday', NOW)); assert(M.isOverdue({ title: 'x', reminder: { date: '2026-10-23', time: '09:00' } }, 'Friday', NOW));
  });
  const db = makeDb();
  db.store.set('publicProfiles/zztestU', { name: 'ZZTEST Tacanda' }); db.store.set('publicProfiles/zztestP', { name: 'ZZTEST Pal' });
  db.store.set('weeklyRoutines/zztestU_Monday', { tasks: [{ id: 't1', title: 'ZZTEST late', notes: 'private' }, { id: 't2', title: 'ZZTEST done', completed: true }] });
  db.store.set('weeklyRoutines/zztestU_Saturday', { tasks: [{ id: 't3', title: 'ZZTEST later' }] });
  let token;
  await t('owner creates link; only the sha256 hash is stored', async () => {
    const r = await asUser(db, 'zztestU', { action: 'createManagerLink', name: 'Mom' }); assert.strictEqual(r.statusCode, 200); token = J(r).token;
    assert(!JSON.stringify([...db.store.values()]).includes(token)); assert.strictEqual(db.store.get(`managerLinks/${M.hashToken(token)}`).uid, 'zztestU');
  });
  await t('manager view: read-only tasks, overdue first, no private fields', async () => {
    const r = await view(db, token); assert.strictEqual(r.statusCode, 200); const d = J(r);
    assert.strictEqual(d.ownerName, 'ZZTEST Tacanda'); assert.strictEqual(d.managerName, 'Mom');
    assert.deepStrictEqual(d.tasks.map((x) => x.key), ['t1', 't3', 't2']); assert(d.tasks[0].overdue); assert(!r.body.includes('private'));
    assert.strictEqual(r.headers['Cache-Control'], 'no-store');
  });
  await t('bad / guessed tokens get 404', async () => {
    assert.strictEqual((await view(db, 'nope')).statusCode, 404); assert.strictEqual((await view(db, M.newToken())).statusCode, 404);
  });
  await t('nudge a task + DM: lands in the owner inbox, push sent to owner only', async () => {
    let r = await asManager(db, { token, action: 'nudge', taskKey: 't1', preset: 'remind' }); assert.strictEqual(r.statusCode, 200);
    r = await asManager(db, { token, action: 'dm', text: 'ZZTEST hi sweetie' }); assert.strictEqual(r.statusCode, 200);
    const inbox = [...db.store.entries()].filter(([k]) => k.startsWith('users/zztestU/managerChat/')).map(([, v]) => v);
    assert.strictEqual(inbox.length, 2); assert.strictEqual(inbox[0].taskTitle, 'ZZTEST late'); assert(inbox.every((x) => x.from === 'manager' && x.read === false));
    assert.strictEqual(sent.length, 2); assert.deepStrictEqual(sent[0].include_aliases.external_id, ['zztestU']);
    assert.strictEqual((await asManager(db, { token, action: 'nudge', taskKey: 'nope' })).statusCode, 404);
    assert.strictEqual((await asManager(db, { token, action: 'deleteTask' })).statusCode, 400);
  });
  await t('owner replies; manager sees the thread', async () => {
    assert.strictEqual((await asUser(db, 'zztestU', { action: 'reply', text: 'ZZTEST on it' })).statusCode, 200);
    const d = J(await view(db, token)); assert.deepStrictEqual(d.chat.map((c) => c.from), ['manager', 'manager', 'user']);
  });
  await t('hourly write cap', async () => {
    db.store.set('managers/zztestU', { ...db.store.get('managers/zztestU'), writes: { hour: Math.floor(NOW.getTime() / 3600000), n: 40 } });
    assert.strictEqual((await asManager(db, { token, action: 'dm', text: 'x' })).statusCode, 429);
  });
  await t('rotate + revoke kill the old link', async () => {
    const t2 = J(await asUser(db, 'zztestU', { action: 'createManagerLink' })).token;
    assert.strictEqual((await view(db, token)).statusCode, 404); const v2 = await view(db, t2); assert.strictEqual(J(v2).managerName, 'Mom');
    await asUser(db, 'zztestU', { action: 'revokeManager' }); assert.strictEqual((await view(db, t2)).statusCode, 404);
  });
  await t('pal invite -> accept -> remove (either side), code single-use, no self-pairing', async () => {
    const { code } = J(await asUser(db, 'zztestU', { action: 'createPalCode' }));
    assert.strictEqual((await asUser(db, 'zztestU', { action: 'acceptPal', code })).statusCode, 400);
    const r = J(await asUser(db, 'zztestP', { action: 'acceptPal', code: code.toLowerCase() })); assert.strictEqual(r.palUid, 'zztestU');
    const pair = db.store.get('pals/zztestP_zztestU'); assert.deepStrictEqual(pair.members, ['zztestP', 'zztestU']);
    assert.strictEqual((await asUser(db, 'zztestX', { action: 'acceptPal', code })).statusCode, 404);
    db.store.set('pals/zztestP_zztestU/messages/m1', { from: 'zztestP', text: 'hi' });
    assert.strictEqual((await asUser(db, 'zztestX', { action: 'removePal', palUid: 'zztestU' })).statusCode, 404);
    assert.strictEqual((await asUser(db, 'zztestU', { action: 'removePal', palUid: 'zztestP' })).statusCode, 200);
    assert(!db.store.has('pals/zztestP_zztestU') && !db.store.has('pals/zztestP_zztestU/messages/m1'));
  });
  await t('expired code rejected; bad auth 401; CORS wrapped', async () => {
    db.store.set('palInvites/ZZTESTAB', { uid: 'zztestU', expiresAt: new Date(NOW.getTime() - 1) });
    assert.strictEqual((await asUser(db, 'zztestP', { action: 'acceptPal', code: 'ZZTESTAB' })).statusCode, 404);
    const r = await rawHandler({ httpMethod: 'POST', headers: { authorization: 'Bearer x' }, body: '{}' }, {}, { db, verify: async () => { throw new Error('bad'); } }); assert.strictEqual(r.statusCode, 401);
    assert.strictEqual((await handler({ httpMethod: 'OPTIONS', headers: { origin: 'capacitor://localhost' } })).statusCode, 204);
  });
  await t('rules: pal/manager collections present, manager writes server-only', () => {
    const rules = require('fs').readFileSync(require('path').join(__dirname, '../firestore.rules'), 'utf8');
    for (const s of ['match /managers/{uid}', 'match /managerLinks/{hash} { allow read, write: if false; }', 'match /palInvites/{code} { allow read, write: if false; }', 'match /users/{uid}/managerChat/{msgId}', 'match /pals/{pairId}', 'match /messages/{msgId}', 'isPalOf(routineId.split']) assert(rules.includes(s), s);
  });
})().catch((e) => { console.error(e); process.exit(1); });
