// What's next / roll a task e2e. MODE=before (base build 39 on :8521) or after (feat/whats-next on :8520). ZZTEST only.
// Requires the local harness lib (emulators 9519/8519, dist on 8520/8521, fn server 8999): REPO=... node -e or copy lib.js beside this file. Build dist with VUE_APP_FIREBASE_EMULATORS=1 VUE_APP_EMU_AUTH_PORT=9519 VUE_APP_EMU_FS_PORT=8519.
const L = require('./lib'); const { ok, sleep } = L;
const MODE = process.env.MODE || 'after'; const B = MODE === 'before' ? 'http://localhost:8521' : L.B;
const shot = (p, n) => p.screenshot({ path: `/workspace/plan-shots/next/${MODE}-${L.BR}-${n}.png` });
const hold = async (p) => { const b = p.locator('[data-test=assistant-bubble]'); const bb = await b.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await sleep(900); await p.mouse.up(); await sleep(300); };
const toast = async (p) => ((await p.locator('[data-test=note-toast]').count()) ? (await p.textContent('[data-test=note-toast]')).trim() : '');
(async () => {
  const br = await L.chromium.launch();
  const now = new Date(); const pad = (n) => String(n).padStart(2, '0'); const past = `${pad(Math.max(0, now.getHours() - 1))}:00`;
  const ts = Date.now();
  const tasks = [
    { title: 'ZZTEST Big report', createdAt: new Date(ts - 3000).toISOString(), points: 60, estimateMin: 60, minutes: 60, startTime: past },
    { title: 'ZZTEST Quick email', createdAt: new Date(ts - 2000).toISOString(), points: 10, estimateMin: 10, minutes: 10 },
    { title: 'ZZTEST Done thing', createdAt: new Date(ts - 1000).toISOString(), points: 20, completed: true },
  ];
  const email = `zztest.next.${MODE}.${L.BR}@example.com`; const uid = await L.seedUser(email, 'ZZTEST Next');
  await L.db.doc(`weeklyRoutines/${uid}_${L.todayName()}`).set({ day: L.todayName(), tasks }, { merge: false });
  const p = await L.newPage(br, { label: MODE }); p.on('dialog', (d) => d.dismiss().catch(() => {}));
  await (async () => { await p.goto(B + '/login?returning=1'); await p.click('[data-test=email-toggle]'); await p.fill('[data-test=login-email]', email); await p.fill('input[autocomplete=current-password]', 'zztest-pass-123'); await p.click('[data-test=email-login]'); await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }); })();
  await p.goto(B + '/home'); await sleep(6000); await L.closeBriefing(p);
  await shot(p, '1-home');
  await hold(p); ok(`${MODE}: hold opens robot menu`, await p.locator('[data-test=sergeant-menu]').count()); await shot(p, '2-hold-menu');
  await p.click('[data-test=sg-next]'); await sleep(700);
  const t1 = await toast(p); console.log('pick 1:', JSON.stringify(t1)); await shot(p, '3-whats-next');
  if (MODE === 'after') {
    ok('pick is one line in the boss bubble', /^Next: ZZTEST (Big report|Quick email), /.test(t1));
    ok('Start + Reroll shown', (await p.locator('[data-test=roll-start]').count()) === 1 && (await p.locator('[data-test=roll-reroll]').count()) === 1);
    ok('no completed task picked', !/Done thing/.test(t1));
    await p.click('[data-test=roll-reroll]'); await sleep(700); const t2 = await toast(p); console.log('pick 2:', JSON.stringify(t2));
    ok('reroll picks the other open task', /^Next: ZZTEST/.test(t2) && t2.split(',')[0] !== t1.split(',')[0]); await shot(p, '4-reroll');
    const picked = t2.replace(/^Next: /, '').split(',')[0];
    await p.click('[data-test=roll-start]'); await sleep(2500);
    const d = (await L.db.doc(`weeklyRoutines/${uid}_${L.todayName()}`).get()).data();
    const tt = d.tasks.find((x) => x.title === picked); ok('Start starts that task timer', tt && tt.timerActive === true, picked); await shot(p, '5-started');
    // tap the boss face in the boss panel (hero menu)
    await p.click('.hero-menu-btn'); await sleep(600); await shot(p, '6-hero-menu');
    if (await p.locator('[data-test=boss-roll]').count()) { await p.click('[data-test=boss-roll]'); await sleep(700); const t3 = await toast(p); console.log('boss tap:', JSON.stringify(t3)); ok('tap boss face rolls (running timer wins)', new RegExp(`^Next: ${picked}, its timer is running`).test(t3)); ok('no Start while running', !(await p.locator('[data-test=roll-start]').count())); await shot(p, '7-boss-tap'); }
    else console.log('boss panel not shown (no boss lines right now) - skipped face tap');
    // empty day
    await L.db.doc(`weeklyRoutines/${uid}_${L.todayName()}`).set({ day: L.todayName(), tasks: [] }, { merge: false });
    await p.goto(B + '/home'); await sleep(5000); await L.closeBriefing(p);
    await hold(p); await p.click('[data-test=sg-next]'); await sleep(700); const t4 = await toast(p); console.log('empty:', JSON.stringify(t4));
    ok('no tasks handled gracefully', /No tasks today yet/.test(t4) && !(await p.locator('[data-test=roll-start]').count())); await shot(p, '8-empty');
  }
  ok(`${MODE}: no page errors`, !p.errs.length, p.errs.join(' | '));
  await br.close(); process.exit(L.results.every((x) => x.pass) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
