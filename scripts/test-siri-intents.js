// Run: node scripts/test-siri-intents.js  (JS half of the Siri intents: what's next, start-timer queue)
const path = require('path'); const fs = require('fs'); const os = require('os');
process.env.TZ = 'America/New_York';
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'siri-'));
for (const f of fs.readdirSync(path.join(__dirname, '../src/utils')).filter((x) => x.endsWith('.js'))) fs.writeFileSync(path.join(dir, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(__dirname, '../src/utils', f), 'utf8').replace(/from '\.\/([\w]+)'/g, "from './$1.mjs'").replace(/from '@\/utils\/([\w]+)'/g, "from './$1.mjs'"));
const I = await import(path.join(dir, 'siriIntents.mjs')); const W = await import(path.join(dir, 'widgetSnapshot.mjs'));
const assert = require('assert'); let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const now = new Date(2026, 9, 27, 13, 5);
const tasks = [{ title: 'Inbox zero', createdAt: 'a' }, { title: 'Gym', startTime: '18:00', createdAt: 'b', estimateMin: 45 }, { title: 'Standup', startTime: '09:30', createdAt: 'c', completed: true }, { title: 'Lunch call', startTime: '13:30', createdAt: 'd' }, { title: 'Morning pages', startTime: '07:00', createdAt: 'e' }];
const snap = W.buildWidgetSnapshot(tasks, { now, dayName: 'Tue' });
t('whatsNext: next upcoming timed task', () => { assert.strictEqual(I.whatsNext(snap, now).title, 'Lunch call'); });
t('whatsNext: after the last timed task -> untimed open task', () => { assert.strictEqual(I.whatsNext(snap, new Date(2026, 9, 27, 19, 0)).title, 'Inbox zero'); });
t('whatsNext: only overdue timed -> earliest', () => { const s = W.buildWidgetSnapshot(tasks.filter((x) => x.startTime), { now }); assert.strictEqual(I.whatsNext(s, new Date(2026, 9, 27, 23, 0)).title, 'Morning pages'); });
t('whatsNextPhrase', () => {
  assert.strictEqual(I.whatsNextPhrase(snap, now), 'Next: Lunch call at 13:30. 4 tasks left today.');
  assert.strictEqual(I.whatsNextPhrase(W.buildWidgetSnapshot([{ title: 'x', completed: true }], { now }), now), 'You are done for today. Nice work.');
  assert.strictEqual(I.whatsNextPhrase(W.buildWidgetSnapshot([], { now }), now), 'Nothing planned for today yet.');
});
const ms = now.getTime();
t('pickTimerIntent: by task id, task estimate as default', () => {
  assert.deepStrictEqual(I.pickTimerIntent([{ taskId: W.widgetTaskId(tasks[1]), ts: ms - 1000 }], tasks, ms), { index: 1, minutes: 45, title: 'Gym' });
  assert.deepStrictEqual(I.pickTimerIntent([{ taskId: W.widgetTaskId(tasks[0]), minutes: 15, ts: ms }], tasks, ms), { index: 0, minutes: 15, title: 'Inbox zero' });
});
t('pickTimerIntent: no task -> what\'s next; default 25; clamp', () => {
  assert.deepStrictEqual(I.pickTimerIntent([{ ts: ms, minutes: 999 }], tasks, ms), { index: 3, minutes: 240, title: 'Lunch call' });
  assert.strictEqual(I.pickTimerIntent([{ ts: ms }], tasks, ms).minutes, 25);
});
t('pickTimerIntent: latest fresh wins, stale dropped, errors', () => {
  assert.strictEqual(I.pickTimerIntent([{ taskId: W.widgetTaskId(tasks[1]), ts: ms - 5000 }, { taskId: W.widgetTaskId(tasks[0]), ts: ms - 1000 }], tasks, ms).index, 0);
  assert.strictEqual(I.pickTimerIntent([{ ts: ms - 11 * 60000 }], tasks, ms), null);
  assert.strictEqual(I.pickTimerIntent([], tasks, ms), null);
  assert.ok(I.pickTimerIntent([{ taskId: 'nope', ts: ms }], tasks, ms).error);
  assert.ok(/already done/.test(I.pickTimerIntent([{ taskId: W.widgetTaskId(tasks[2]), ts: ms }], tasks, ms).error));
  assert.ok(/already running/.test(I.pickTimerIntent([{ taskId: W.widgetTaskId(tasks[0]), ts: ms }], [{ ...tasks[0], timerActive: true }], ms).error));
  assert.ok(I.pickTimerIntent([{ ts: ms }], [{ title: 'x', completed: true }], ms).error);
});
t('Swift and JS agree on the queue keys / id format', () => {
  const sw = fs.readFileSync(path.join(__dirname, '../ios/App/App/ClingIntents.swift'), 'utf8');
  const pl = fs.readFileSync(path.join(__dirname, '../ios/App/App/ClingNativePlugin.swift'), 'utf8');
  for (const k of ['"intent.timer"', '"widget.pending"', '"widget.today"', 'CompleteTaskSiriIntent', 'WhatsNextIntent', 'StartTimerIntent']) assert.ok(sw.includes(k), k);
  assert.ok(pl.includes('"intent.timer"') && pl.includes('name: "takeTimerIntents"'));
  assert.ok(/^[A-Za-z0-9_-]{1,64}$/.test(W.widgetTaskId(tasks[0])));
});
console.log(`\n${n} siri-intent tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
