# TikTok gate (iPhone Shortcuts)

CleanNote can't block other apps from the web. What it can do is put itself in front of TikTok every time you open it,
using an iOS Shortcuts **Personal Automation**. You then see either:

- **Locked: N/5 tasks left** with a countdown to your Discipline Mode deadline (and a "Do a task" button), or
- **Start break**, which spends the break minutes you earned (2 min per completed task, +10 for hitting 5,
  +5 at a 7-day streak, +10 at a 30-day streak), with a timer and a "Back to work" screen when it runs out.

Every open while locked is written to your Procrastination log.

## Setup (iOS 17 / 18)

1. Open the **Shortcuts** app → **Automation** tab (bottom).
2. Tap **+** (or **New Automation**) → choose **App**.
3. Tap **Choose** next to *App*, select **TikTok**, tap **Done**.
4. Keep **Is Opened** checked (leave *Is Closed* unchecked).
5. Select **Run Immediately** (not "Run After Confirmation"), and turn **Notify When Run** off if you like. Tap **Next**.
6. Tap **New Blank Automation** → **Add Action** → search **Open URLs** and add it.
7. Tap the URL field and enter exactly: `https://clingnot.netlify.app/gate?app=tiktok`
8. Tap **Done**.

Make sure you're signed in to CleanNote in Safari (the gate needs your account). Optional: add CleanNote to your
Home Screen from Safari's share sheet.

## Limits (be honest with yourself)

- **This is not a real block.** A website can't stop another app. TikTok still opens behind Safari; you can switch back.
- The break timer is advisory: when it ends CleanNote shows "Back to work" but can't close TikTok.
- The automation can be turned off in Shortcuts at any time. For a hard limit, combine it with
  **Screen Time → App Limits** (Settings → Screen Time → App Limits → Add Limit → TikTok) and let someone else set the passcode.
- Android: use an automation app (e.g. Tasker / MacroDroid "App launched" → open URL) — same limits apply.
