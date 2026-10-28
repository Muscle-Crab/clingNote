import assert from 'assert';
import { localYMD, lastOccurrenceYMD, isStaleCompletion } from '../src/utils/localDate.js';
const late = new Date(2026, 9, 25, 21, 30); // Sun 9:30PM local
assert.equal(localYMD(late), '2026-10-25');
assert.equal(lastOccurrenceYMD(0, late), '2026-10-25');
assert.equal(lastOccurrenceYMD(6, late), '2026-10-24');
assert.equal(lastOccurrenceYMD(1, late), '2026-10-19');
assert.equal(isStaleCompletion({ completed: true, completedAt: new Date(2026, 9, 25, 8).toISOString() }, 0, late), false);
assert.equal(isStaleCompletion({ completed: true, completedAt: new Date(2026, 9, 18, 23).toISOString() }, 0, late), true);
assert.equal(isStaleCompletion({ completed: true }, 0, late), false);
console.log('test-local-date: ok');
