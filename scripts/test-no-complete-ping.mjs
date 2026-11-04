// Completing a task never sends a notification; the "created" push and all other notifications stay.
import fs from 'fs'; import assert from 'assert';
const home = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
const n = fs.readFileSync(new URL('../src/composables/useNotifications.js', import.meta.url), 'utf8');
assert.ok(!/sendNotificationToPlayer\([^)]*['"]completed['"]/.test(home), 'no completed push from Home');
assert.ok(!/Task Completed/.test(n), 'no "Task Completed" message');
assert.ok(/sendNotificationToPlayer\(n, 'created'\)/.test(home) && /created: \['New Task Alert'/.test(n), 'created push unchanged');
console.log('no complete ping: 3 passed');
