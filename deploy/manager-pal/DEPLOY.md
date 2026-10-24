# Manager & Pal: minimal production deploy (PREPARED, NOT RUN)

Nothing here has been run against production. It needs Tacanda's go-ahead.

## What it is
This is production main (`3e01cf8`) plus **only** the Manager & Pal backend. No other branch change ships: the 8-hour day, RevenueCat, delete-account, CORS edits to other functions, rule hardening, and the UI all stay out.

`build-minimal.sh` creates the detached worktree `/workspace/clingNote-deploy` at 3e01cf8 and adds the following. This is the complete change set:

| File | Change |
|---|---|
| `netlify/functions/manager-pal.js` | **new** function at `/.netlify/functions/manager-pal` |
| `netlify/functions/lib/managerPal.js` | **new** helper (tokens/hash/codes/task filtering) |
| `netlify/functions/lib/cors.js` | **new** helper (only manager-pal requires it; no live function imports it) |
| `netlify.toml` | +5 lines: `[functions."manager-pal"]` bundling block |
| `firestore.rules` | +39 lines inserted before the final default-deny: `managers`, `managerConnections`, `managerLinks`, `blocks`, `reports`, `palInvites`, `users/{uid}/managerChat`, `pals/{pairId}` (+`messages`). **No existing rule is changed.** |

- The site bundle (`dist`) is rebuilt from 3e01cf8 with the site's own Netlify env vars, so it is the same app that is live now.
- All existing functions come from 3e01cf8, so they are unchanged.
- **No new env vars.** The Netlify env is near its 4KB limit, and this adds nothing. The function reuses the existing Firebase admin credentials (`GOOGLE_APPLICATION_CREDENTIALS_BASE`/`_BASE64`/`FIREBASE_SERVICE_ACCOUNT`) and `ONESIGNAL_APP_ID`/OneSignal key.
- **Indexes: none needed.** All queries are single-field (`managerConnections.ownerUid ==`, `.managerUid ==`, `pals.members array-contains`, `managerChat.read ==`, `managerChat orderBy createdAt`). Nothing is added to firebase.json and no indexes deploy.
- **Users see nothing new until a client ships.** The live web app has no Manager & Pals UI. The function and rules sit idle until the iOS build (or a later web deploy) ships the UI.

Verified locally:
- The unit tests pass inside the minimal tree.
- The full Playwright e2e passed 60/60 against the Firebase emulator **running the minimal rules file**.

## Run (after go-ahead)
```bash
bash deploy/manager-pal/build-minimal.sh          # rebuild the tree and print the diff (safe, local)
cd /workspace/clingNote-deploy && netlify link     # once, to the production site
NETLIFY_SITE_ID=<prod site id> CONFIRM=yes-deploy-manager-pal bash /workspace/clingNote-pals/deploy/manager-pal/deploy.sh
```
`deploy.sh` runs these steps in order:
1. Saves the currently published Netlify deploy id and the 3e01cf8 rules to `/workspace/deploy-backup/`.
2. Runs `netlify deploy --build`, which makes a **draft** (not live).
3. Smoke-tests the draft: a bad token returns 404, bad auth returns 401.
4. Runs `firebase deploy --only firestore:rules --project clingnote-463b4`.
5. Publishes the exact tested draft with `restoreSiteDeploy`.

Before step 4, open Firebase Console → Firestore → Rules and confirm the live ruleset matches 3e01cf8's `firestore.rules`. If someone deployed rules from another branch, re-base the snippet on the live rules instead.

## ROLLBACK
- **Netlify:** `netlify api restoreSiteDeploy --data '{"site_id":"<id>","deploy_id":"'$(cat /workspace/deploy-backup/netlify-previous-deploy-id.txt)'"}'`. You can also use Netlify UI → Deploys → previous deploy → "Publish deploy". This is instant and the function disappears.
- **Rules:** Firebase Console → Rules → History → previous version → Restore. Or run `cp /workspace/deploy-backup/firestore.rules.3e01cf8 firestore.rules && firebase deploy --only firestore:rules --project clingnote-463b4` from the deploy tree.
- **Data:** the new collections can stay. The old rules default-deny them, so no client can reach them.

## Data written in production once live
`managers`, `managerLinks` (sha256 of the token only), `managerConnections`, `palInvites` (10-minute codes), `pals` (+`messages` from clients), `users/{uid}/managerChat`, `blocks`, `reports`.

Reports have no admin UI yet. Review them in the Firestore console (`reports`, `status: 'open'`). App Review expects reports to be handled within 24h.

## Scheduling update (feat/ios-capacitor, local only)
- `netlify/functions/manager-pal.js` + `lib/managerPal.js` on `feat/ios-capacitor` now also return Public scheduled/recurring tasks
  (`scheduled: {date,time,repeat}`, `upcoming`, overdue once the time passes). Additive and backward compatible; Private stays server-side.
  To ship it, build with `SRC=feat/ios-capacitor ./build-minimal.sh` (default SRC is still `feat/manager-pal`, which lacks this).
- `firestore.rules` gained `schedOk()` on `users/{uid}` create/update (owner-only; `scheduledTasks` map, ≤300 tasks).
  It is outside `manager-pal.rules.snippet`; merge it into prod rules separately. Nothing here was deployed.
- **Bug fix that matters for the web deploy:** the app stores day docs as `weeklyRoutines/{uid}_Mon..Sun` (`src/data.json`), but the
  `feat/manager-pal` function reads `{uid}_Monday..Sunday`. Real users' managers/pals would see no tasks (the e2e seeded full-name docs, so it passed).
  The `feat/ios-capacitor` function reads both. `calendar.js` and `daily-report.js` use full names too (not changed here).
