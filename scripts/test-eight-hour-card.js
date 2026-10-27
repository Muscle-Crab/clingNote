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
  ok(/Min 4 · max 50 tasks for 8 hours/.test(html) && !/eh-stepper|eh-count|More tasks|Fewer tasks/.test(html), 'setup: one min/max line for the hours, no Planned stepper');
  html = await render(at('2026-10-23T09:00:00Z'), base, [T('a')]); // 05:00 local, before wake
  ok(/Starts 7:00 AM/.test(html) && /Ends 3:00 PM/.test(html) && /Min 4 · max 50 tasks for 8 hours · 1 on your list/.test(html), 'before wake: start + end label and min/max vs list count');
  ok(!/eh-stepper|eh-count|Planned \d|eh-match/.test(html), 'before wake: no stepper and no "plan N" buttons');
  html = await render(at('2026-10-23T11:30:00Z'), base, [T('a')]); // 07:30 ready
  ok(/Add 3 more to start/.test(html) && !/data-test="eh-start"/.test(html), 'ready but below the minimum => no Start, says how many more');
  ok(!/data-test="eh-match|plan 1 instead|Plan 1|You planned/.test(html), 'no match-the-plan buttons');
  ok(!/type="time"/.test(html), 'wake time frozen once the wake time has passed');
  html = await render(at('2026-10-23T11:30:00Z'), base, [T('a'), T('b'), T('c'), T('d')]);
  ok(/data-test="eh-start"/.test(html), 'ready with exactly the minimum => Start');
  html = await render(at('2026-10-23T11:30:00Z'), base, Array.from({ length: 9 }, (_, i) => T('t' + i)));
  ok(/data-test="eh-start"/.test(html) && /9 on your list/.test(html) && !/eh-over/.test(html), 'more than the minimum and more than plan.taskCount (3) => still Start, no exact match needed');
  html = await render(at('2026-10-23T11:30:00Z'), base, Array.from({ length: 50 }, (_, i) => T('t' + i)));
  ok(/data-test="eh-start"/.test(html), 'at the cap (50) => Start');
  html = await render(at('2026-10-23T11:30:00Z'), base, Array.from({ length: 52 }, (_, i) => T('t' + i)));
  ok(!/data-test="eh-start"/.test(html) && /Over the max of 50 tasks. Remove 2 to start./.test(html), 'over the cap => no Start, short message');
  const lock = { dayKey: '2026-10-23', dayName: 'Fri', tz: TZ, wakeTime: '07:00', startMs: at('2026-10-23T11:00:00Z'), endMs: at('2026-10-23T19:00:00Z'), taskCount: 3, plannedCount: 3, points: [20, 40, 30], totalPoints: 90, target: 70 };
  html = await render(at('2026-10-23T13:00:00Z'), { ...base, lock }, [T('a', true), T('b'), T('c', true)]); // 2h in
  ok(/06:00:00|05:59:5\d/.test(html), 'countdown shows 6h left');
  ok(/Ends 3:00 PM/.test(html), 'ends 3:00 PM'); ok(/Ends 3:00 PM/.test(html) && /7:00 AM/.test(html), 'start and end times'); ok(/50\/70 pts/.test(html), 'points / target as small text'); ok(!/tasks done|role="progressbar"|eh-bar/.test(html), 'compact strip: no tasks-done block and no bar (the progress card already shows it)'); ok(/eh-clock/.test(html), 'countdown number is the prominent element');
  ok(/data-test="eh-lock"/.test(html), 'lock badge'); ok(!/type="time"|eh-stepper|<button/.test(html), 'no edit controls while running');
  // device clock far off: offset keeps the countdown on server time
  st.offset = 0; html = await render(at('2026-10-23T13:00:00Z'), { ...base, lock }, [T('a', true), T('b'), T('c', true)]); ok(/06:00:00|05:59:5\d/.test(html), 'server clock decides');
  html = await render(at('2026-10-23T20:00:00Z'), { ...base, lock, stats: { ...core.defaultStats(), streak: 1, lastDay: '2026-10-23', notice: 'Tomorrow is harder.' }, reward: 'Nice' }, [T('a', true), T('b', true), T('c', true)]);
  ok(/Goal met/.test(html) && /data-test="eh-reward"/.test(html) && /data-test="eh-notice"/.test(html), 'ended + met shows reward and notice');
  html = await render(at('2026-10-23T20:00:00Z'), { ...base, lock, stats: { ...core.defaultStats(), notice: 'Tomorrow is harder.' } }, [T('a', true), T('b'), T('c')]);
  ok(/Goal missed/.test(html), 'ended + missed');
  ok(!/data-test="eh-notice"/.test(html), 'stale notice from an earlier day is hidden');
  html = await render(at('2026-10-23T13:00:00Z'), { ...base, lock, stats: { ...core.defaultStats(), lastDay: '2026-10-22', notice: 'You earned 0 of 30 points.' } }, [T('a'), T('b'), T('c')]);
  ok(!/data-test="eh-notice"/.test(html) && !/You earned/.test(html) && /0\/70 pts/.test(html), 'running day never shows the previous day notice');
  console.warn = warn; console.log(`eight-hour card: ${n} checks passed`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
