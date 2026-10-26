// Run: node scripts/test-voice-multi.mjs — long multi-part dictation -> several separate items. Fixed "now": Mon 2026-10-26 10:00 local.
import assert from 'assert';
import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vm-')), 'vi.mjs'); fs.copyFileSync(path.join(here, '../src/utils/voiceIntent.js'), f);
const V = await import(f);
const now = new Date(2026, 9, 26, 10, 0);
const T = (title, o = {}) => ({ type: 'task', title, date: '2026-10-26', start: '', durationMin: 0, remindAt: '', ...o });
const R = (title, date, start) => ({ type: 'reminder', title, date, start, durationMin: 0, remindAt: `${date}T${start}` });
const S = (title, date, start, durationMin) => ({ type: 'schedule', title, date, start, durationMin, remindAt: '' });
const CASES = [
  ['um so I need to buy groceries and then I have to call the dentist and after that clean my room', [T('Buy groceries'), T('Call the dentist'), T('Clean my room')]],
  ['first email the landlord, second pay the electric bill, finally book a haircut', [T('Email the landlord'), T('Pay the electric bill'), T('Book a haircut')]],
  ['finish the slides. then send them to Maria. also remind me to call dad at 7 pm', [T('Finish the slides'), T('Send them to Maria'), R('Call dad', '2026-10-26', '19:00')]],
  ['I need to do laundry, then I want to study for 2 hours tomorrow at 3 pm, and remind me to take out the trash tonight', [T('Do laundry'), S('Study', '2026-10-27', '15:00', 120), R('Take out the trash', '2026-10-26', '20:00')]],
  ['next I have to water the plants and next feed the cat', [T('Water the plants'), T('Feed the cat')]],
  ['number one renew my passport number two pick up the dry cleaning', [T('Renew my passport'), T('Pick up the dry cleaning')]],
  ['buy milk, eggs and bread', [T('Buy milk, eggs and bread')]],
  ['go for a run for 30 minutes, after that shower, then make breakfast', [T('Go for a run', { durationMin: 30 }), T('Shower'), T('Make breakfast')]],
  ["okay so basically I'm going to clean the kitchen and I also need to vacuum the living room", [T('Clean the kitchen'), T('Vacuum the living room')]],
  ['schedule gym tomorrow at 6 pm for an hour and then remind me to stretch at 8 pm tomorrow', [S('Gym', '2026-10-27', '18:00', 60), R('Stretch', '2026-10-27', '20:00')]],
  ['uh write the essay intro. uh, read chapter five. um, outline the conclusion', [T('Write the essay intro'), T('Read chapter five'), T('Outline the conclusion')]],
  ['meeting with Sam next Monday at 2 pm for 30 minutes then prep the agenda', [S('Meeting with Sam', '2026-11-02', '14:00', 30), T('Prep the agenda')]],
  ["I should call the bank. Don't let me forget to pay rent tomorrow. Also book flights", [T('Call the bank'), R('Pay rent', '2026-10-27', '09:00'), T('Book flights')]],
  ['make sure to back up my laptop and then plus update my phone', [T('Back up my laptop'), T('Update my phone')]],
  ['firstly reply to emails secondly review the budget thirdly plan the trip', [T('Reply to emails'), T('Review the budget'), T('Plan the trip')]],
  ['clean the garage for 2 hours this afternoon, afterwards wash the car', [S('Clean the garage', '2026-10-26', '15:00', 120), T('Wash the car')]],
  ['so yeah I gotta fix the bike and I need to buy a new helmet and then I should ride to work', [T('Fix the bike'), T('Buy a new helmet'), T('Ride to work')]],
];
let pass = 0; const fails = [];
for (const [say, want] of CASES) {
  const got = V.parseUtterance(say, now);
  try { assert.deepStrictEqual(got, want); pass++; console.log('ok -', say); }
  catch (e) { fails.push(say); console.log('FAIL -', say, '\n   got ', JSON.stringify(got), '\n   want', JSON.stringify(want)); }
}
// cap: a very long ramble never yields more than MAX_ITEMS items
const many = Array.from({ length: 25 }, (_, i) => `do chore ${i + 1}`).join(' and then ');
assert.strictEqual(V.parseUtterance(many, now).length, V.MAX_ITEMS); pass++;
console.log(`${pass}/${CASES.length + 1} passed (multi-item ${CASES.length - fails.length}/${CASES.length})`);
if (fails.length) process.exit(1);
