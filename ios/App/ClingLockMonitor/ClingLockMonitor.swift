import DeviceActivity
import ManagedSettings
import FamilyControls
import Foundation
import UserNotifications

/// DeviceActivityMonitor extension (bundle app.clingnote.ios.lockmonitor). Clears the 8-hour shield and per-app timed locks.
class ClingLockMonitor: DeviceActivityMonitor {
    let store = ManagedSettingsStore(named: .clingLock)
    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        guard activity == .clingLock, let data = LockShared.defaults?.data(forKey: LockShared.selectionKey),
              let s = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) else { return }
        store.shield.applications = s.applicationTokens.isEmpty ? nil : s.applicationTokens
        store.shield.applicationCategories = s.categoryTokens.isEmpty ? nil : .specific(s.categoryTokens)
        store.shield.webDomains = s.webDomainTokens.isEmpty ? nil : s.webDomainTokens
    }
    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        if activity.rawValue.hasPrefix(AppLocks.activityPrefix) {  // per-app timed lock ended
            let id = String(activity.rawValue.dropFirst(AppLocks.activityPrefix.count))
            var l = AppLocks.locked(); l[id] = nil; AppLocks.saveLocked(l); AppLocks.apply()
            DeviceActivityCenter().stopMonitoring([activity]) // free the slot (schedules count toward the system limit)
            notifyLockEnded(); return
        }
        guard activity == .clingLock else { return }
        store.shield.applications = nil; store.shield.applicationCategories = nil; store.shield.webDomains = nil
        AppLocks.cleanupExpired() // clingApps store: drop expired per-app locks and their schedules, keep still-active ones
        DeviceActivityCenter().stopMonitoring([.clingLock])
        LockShared.defaults?.set(["locked": false, "until": 0], forKey: LockShared.stateKey)
        notifyLockEnded()
    }
    /// Lock time is up. Aggressiveness is user-selectable (Settings > Lock-in > "Lock-end alert", App Group key
    /// LockShared.lockEndAlertKey): off | subtle (passive, silent) | standard (active, default sound) |
    /// loud (timeSensitive, default sound; default) | maximum (timeSensitive + .defaultCritical, which plays at full
    /// volume on silent only once Apple grants the Critical Alerts entitlement, else falls back to the standard sound).
    private func notifyLockEnded() {
        // One alert per lock end. Every per-app lock is its own DeviceActivity, so locking 8 apps until the same time fired
        // intervalDidEnd 8 times at once and each posted a new UUID-identified notification (8 identical banners, build 36).
        // Debounce across all activities through the App Group, and use one stable identifier so iOS replaces instead of stacking.
        let now = Date().timeIntervalSince1970
        if !LockEndAlertGate.shouldPost(last: LockShared.defaults?.double(forKey: LockEndAlertGate.lastKey) ?? 0, now: now) { return }
        LockShared.defaults?.set(now, forKey: LockEndAlertGate.lastKey)
        let level = LockShared.defaults?.string(forKey: LockShared.lockEndAlertKey) ?? LockShared.lockEndAlertDefault
        if level == "off" { return }
        let voice = UNNotificationSoundName(LockShared.lockEndSoundName)
        let c = UNMutableNotificationContent()
        c.title = "ClingNote"; c.body = "Your lock time is up."
        switch level {
        case "subtle": c.interruptionLevel = .passive; c.sound = nil
        // Standard/Loud/Maximum play the spoken clip (App Group Library/Sounds, installed by the app);
        // iOS falls back to the default sound if the file is missing. Maximum's critical variant needs the
        // Critical Alerts entitlement to bypass silent; without it iOS plays it as a normal sound.
        case "standard": c.interruptionLevel = .active; c.sound = UNNotificationSound(named: voice)
        case "maximum": c.interruptionLevel = .timeSensitive; c.sound = .criticalSoundNamed(voice, withAudioVolume: 1.0)
        default: c.interruptionLevel = .timeSensitive; c.sound = UNNotificationSound(named: voice) // loud
        }
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: LockEndAlertGate.identifier, content: c, trigger: nil))
    }
}

/// Pure dedupe rule for the lock-end alert (mirrored in scripts/test-lock-end-dedupe.mjs).
enum LockEndAlertGate {
    static let identifier = "cling.lock.ended"
    static let lastKey = "lock.endAlert.lastAt"
    static let window: Double = 90 // seconds: ends of several activities at the same minute collapse into one alert
    static func shouldPost(last: Double, now: Double) -> Bool { last <= 0 || now - last >= window || now < last }
}
