// Run: node scripts/test-ics.js  (iCalendar builder + feed function with a fake Firestore)
const path = require('path'); const fs = require('fs'); const os = require('os'); const assert = require('assert');
(async () => {
const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ics-')), 'ics.mjs'); fs.copyFileSync(path.join(__dirname, '../src/utils/ics.js'), f);
const I = await import(f);
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const now = new Date('2026-10-21T14:00:00Z');
await t('all-day and timed events (floating local time)', () => {
  const c = I.buildCalendar([{ uid: 'a', title: 'Dentist, 3pm; bring card', date: '2026-10-30', time: '15:00', minutes: 45 }, { uid: 'b', title: 'Pay rent', date: '2026-11-01' }], 'x', now);
  assert.match(c, /^BEGIN:VCALENDAR\r\n/); assert.match(c, /END:VCALENDAR\r\n$/);
  assert.match(c, /DTSTART:20261030T150000\r\n/); assert.match(c, /DTEND:20261030T154500\r\n/); assert.ok(!/DTSTART:\d+T\d+Z/.test(c), 'no UTC Z');
  assert.match(c, /SUMMARY:Dentist\\, 3pm\\; bring card/); assert.match(c, /DTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261102/);
});
await t('line folding', () => { const c = I.buildCalendar([{ uid: 'a', title: 'x'.repeat(200), date: '2026-10-30' }]); assert.ok(c.split('\r\n').every((l) => l.length <= 75)); });
await t('feed events: scheduled, recurring RRULE, due-dated, skips completed/instances', () => {
  const ev = I.feedEvents([{ id: 's1', title: 'Report', scheduledDate: '2026-10-30' }, { id: 'tpl', title: 'Trash', startDate: '2026-10-20', recurrence: { freq: 'weekly', days: [2] } }, { id: 'tpl_2026-10-27', templateId: 'tpl', title: 'Trash', scheduledDate: '2026-10-27' }],
    { Monday: [{ title: 'Taxes', dueDate: '2026-11-15', createdAt: 'c1' }, { title: 'Done', dueDate: '2026-11-15', completed: true }, { title: 'Report', dueDate: '2026-10-30', scheduledId: 's1' }, { title: 'No date' }] });
  assert.deepEqual(ev.map((e) => e.title), ['Report', 'Trash', 'Taxes']); assert.equal(ev[1].rrule, 'FREQ=WEEKLY;BYDAY=TU');
  assert.equal(I.rruleFor({ freq: 'monthly', dayOfMonth: 31 }), 'FREQ=MONTHLY;BYMONTHDAY=31');
});
await t('single task .ics', () => { const c = I.taskIcs({ title: 'Call', scheduledFor: '2026-10-30', startTime: '09:30', createdAt: '2026-10-21T10:00:00.000Z' }, '2026-10-21', now); assert.match(c, /DTSTART:20261030T093000/); assert.match(I.taskIcs({ title: 'X' }, '2026-10-21', now), /DTSTART;VALUE=DATE:20261021/); });
await t('token format', () => { assert.ok(I.isValidToken('a'.repeat(48))); assert.ok(!I.isValidToken('../x')); assert.ok(!I.isValidToken('A'.repeat(48))); });
await t('feed function: valid token -> calendar, unknown/revoked/bad -> 404', async () => {
  const fn = require(path.join(__dirname, '../netlify/functions/calendar.js'));
  const good = 'b'.repeat(48);
  const data = { [`icsTokens/${good}`]: { uid: 'u1' }, 'users/u1': { isPro: true, plan: 'yearly', scheduledTasks: { tasks: [{ id: 's', title: 'Report', scheduledDate: '2026-10-30' }] }, email: 'secret@x.com' } };
  const db = { doc: (p) => ({ get: async () => ({ exists: p in data, data: () => data[p] }) }) };
  const ok = await fn.handler({ httpMethod: 'GET', queryStringParameters: { token: good } }, {}, { db });
  assert.equal(ok.statusCode, 200); assert.match(ok.headers['Content-Type'], /text\/calendar/); assert.match(ok.body, /SUMMARY:Report/); assert.ok(!ok.body.includes('secret@x.com'));
  assert.equal((await fn.handler({ httpMethod: 'GET', queryStringParameters: { token: 'c'.repeat(48) } }, {}, { db })).statusCode, 404);
  assert.equal((await fn.handler({ httpMethod: 'GET', queryStringParameters: { token: '../users' } }, {}, { db })).statusCode, 404);
  data[`icsTokens/${'d'.repeat(48)}`] = { uid: 'u2' }; data['users/u2'] = { isPro: false, plan: 'free' };
  assert.equal((await fn.handler({ httpMethod: 'GET', queryStringParameters: { token: 'd'.repeat(48) } }, {}, { db })).statusCode, 402);
  assert.equal((await fn.handler({ httpMethod: 'POST', queryStringParameters: {} }, {}, { db })).statusCode, 405);
});
console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
