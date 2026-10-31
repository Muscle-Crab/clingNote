# Calendar sync (read-only)

## Subscribe to your tasks
1. In ClingNote open **📅 Upcoming** (home menu) → **Calendar feed** → **Create private feed link**.
2. **Apple Calendar (iPhone/Mac):** tap **Subscribe (Apple)**, or Settings → Calendar → Accounts → Add Subscribed Calendar → paste the link.
3. **Google Calendar (web):** Other calendars → **+** → **From URL** → paste the link. (Google refreshes subscribed feeds on its own schedule, often every few hours.)

The feed contains scheduled tasks, repeating tasks (as repeating events), and tasks with a due date. Times are shown in your
calendar's local time; tasks without a time are all-day events. Completed tasks drop off.

## Privacy
- The link contains a random 48-character secret. Anyone with it can read your task titles/notes (never your email).
- **New link** issues a new secret and kills the old URL. **Revoke** turns the feed off entirely.

## Add a single task
Open a task → **📅 Add to calendar** downloads an `.ics` file your phone/computer opens in its calendar app.

## Not built: two-way Google Calendar sync
Editing in Google and syncing back (or writing events into Google directly) needs Google OAuth (consent screen,
`calendar.events` scope, verified app, stored refresh tokens) and a server sync job. That's not implemented. The feed is read-only.

## Setup needed (owner)
- Netlify function `calendar` uses the existing `GOOGLE_APPLICATION_CREDENTIALS_BASE` env var (Firebase service account).
- Add the `icsTokens` rule from `firestore.rules` to your live Firestore rules (clients may only create/delete their own token).

## Device calendar two-way sync (iOS EventKit, B44)

Separate from the read-only Google feed above. `src/utils/calendarSync.js` syncs timed tasks with a "ClingNote" calendar on the device:
- New and edited tasks are pushed. Edits and new events in Calendar come back as task changes.
- Completing a task turns its event into "✓ Title" and keeps it. If you delete that event in Calendar, it isn't added back. Tasks that were already done before their first sync are never added.
- Conflicts (both sides changed since the last sync) are merged field by field (title / start / length) against the last-synced baseline. When the same field changed on both sides, Calendar wins. The merged result is written to both sides, and the sync message shows "N merged".
- No duplicates: an unlinked Calendar event with the same title + start as a task is linked to that task, not copied. Identical twin events are imported once.
- On a locked day, the pull is skipped and nothing is pushed for that task until the next run.
Tests: `scripts/test-calendar-sync.js`, `scripts/test-b44-calendar-2way.js`.
