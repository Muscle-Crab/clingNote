// Renders the home EightHourCard in each phase (server-side) and checks the countdown / end time / tasks / points display. Run: node scripts/test-eight-hour-card.js
const assert = require('assert'); const sr = require('./lib/srcRequire');
sr.stubs['@/firebaseConfig'] = { auth: { currentUser: null }, db: {} };
sr.stubs['@/config/api'] = { fnUrl: (n) => `/fn/${n}` };
const { createSSRApp } = require('vue'); const { renderToString } = require('@vue/server-renderer');
const eh = sr.load('composables/useEightHour.js'); const Card = sr.load('components/home/EightHourCard.vue').default;
const core = require('../netlify/functions/lib/eightHourCore.js');
const TZ = 'America/New_York'; const at = (iso) => Date.parse(iso);
const { st } = eh.useEightHour();
const T = (title, completed) => ({ title, createdAt: title, completed: !!completed });
const render = async (now, data, tasks = []) => { st.loaded = true; st.offset = now - Date.now(); st.data = { now, ...data }; return renderToString(createSSRApp(Card, { tasks })); };
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
(async () => {
  const warn = console.warn; console.warn = () => {};
  const base = { plan: { wakeTime: '07:00', tz: TZ, taskCount: 3 }, stats: core.defaultStats() };
  let html = await render(at('2026-10-23T10:00:00Z'), { ...base, plan: null }); // none
  ok(/Set your day/.test(html) && /data-test="eh-save"/.test(html), 'no plan => setup form');
  html = await render(at('2026-10-23T09:00:00Z'), base, [T('a')]); // 05:00 local, before wake
  ok(/Starts 7:00 AM/.test(html) && /Ends 3:00 PM/.test(html) && /1\/3 added|1\/3\)/.test(html), 'before wake: start + end label and task count');
  html = await render(at('2026-10-23T11:30:00Z'), base, [T('a')]); // 07:30 ready
  ok(/data-test="eh-needs-tasks"/.test(html) && /Add 2 more tasks/.test(html), 'ready but tasks missing => countdown waits');
  ok(!/type="time"/.test(html), 'wake time frozen once the wake time has passed');
  html = await render(at('2026-10-23T11:30:00Z'), base, [T('a'), T('b'), T('c')]);
  ok(/data-test="eh-start"/.test(html), 'ready with all tasks => start button (auto-start also fires)');
  const lock = { dayKey: '2026-10-23', dayName: 'Fri', tz: TZ, wakeTime: '07:00', startMs: at('2026-10-23T11:00:00Z'), endMs: at('2026-10-23T19:00:00Z'), taskCount: 3, plannedCount: 3, points: [20, 40, 30], totalPoints: 90, target: 70 };
  html = await render(at('2026-10-23T13:00:00Z'), { ...base, lock }, [T('a', true), T('b'), T('c', true)]); // 2h in
  ok(/06:00:00|05:59:5\d/.test(html), 'countdown shows 6h left');
  ok(/Ends 3:00 PM/.test(html), 'ends 3:00 PM'); ok(/Ends 3:00 PM/.test(html) && /7:00 AM/.test(html), 'start and end times'); ok(/50\/70 pts/.test(html), 'points / target as small text'); ok(!/tasks done|role="progressbar"|eh-bar/.test(html), 'compact strip: no tasks-done block and no bar (the progress card already shows it)'); ok(/eh-clock/.test(html), 'countdown number is the prominent element');
  ok(/data-test="eh-lock"/.test(html), 'lock badge'); ok(!/type="time"|eh-stepper|<button/.test(html), 'no edit controls while running');
  // device clock far off: offset keeps the countdown on server time
  st.offset = 0; html = await render(at('2026-10-23T13:00:00Z'), { ...base, lock }, [T('a', true), T('b'), T('c', true)]); ok(/06:00:00|05:59:5\d/.test(html), 'server clock decides');
  html = await render(at('2026-10-23T20:00:00Z'), { ...base, lock, stats: { ...core.defaultStats(), streak: 1, notice: 'Tomorrow is harder.' }, reward: 'Nice' }, [T('a', true), T('b', true), T('c', true)]);
  ok(/Goal met/.test(html) && /data-test="eh-reward"/.test(html) && /data-test="eh-notice"/.test(html), 'ended + met shows reward and notice');
  html = await render(at('2026-10-23T20:00:00Z'), { ...base, lock, stats: { ...core.defaultStats(), notice: 'Tomorrow is harder.' } }, [T('a', true), T('b'), T('c')]);
  ok(/Goal missed/.test(html), 'ended + missed');
  console.warn = warn; console.log(`eight-hour card: ${n} checks passed`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
