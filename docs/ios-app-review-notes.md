# ClingNote iOS – App Review decisions (local branch feat/ios-capacitor)

- **Recovery Tracker (/addiction)** – hidden in the iOS app (nav link removed, route is `webOnly`), because it is sensitive health-adjacent self-tracking and not needed for review. On the web it stays, with a persistent *not medical advice* box (988 / SAMHSA 1-800-662-4357), the option "Porn" is shown as "Adult content" (stored value stays `Porn` so existing accounts keep working) and the voice follow-up wording was neutralised. It is declared in the privacy policy (section 7). To ship it on iOS later: drop `webOnly` on the route and `!isIOS` in `nav.vue`, and add the category to the App Privacy answers ("Health & Fitness"/"Sensitive Info" not linked to tracking).
- **About (/about)** – admin user-management page behind a hardcoded admin email; web only, route is `webOnly`, nav link hidden on iOS.
- **Support URL for App Store Connect:** `https://clingnot.netlify.app/support` (after the web deploy). The mailbox `support@clingnote.app` (src/config/support.js) must exist – the domain currently has no DNS.
- **Account deletion** (`netlify/functions/delete-account.js`): deletes Firestore data, Storage (`avatars/`, `task_images/`, `task_files/`, `mealImages/<uid>_`, `uploads/<uid>_`, plus the media of the user's own posts), scrubs the user's comments / replies / reactions / read-markers on other people's posts, revokes Sign in with Apple, cancels Stripe, deletes the OneSignal user (needs `ONESIGNAL_REST_API_KEY`) and the RevenueCat subscriber (needs `REVENUECAT_SECRET_KEY`), then the Auth user. Without those env vars the step is skipped and reported in the response (`onesignal` / `revenuecat` = `skipped-not-configured`) – **TODO: set both in Netlify before submission.** Apple subscriptions can only be cancelled by the user in their Apple ID settings (the app says so).
- Community uploads are now stored as `uploads/<uid>_<ts>_<name>` (previously `uploads/<name>`, which could not be attributed to a user).

## Oct 2026 native additions (need on-device testing; not yet compiled)
- **Min iOS is now 16.0** (pbxproj, all configs, and CapApp-SPM Package.swift).
- **Main app (App target) has these new sources:** ClingLockPlugin.swift, ClingNativePlugin.swift, ClingIntents.swift, Shared/LockShared.swift and Shared/FocusActivityAttributes.swift.
- **Widget target has these new sources:** FocusLiveActivity.swift and Shared/FocusActivityAttributes.swift.
- **New Info.plist keys:** NSSupportsLiveActivities, the calendar usage strings (full + write-only + legacy) and the location usage strings (when-in-use + always).
- **App.entitlements now includes `com.apple.developer.family-controls`.** The main app ID is approved (request R43KPC6DDD).
- **Extension targets are still to be added in Xcode** (their sources and plists are in the repo, but they are NOT in the pbxproj yet):
  - `ios/App/ClingLockMonitor` (DeviceActivityMonitor, extension point com.apple.deviceactivity.monitor-extension)
  - `ios/App/ClingShieldConfig` (ShieldConfiguration, com.apple.ManagedSettingsUI.shield-configuration-service)
  - Each one needs:
    - its own bundle ID (e.g. `<app id>.ClingLockMonitor` and `<app id>.ClingShieldConfig`)
    - the App Group group.app.clingnote.ios
    - the Family Controls capability. Distribution approval may have to be requested separately per extension bundle ID.
  - Add Shared/LockShared.swift to both extensions.
  - The CI signing / provisioning profiles must include the new IDs before a TestFlight build will succeed.
- **Review notes for Apple:**
  - Calendar is only read for busy start/end times (no titles leave the device).
  - Location is used only for user-created place reminders (UNLocationNotificationTrigger).
  - Screen Time uses individual authorization; the user chooses the apps, and the shield lifts when goals are met or the session ends.
