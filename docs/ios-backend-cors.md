# iOS app: backend reachability and CORS (App Store audit B1)

Inside the Capacitor shell the page origin is `clingnot://localhost` (iOS scheme `ClingNot`, lower-cased by WebKit; `capacitor://localhost` and `https://localhost` are also allowed), so
- relative `/.netlify/functions/...` URLs would hit the local bundle. The client now builds URLs with `fnUrl()` from `src/config/api.js` (`''` on the web, `https://clingnot.netlify.app` in native builds).
- the functions answer the `OPTIONS` preflight and send `Access-Control-Allow-*` headers via `netlify/functions/lib/cors.js` (allow-list: the three app origins + `clingnot.netlify.app` + `clingnote.netlify.app`; headers `Authorization, Content-Type`; methods `GET, POST, DELETE, OPTIONS`). Extra origins can be added with the Netlify env var `CORS_EXTRA_ORIGINS` (comma separated). **This only takes effect after the functions are deployed.**

## Firebase Storage bucket CORS (NOT applied - needs the user)
Avatar, task-file, meal-image and room uploads go straight from the WebView to Firebase Storage, which needs the bucket CORS to allow the app origin. The current repo `cors.json` only has `http://localhost:8081`. Apply `cors-storage-ios.json` (same repo root) to the bucket (`clingnote-463b4.appspot.com`, check the exact name in Firebase console -> Storage):

```
gsutil cors set cors-storage-ios.json gs://clingnote-463b4.appspot.com
gsutil cors get gs://clingnote-463b4.appspot.com   # verify
```
(or `gcloud storage buckets update gs://clingnote-463b4.appspot.com --cors-file=cors-storage-ios.json`). Needs a Google account with Storage Admin on the project. Not applied by the agent.
