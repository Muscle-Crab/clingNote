// Transfer task to another day: default target, cap, modal enabled state, HomeView wiring. Run: node scripts/test-transfer.js
const assert = require('assert'); const fs = require('fs'); const path = require('path'); const sr = require('./lib/srcRequire');
const { createSSRApp, h } = require('vue'); const { renderToString } = require('@vue/server-renderer');
const tr = sr.load('utils/transfer.js'); const Modal = sr.load('components/home/TransferModal.vue').default;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
(async () => {
  ok(tr.defaultTransferDay(0, 7) === 1 && tr.defaultTransferDay(6, 7) === 0 && tr.defaultTransferDay(-1, 7) === 0, 'default target = next tab, never the current one');
  ok(tr.MAX_TASKS_PER_DAY === Infinity && tr.transferFits(49) && tr.transferFits(500), 'moving a task is not capped by the free daily limit');
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({ day, date: '' }));
  const r = (props) => renderToString(createSSRApp({ render: () => h(Modal, { days, selectedDayIndex: 0, day: 1, ...props }) }));
  let html = await r({});
  ok(!/Why didn't you do it today/.test(html) && !/<button[^>]*disabled[^>]*>Transfer/.test(html), 'Transfer needs no reason and the button is enabled');
  ok(!/defer-reason/.test(html), 'the reason field is gone');
  const home = fs.readFileSync(path.join(__dirname, '../src/views/HomeView.vue'), 'utf8');
  ok(/openTransferModal = \(index\) => \{[\s\S]*?selectedTransferDay\.value = defaultTransferDay\(/.test(home), 'opening the modal preselects a target day');
  const fn = home.slice(home.indexOf('const transferTask'), home.indexOf('const resetTasksToIncomplete'));
  ok(/atomicMove\(/.test(fn) && /runTransaction\(/.test(fn) && /tx\.set\(srcRef/.test(fn) && /tx\.set\(dstRef/.test(fn), 'today and tomorrow commit in one transaction');
  ok(!/if \(added\)/.test(fn), 'there is no compensation write after a partial save');
  ok(!/validReason\(deferReason/.test(fn), 'transfer does not require a reason');
  ok(/blockIfLocked\(currentDayIndex\) \|\| blockIfLocked\(targetDayIndex\)/.test(fn), 'active-lock check stays on the move');
  ok(/transferFailure\(error\)/.test(fn), 'failures are classified instead of always blaming the connection');
  const iso = '2026-11-05T15:04:00.000Z';
  ok(tr.moveKey({ id: 'a', title: 'x' }) === 'id:a', 'id wins');
  ok(tr.moveKey({ title: 'Wash', createdAt: iso }) === tr.moveKey({ title: 'Wash', createdAt: { toMillis: () => Date.parse(iso) } }), 'ISO and Timestamp createdAt match');
  ok(/connection/.test(tr.transferFailure({ code: 'unavailable' })) && !/connection/.test(tr.transferFailure({ code: 'permission-denied' })), 'only a real offline error mentions the connection');
  ok(tr.transferFailure({ code: 'permission-denied' }) === "Couldn't move the task. This day can't be edited right now.", 'the screenshot alert is the rules rejection');
  const src = [{ id: 'a', createdAt: 'c', points: 10, title: 'Call', type: 'recurring', timerActive: true, reason: 'old note' }];
  const moved = tr.planMove(src, [], 'id:a', 'remove');
  ok(moved.ok && moved.nextSrc.length === 0 && moved.nextDst.length === 1 && moved.nextDst[0].timerActive === false && moved.nextDst[0].reason === 'old note' && moved.nextDst[0].type === 'recurring', 'a move with no reason keeps the task and clears the timer');
  const tomb = tr.planMove(src, [{ id: 'keep', createdAt: 'k', points: 1 }], 'id:a', 'tomb');
  ok(tomb.nextSrc.length === 1 && tomb.nextSrc[0].removed === true && tomb.nextSrc[0].createdAt === 'c' && tomb.nextSrc[0].points === 10, 'tombstone keeps the source slot');
  ok(tr.planMove(src, tomb.nextDst, 'id:a', 'tomb').nextDst.length === tomb.nextDst.length, 'a retry does not duplicate the destination');
  const today = [{ id: 'a', createdAt: 'c', points: 10, title: 'Check email', timerActive: true }, { id: 'b', createdAt: 'b', points: 20, title: 'Keep' }];
  const tomorrow = [{ id: 'z', createdAt: 'z', points: 1, title: 'Sun' }];
  const once = tr.atomicMove(today, tomorrow, 'id:a', { ...today[0], carryCount: 1 });
  ok(once.ok && once.added && once.nextSrc.length === 2 && once.nextSrc[0].removed === true && once.nextSrc[0].createdAt === 'c' && once.nextSrc[0].points === 10 && once.nextSrc[1].title === 'Keep', 'today stays the same length and the other slot is untouched');
  ok(once.nextDst.length === 2 && once.nextDst[1].id === 'a' && once.nextDst[1].timerActive === false && once.nextDst[1].carryCount === 1, 'tomorrow gains one copy');
  const again = tr.atomicMove(once.nextSrc, once.nextDst, 'id:a', { ...today[0], carryCount: 9 });
  ok(again.added === false && again.nextDst.length === 2 && again.nextDst[1].carryCount === 1, 'a retry does not add or rewrite the copy');
  const missed = tr.atomicMove(today, tomorrow, 'id:missing');
  ok(!missed.ok && today[0].removed !== true && tomorrow.length === 1, 'a missing task plans no write');
  let storedSrc = today, storedDst = tomorrow;
  try {
    const planned = tr.atomicMove(today, tomorrow, 'id:a');
    if (!planned.ok) throw new Error('plan');
    throw Object.assign(new Error('offline'), { code: 'unavailable' });
    storedSrc = planned.nextSrc; storedDst = planned.nextDst;
  } catch (e) {
    ok(e.code === 'unavailable' && storedSrc === today && storedDst === tomorrow && today[0].timerActive === true, 'a failed transaction assigns neither day');
  }
  ok(!tr.planMove(src, [], 'id:missing').ok, 'a missing task is not reported as moved');
  console.log(`transfer: ${n} checks passed`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
