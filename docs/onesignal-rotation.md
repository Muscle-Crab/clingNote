# OneSignal REST API key: rotate it now

The OneSignal **REST API key was hard-coded in client code** (`src/composables/useNotifications.js`, `src/views/Pickup.vue`,
`src/views/Room.vue`, `src/views/Discussion.vue`). Anything in client code ships to every visitor's browser, and the key is
also in this repo's **git history** (and the public GitHub repo, if pushed). Removing it from the code does **not** make the
old key safe. With it anyone can send push notifications to all your users. **Rotate it regardless.**

## 1. Rotate the key in OneSignal
1. Sign in at https://dashboard.onesignal.com and open the ClingNote app.
2. **Settings → Keys & IDs**.
3. Under **REST API Key**, create a new key (or click **Rotate / Regenerate**) and copy it somewhere safe (it's shown once for v2 keys).
4. **Delete / revoke the old key** so the leaked one stops working.
5. Copy the **App ID** from the same page (not secret, but the server reads it from env too).

## 2. Set Netlify environment variables
Netlify → your site → **Site configuration → Environment variables → Add a variable** (scope: Functions):

| Name | Value |
|---|---|
| `ONESIGNAL_REST_API_KEY` | the **new** REST API key |
| `ONESIGNAL_APP_ID` | the OneSignal App ID |
| `GOOGLE_APPLICATION_CREDENTIALS_BASE` | already used by the Stripe webhook: base64 of the Firebase service-account JSON (used to verify sign-in tokens). Keep as is. |
| `ONESIGNAL_ALLOW_BROADCAST` | optional, `true` to re-enable "notify everyone" posts from Pickup / Room / Discussion. Off by default. |
| `ICS_FEED_SECRET`, `CRON_SECRET` | optional, see `docs/calendar-sync.md` / daily report |

Then **Deploys → Trigger deploy** so functions pick up the variables.

## 3. How sending works now
- The browser calls `/.netlify/functions/send-notification` with the user's **Firebase ID token**.
- The function verifies the token with `firebase-admin`, then sends via OneSignal with the key from env.
- Personal pushes target only the caller: OneSignal `external_id` = Firebase uid (the app calls `OneSignal.login(uid)` after sign-in).
  A user can't target someone else's device.
- Broadcasts to all subscribers are refused unless `ONESIGNAL_ALLOW_BROADCAST=true`.

## 4. Optional: scrub git history
Rotation is what actually protects you. If you also want the old key out of history, use
`git filter-repo --replace-text` (or BFG) on a fresh clone, then force-push and have collaborators re-clone. This rewrites
history, so coordinate first.

## Also found (not fixed in this change)
`VUE_APP_OPENAI_API_KEY` is read in `MealPlan.vue` and `HomeView.vue`. `VUE_APP_*` variables are **bundled into the client**,
so that OpenAI key is visible to anyone using the site. Move those calls behind a Netlify Function too, and rotate that key.
