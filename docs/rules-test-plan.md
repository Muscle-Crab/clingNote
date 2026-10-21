# firestore.rules.tight — test plan

Publish: `firestore.rules.tight` (copy over the console rules). Before you publish, run the one-time backfill below, or other users' names won't show until each user opens the app once.

## Matrix (A = owner, B = other signed-in user, anon = signed out)
| Path | Expect allow | Expect deny |
|---|---|---|
| users/A | A read/update non-billing fields; A create with credits 15 or none; admin-claim read/delete | B read; anon read; A update credits/hasPaid/premium/subscription*/stripeCustomerId/admin/role; A create with premium/hasPaid or credits≠15 |
| publicProfiles/A | any signed-in read; A write name/avatarURL/attending/updatedAt; B change only `attending` | anon read; A extra keys (email); B change name |
| posts/p (userId A) | A create (userId=A), edit, delete; B update comments/reactions/readComments | anon read; B create with userId=A; B edit topic/message; B delete |
| rooms/r (user_id A) | A create (approvedUsers=[A]); A edit/approve/delete; B append one request | B add self to approvedUsers; B edit title; B delete; B request when already approved |
| tasks/* | — | everything |
| weeklyRoutines/A_Mon | A read/write | B read/write; doc `Mon` (no prefix) |
| streaks/A | A | B |
| captains, game/turnState | signed-in read/write | anon |
| monthlyStats, discipline, icsTokens, wontDoTasks, dailyReports, meals, userSettings, nofap | unchanged from rules.full | — |

## How to run
The emulator needs Java 11+: `firebase emulators:exec --only firestore "node scripts/rules-emulator.test.js"` using `@firebase/rules-unit-testing` (`assertSucceeds`/`assertFails`, one case per row). It hasn't been run yet because Java isn't installed on the build box. `scripts/test-security.js` does the static checks.

## Known app impacts
- AboutView (lists/deletes all users) now needs the `admin: true` custom claim (`admin.auth().setCustomUserClaims(uid, {admin:true})`).
- PremiumConfirmation's client `premium: true` write is now denied. Premium/hasPaid must come from stripe-webhook.
- Credits for completing tasks (+10/-10) are no longer saved. The meal-image credit is deducted server-side in `ai`.
- Backfill publicProfiles once using the admin SDK: for each users doc, write {name, avatarURL, attending}.
