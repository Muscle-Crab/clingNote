// Home task sections: boundaries, create default, drop resolution, order merge.
import assert from 'node:assert/strict';
import { sectionFromTime, sectionOf, sectionForCreate, resolveDrop, mergeOrder, headerKey, DEFAULT_COLLAPSED } from '../src/utils/taskSections.js';
assert.equal(sectionFromTime('11:59'), 'morning'); assert.equal(sectionFromTime('12:00'), 'noon');
assert.equal(sectionFromTime('14:59'), 'noon'); assert.equal(sectionFromTime('15:00'), 'afternoon'); assert.equal(sectionFromTime(''), null);
assert.equal(sectionOf({}), 'morning'); assert.equal(sectionOf({ startTime: '16:00' }), 'afternoon');
assert.equal(sectionOf({ startTime: '16:00', section: 'noon' }), 'noon');
assert.equal(sectionForCreate({}), 'morning'); assert.equal(sectionForCreate({ section: 'noon' }), 'noon');
assert.equal(sectionForCreate({ start: '08:00', section: 'afternoon' }), 'morning');
const H = (s) => headerKey(s); const keys = [H('morning'), 'a', 'b', H('noon'), H('afternoon'), 'c'];
assert.equal(resolveDrop(keys, 1, 3).section, 'noon');      // a dropped right below collapsed Noon header
assert.equal(resolveDrop(keys, 1, 4).section, 'afternoon');
assert.equal(resolveDrop(keys, 5, 0).section, 'morning');   // above every header
assert.equal(resolveDrop(keys, 1, 2).section, 'morning');   // within section
const full = [{ k: 'a' }, { k: 'x' }, { k: 'b' }, { k: 'c' }];
assert.deepEqual(mergeOrder(full, ['b', 'a', 'c'], (t) => t.k, 'a').map((t) => t.k).filter((k) => k !== 'x'), ['b', 'a', 'c']);
assert.deepEqual(DEFAULT_COLLAPSED, { morning: false, noon: true, afternoon: true });
console.log('ok test-task-sections');
