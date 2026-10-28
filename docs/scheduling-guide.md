# Scheduled & recurring tasks

Local-only feature on `feat/ios-capacitor` (not pushed or deployed).

## What the user sees
- **Schedule switch** in Add Task and Task details. When on, it shows the date, an optional time, and **Repeat**: Never / Daily / Weekly (pick weekdays) / Monthly (day of month, clamped to the month's last day). Ends (end date) is optional.
- When off, the schedule is removed (scheduledId, reminder and repeat label) and its notifications are cancelled. The task itself stays.
- Any task can go from unscheduled to scheduled and back, and from one-time to recurring and back.
- Task cards show `⏰ 9:00 AM` or `🔁 Every Mon · 9:00 AM`, plus `· Overdue` once the time passes (or at the end of the day when there is no time).
- The **Scheduled** panel lists upcoming one-time entries and a **Repeating** section of series (edit = all future, Delete series).
- **This one / All future**: editing or deleting an occurrence asks which to change.
  - "This one": changes only that occurrence. In the Upcoming list it detaches into a one-time entry. Deleting it adds the date to the series `skip`.
  - "All future": ends the old series the day before (`recurrence.until`) and starts a new template from that date. Delete sets `until`.

## Storage model: hybrid (templates + materialization)
- `users/{uid}.scheduledTasks.tasks[]` holds:
  - one-time entries (`scheduledDate`, `scheduledTime`)
  - recurring templates (`recurrence: {freq, days?, dayOfMonth?, until?}`, `startDate`, `generated[]`, `skip[]`)
- **Expansion**: `expandRecurring` turns templates into instance entries for the current week only (cheap, bounded).
- **Materialization**: on its date, each occurrence is copied into that day's `weeklyRoutines/{uid}_{Mon..Sun}` list as a normal task. It carries `scheduledId`, `scheduledFor`, `templateId`, `time`, `reminder` and `repeatText`.
- Why both:
  - Pure expansion (computed on the fly) would mean completion, points, streak, the 5/day limit and the 8-hour lock all need special cases for "virtual" tasks.
  - Materializing a whole series up front would flood day docs and make "all future" edits expensive.
  - With the hybrid, every occurrence becomes a real task on its day, so it is **completed independently** and earns points and streak like any other task. The series itself stays one small record.
- **Visibility**: a task appears **on its own day** (previously from the Monday of its week). A missed date materializes later and shows as overdue.
- **8-hour lock**: materialization is skipped while today's window is locked and retried on the next load.
- **Limits**: one-time entries count toward the 5/day limit on their date. Template occurrences are counted for the next 7 days, but an occurrence that materializes is never blocked (see Gaps).

## Notifications
- iOS uses Capacitor LocalNotifications with one-shot `at` triggers per occurrence, nearest first, looking 35 days ahead.
- iOS allows **64 pending** notifications. Scheduling uses a budget of 48, minus any other pending notifications (timers etc.), via `getPending`.
- Keys are `sched:<id>`, kept in `localStorage cn.schedNotifKeys`. Each sync diffs against the stored keys and cancels stale ones.
- A sync runs (600 ms debounce) on any change to the schedule list or today's scheduled tasks (add, edit, complete, delete, switch off).
- Web uses Notification API timers for items due within 24h, only while the tab is open and permission is granted.

## Firestore
- `firestore.rules` `schedOk()` on `users/{uid}` create/update: `scheduledTasks` must be a map with only `tasks` and `updatedAt`, and `tasks` must be a list of at most 300. Writes stay owner-only (existing `isOwner`).
- The Manager & Pal function shows Public scheduled tasks read-only (see manager-pal-guide).

## Tests
- `scripts/test-scheduling.js` and `scripts/test-sched-v2.js` (pure logic, notification plan and cap, manager projection). Both are in `npm run check`.
- `scripts/e2e/scheduling.e2e.js` runs on emulators with ZZTEST data. Screenshots go to `/workspace/eighthour_shots/sched_*.png`.
  Ports can be set with `EMU_AUTH_PORT`, `EMU_FS_PORT`, `FN_PORT`, `WEB_PORT` (web: `VUE_APP_EMU_AUTH_PORT`, `VUE_APP_EMU_FS_PORT`). `firebase.ios-e2e.local.json` uses 9199 and 8185.

## Gaps
- Web has no cancellable server push for scheduled times. In-tab timers only.
- Recurring occurrences from past weeks are not backfilled. Only the current week is expanded.
- Materialized occurrences bypass the per-day limit, so a series can push a day past 5.
- Times are device-local. The server (manager view) computes overdue in the function's timezone (UTC on Netlify), so overdue can shift by the user's offset.
