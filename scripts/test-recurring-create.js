// Run: node scripts/test-recurring-create.js  (create a task as recurring: Recurring checkbox next to the title, also per voice item)
// Regression: "add task as recurring is not working". The only visible repeat control was Schedule -> Repeat, which saves a template
// that is never written into a locked day and has no card on other day tabs (and the Repeating list was removed), so nothing showed.
const assert = require('assert'); const fs = require('fs'); const rd = (f) => fs.readFileSync(require.resolve('../' + f), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const modal = rd('src/components/home/AddTaskModal.vue'); const voice = rd('src/components/home/VoiceModal.vue'); const home = rd('src/views/HomeView.vue');
t('Recurring checkbox sits in the same row as the title input', () => {
  assert(/<div class="nt-title-row"><input id="nt-name"[^>]*>\s*<label class="nt-recur"[^>]*><input type="checkbox" data-test="nt-recur"[^>]*\/> Recurring<\/label>/.test(modal));
  assert(/repeatMode = \$event\.target\.checked \? 'daily' : 'once'/.test(modal), 'checked = every day, unchecked = one-time');
  assert(/v-if="!newTask\.sched\?\.on && repeatMode !== 'once'"/.test(modal), 'repeat-days choice only when Recurring is checked');
});
t('repeatMode daily -> type recurring on all 7 days; once -> one-time', () => {
  const m = home.match(/const repeatMode = computed\(\{[\s\S]*?\n\}\);/)[0];
  assert(/v === 'once'\) \{ newTask\.value\.type = 'one-time'; newTask\.value\.selectedDays = \[\]/.test(m));
  assert(/v === 'daily'\) \{ newTask\.value\.type = 'recurring'; newTask\.value\.selectedDays = \[\.\.\.days\]/.test(m));
});
t('recurring adds are not deferred to a single date (day-tab deferTo change)', () => {
  assert(/newTask\.value\.type !== 'recurring' && !\(newTask\.value\.selectedDays \|\| \[\]\)\.length \? deferTo/.test(home));
});
t('voice review: Recurring checkbox per item, default every day, saved as recurring copies', () => {
  assert(/<div class="vc-row vc-title-row"><input v-model="it\.title"[^>]*\/>\s*<label[^>]*class="vc-recur"><input type="checkbox" data-test="voice-recur"/.test(voice));
  assert(/it\.repeatDays = on \? \[0, 1, 2, 3, 4, 5, 6\] : \[\]/.test(voice));
  assert(/it\.recurring && it\.type !== 'schedule' && \(it\.repeatDays \|\| \[\]\)\.length \? \{ type: 'recurring', selectedDays: it\.repeatDays\.map\(\(k\) => days\[k\]\)/.test(home));
});
t('Schedule -> Repeat on a locked day tells the user instead of closing silently', () => {
  assert(/isDayLocked\(todayDayName\(\)\) && sc\.date <= getTodayId\(\)\) showNoteToast/.test(home));
});
console.log(`recurring create: ${n} passed`);
