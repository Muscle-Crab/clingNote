// Run: node scripts/test-voice-intent.mjs — local voice interpreter (tasks / reminders / schedule blocks). Fixed "now": Mon 2026-10-26 10:00 local.
import assert from 'assert';
import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vi-')), 'vi.mjs'); fs.copyFileSync(path.join(here, '../src/utils/voiceIntent.js'), f);
const V = await import(f);
const now = new Date(2026, 9, 26, 10, 0);
const T = (title, o = {}) => ({ type: 'task', title, date: '2026-10-26', start: '', durationMin: 0, remindAt: '', ...o });
const R = (title, date, start) => ({ type: 'reminder', title, date, start, durationMin: 0, remindAt: `${date}T${start}` });
const S = (title, date, start, durationMin) => ({ type: 'schedule', title, date, start, durationMin, remindAt: '' });
const CASES = [
  ['buy milk', [T('Buy milk')]],
  ['Gym at 6 pm for 45 minutes', [S('Gym', '2026-10-26', '18:00', 45)]],
  ['go to the store 6 PM', [T('Go to the store', { start: '18:00' })]], // timed task: the phone pings at 6 PM
  ['go to the store 9 am', [S('Go to the store', '2026-10-27', '09:00', 0)]], // 9 am passed -> tomorrow, a scheduled task
  ['remind me to call mom at 3', [R('Call mom', '2026-10-26', '15:00')]],
  ['remind me to take the pills in 20 minutes', [R('Take the pills', '2026-10-26', '10:20')]],
  ['remind me in an hour to stretch', [R('Stretch', '2026-10-26', '11:00')]],
  ['schedule 2 hours for homework tomorrow at 9 AM', [S('Homework', '2026-10-27', '09:00', 120)]],
  ['block the evening for the essay', [S('The essay', '2026-10-26', '18:00', 180)]],
  ['remind me to call mom after lunch and block the evening for the essay', [R('Call mom', '2026-10-26', '13:00'), S('The essay', '2026-10-26', '18:00', 180)]],
  ['schedule dentist next Monday at 2:30 pm for an hour', [S('Dentist', '2026-11-02', '14:30', 60)]],
  ['study for 90 minutes on friday at 4pm', [S('Study', '2026-10-30', '16:00', 90)]],
  ['book 30 minutes for email this afternoon', [S('Email', '2026-10-26', '15:00', 30)]],
  ['remind me tomorrow to pay rent', [R('Pay rent', '2026-10-27', '09:00')]],
  ['add task clean the garage', [T('Clean the garage')]],
  ['buy milk and then call the bank', [T('Buy milk'), T('Call the bank')]],
  ['finish the report. email Sam', [T('Finish the report'), T('Email Sam')]],
  ['I need to renew my passport', [T('Renew my passport')]],
  ['schedule a run thursday morning', [S('A run', '2026-10-29', '09:00', 180)]],
  ['block out 1 and a half hours for reading tonight', [S('Reading', '2026-10-26', '20:00', 90)]],
  ['remind me at 7:15 am to walk the dog', [R('Walk the dog', '2026-10-27', '07:15')]],
  ["don't let me forget to water the plants at 8 pm", [R('Water the plants', '2026-10-26', '20:00')]],
  ['write blog post for 2 hours tomorrow', [S('Write blog post', '2026-10-27', '09:00', 120)]],
  ['meeting with Ana on wednesday at 11 am for 30 min', [S('Meeting with Ana', '2026-10-28', '11:00', 30)]],
  ['laundry, also remind me to call grandma at noon', [T('Laundry'), R('Call grandma', '2026-10-26', '12:00')]],
  ['schedule homework in 3 days at 5 pm for half an hour', [S('Homework', '2026-10-29', '17:00', 30)]],
];
let pass = 0; const fails = [];
for (const [say, want] of CASES) {
  const got = V.parseUtterance(say, now);
  try { assert.deepStrictEqual(got, want); pass++; console.log('ok -', say); }
  catch (e) { fails.push(say); console.log('FAIL -', say, '\n   got ', JSON.stringify(got), '\n   want', JSON.stringify(want)); }
}
// normalizeItems guards AI output
const n = V.normalizeItems([{ type: 'hack', title: ' X ', date: 'bad', start: '25:00' }, { type: 'reminder', title: 'Y', date: '2026-10-27' }, { title: '' }], now);
assert.deepStrictEqual(n, [T('X'), R('Y', '2026-10-27', '09:00')]); pass++;
console.log(`${pass}/${CASES.length + 1} passed (phrasings ${CASES.length - fails.length}/${CASES.length})`);
if (fails.length) process.exit(1);
