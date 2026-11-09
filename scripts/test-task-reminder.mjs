// Add reminder sheet: iOS time values, past times, and a save path that reports the real error.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reminderCheck, normalizeTime } from '../src/utils/taskReminder.js';

const now = new Date(2026, 10, 9, 10, 0, 0);
assert.equal(normalizeTime('09:30:00'), '09:30');
assert.equal(normalizeTime('9:30 AM'), '09:30');
assert.equal(normalizeTime('9:30 PM'), '21:30');
assert.equal(reminderCheck({ date: '2026-11-09', time: '09:30' }, now).error, 'That time has already passed.');
const later = reminderCheck({ date: '2026-11-09', time: '11:15:00' }, now);
assert.equal(later.ok, true);
assert.equal(later.time, '11:15');
assert.equal(reminderCheck({ date: '2026-11-09', time: '09:30', repeat: 'daily' }, now).ok, true);
assert.equal(reminderCheck({ date: '', time: '09:30' }, now).error, 'Enter a date and a time.');
assert.equal(reminderCheck({ date: '11/09/2026', time: '09:30' }, now).error, 'Enter a date and a time.');

const home = readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
const sheet = readFileSync(new URL('../src/components/home/ReminderModal.vue', import.meta.url), 'utf8');
const save = home.slice(home.indexOf('const handleAddReminder'), home.indexOf('const daySession'));
assert.match(save, /reminderCheck\(reminder\.value/);
assert.match(save, /editTask\(index, task, \{ reminder: saved \}\)/);
assert.match(save, /showNoteToast\(reminderError\.value/);
assert.doesNotMatch(save, /tasks\[selectedTaskIndex/);
assert.match(sheet, /min-width:\s*0/);
assert.match(sheet, /input\[type="date"\]\.field-input, input\[type="time"\]\.field-input/);
assert.match(sheet, /data-test="reminder-error"/);
console.log('task reminder: iOS time, past time, save errors, input fit');
