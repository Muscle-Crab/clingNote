// Run: node scripts/test-future-placement.mjs  (a task dated in a later week lands in that week, not today's list)
import path from 'path'; import fs from 'fs'; import os from 'os'; import assert from 'assert'; import { fileURLToPath } from 'url';
process.env.TZ = 'America/New_York';
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'place-'));
for (const f of fs.readdirSync(path.join(here, '../src/utils')).filter((x) => x.endsWith('.js'))) fs.writeFileSync(path.join(dir, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(here, '../src/utils', f), 'utf8').replace(/from '\.\/([\w-]+)\.js'/g, "from './$1.mjs'").replace(/from '\.\/([\w-]+)'/g, "from './$1.mjs'").replace(/from '@\/utils\/([\w-]+)'/g, "from './$1.mjs'"));
const S = await import(path.join(dir, 'scheduling.mjs'));
import { createRequire } from 'module';
const T = createRequire(import.meta.url)('./lib/srcRequire').load('utils/assistantTools.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const TODAY = '2026-10-26', NOV16 = '2026-11-16';
const ZZ = { title: 'ZZTEST future task', userId: 'ZZTEST' };

t('future date is deferred to its own date; today/past/empty are not', () => {
  assert.equal(S.deferredDateFor(NOV16, TODAY), NOV16);
  assert.equal(S.deferredDateFor(TODAY, TODAY), ''); assert.equal(S.deferredDateFor('2026-10-01', TODAY), ''); assert.equal(S.deferredDateFor('', TODAY), '');
});
t('Nov 16 2026 belongs to week Mon Nov 16 – Sun Nov 22, not this week', () => {
  assert.deepEqual(S.weekOfTask(NOV16), { monday: '2026-11-16', sunday: '2026-11-22' });
  assert.notEqual(S.mondayOf(NOV16), S.mondayOf(TODAY));
});
t('scheduled entry is hidden today and materializes only on Nov 16', () => {
  const e = S.buildScheduledEntry(ZZ, S.deferredDateFor(NOV16, TODAY), '');
  const today = S.materializeDue({ scheduled: [e], todayStr: TODAY, todayTasks: [], nowIso: '2026-10-26T19:00:00.000Z' });
  assert.equal(today.toAdd.length, 0); assert.equal(S.dueOf([e], TODAY).length, 0); assert.equal(S.futureOf([e], TODAY).length, 1);
  assert.equal(S.materializeDue({ scheduled: [e], todayStr: '2026-11-15', todayTasks: [], nowIso: '2026-11-15T12:00:00.000Z' }).toAdd.length, 0);
  const on = S.materializeDue({ scheduled: [e], todayStr: NOV16, todayTasks: [], nowIso: '2026-11-16T12:00:00.000Z' });
  assert.equal(on.toAdd.length, 1); assert.equal(on.toAdd[0].scheduledFor, NOV16); assert.equal(on.toAdd[0].completed, false);
});
t('assistant create_tasks keeps the Nov 16 date (so HomeView routes it to the scheduler)', () => {
  const r = T.validateCall('create_tasks', { items: [{ title: 'ZZTEST dentist', date: NOV16 }] }, { today: TODAY });
  assert.ok(r.ok); assert.equal(r.args.items[0].date, NOV16); assert.equal(S.deferredDateFor(r.args.items[0].date, TODAY), NOV16);
});
t('HomeView routes future-dated manual / assistant / voice adds through deferredDateFor', () => {
  const src = fs.readFileSync(path.join(here, '../src/views/HomeView.vue'), 'utf8');
  assert.ok(/deferredDateFor\(newTask\.value\.dueDate, getTodayId\(\)\)/.test(src), 'manual add');
  assert.ok((src.match(/deferredDateFor\(it\.date, getTodayId\(\)\)/g) || []).length >= 4, 'assistant + voice');
});
console.log(`\n${n} future-placement tests passed`);
