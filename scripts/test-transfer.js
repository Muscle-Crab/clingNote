// Transfer task to another day: default target, cap, modal enabled state, HomeView wiring. Run: node scripts/test-transfer.js
const assert = require('assert'); const fs = require('fs'); const path = require('path'); const sr = require('./lib/srcRequire');
const { createSSRApp, h } = require('vue'); const { renderToString } = require('@vue/server-renderer');
const tr = sr.load('utils/transfer.js'); const Modal = sr.load('components/home/TransferModal.vue').default;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
(async () => {
  ok(tr.defaultTransferDay(0, 7) === 1 && tr.defaultTransferDay(6, 7) === 0 && tr.defaultTransferDay(-1, 7) === 0, 'default target = next tab, never the current one');
  ok(tr.MAX_TASKS_PER_DAY === 50 && tr.transferFits(49) && !tr.transferFits(50), 'cap 50 on the target day');
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({ day, date: '' }));
  const r = (props) => renderToString(createSSRApp({ render: () => h(Modal, { days, selectedDayIndex: 0, day: 1, ...props }) }));
  let html = await r({ strict: false, reason: '' });
  ok(!/<button[^>]*disabled[^>]*>Transfer/.test(html), 'non-strict: Transfer enabled with empty reason');
  html = await r({ strict: true, reason: '' });
  ok(/<button[^>]*disabled[^>]*>Transfer/.test(html) && /at least 8 characters/.test(html), 'strict: disabled until a reason, with a hint saying why');
  html = await r({ strict: true, reason: 'traffic jam today' });
  ok(!/<button[^>]*disabled[^>]*>Transfer/.test(html) && !/at least 8/.test(html), 'strict: valid reason enables Transfer');
  const home = fs.readFileSync(path.join(__dirname, '../src/views/HomeView.vue'), 'utf8');
  ok(/openTransferModal = \(index\) => \{[\s\S]*?selectedTransferDay\.value = defaultTransferDay\(/.test(home), 'opening the modal preselects a target day');
  const fn = home.slice(home.indexOf('const transferTask'), home.indexOf('const resetTasksToIncomplete'));
  ok(/taskKey\(t\) === key/.test(fn) && /mutateDay\(currentDay/.test(fn) && /mutateDay\(targetDay/.test(fn), 'moves by task identity in transactions');
  ok(/transferFits\(/.test(fn) && /blockIfLocked\(currentDayIndex\) \|\| blockIfLocked\(targetDayIndex\)/.test(fn), 'cap + active-lock checks');
  console.log(`transfer: ${n} checks passed`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
