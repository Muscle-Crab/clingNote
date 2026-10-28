# ClingNote App Locking Setup (Mac + iPhone)

1. **Install Xcode.** Mac App Store, search Xcode, click Get. Open it once and let it install extra components.
2. **Get the project.** Clone ClingNote from GitHub, branch `feat/ios-capacitor`. In Terminal in that folder: `npm install`, `npm run build`, `npx cap sync ios`. Open `ios/App/App.xcworkspace` (the .xcworkspace, not .xcodeproj).
3. **Sign in to Apple.** Xcode > Settings > Accounts > + > sign in with your Apple Developer account.
4. **Signing.** Click the blue App project > App target > Signing & Capabilities. Turn on "Automatically manage signing" and pick your team.
5. **Capabilities.** Click "+ Capability", add **Family Controls**. Confirm **App Groups** includes `group.app.clingnote.ios`.
6. **Shield extension.** File > New > Target > "Shield Configuration Extension", name it `ClingNoteShield` (bundle ID = app ID + `.ClingNoteShield`). Click Activate if asked. Give it the same team, Family Controls, and App Group.
7. **Device Activity extension.** Same steps with "Device Activity Monitor Extension", named `ClingNoteActivity`, same team, Family Controls, and App Group.
8. **Add ClingNote's code.** In each new extension folder, replace the starter Swift file with the matching ClingNote file from the project's `ios` folder.
9. **Connect your iPhone.** Plug in by cable, tap Trust. If asked, enable Developer Mode (Settings > Privacy & Security) and restart. For Wi-Fi: Window > Devices and Simulators > "Connect via network".
10. **Run.** Choose your iPhone at the top of Xcode, press Play. If the phone says the developer isn't trusted: Settings > General > VPN & Device Management > trust your account.
11. **Approve Screen Time.** The first time you turn on app lock, iPhone asks for Screen Time access. Tap Continue and confirm with Face ID or passcode.
12. **Pick apps to lock.** Choose apps or categories in Apple's picker. They lock when locked-in time starts and unlock when you finish your tasks or hit your points goal.

> **Note:** This runs on your own phone only. TestFlight and the App Store still require Apple to approve the Family Controls request.

## What runs inside the app (limits)

- **In-app agents can't lock or close other apps.** Anything built inside ClingNote, including the assistant, is sandboxed to ClingNote. It can only decide *when* locking starts or stops. The Shield and Device Activity extensions do the actual blocking.
- **Siri can open ClingNote, but it can't force-quit other apps.** A voice request to close apps shows a reminder or a shortcut instead of closing them directly.
