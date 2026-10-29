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
            var l = AppLocks.locked(); l[id] = nil; AppLocks.saveLocked(l); AppLocks.apply(); notifyLockEnded(); return
        }
        guard activity == .clingLock else { return }
        store.shield.applications = nil; store.shield.applicationCategories = nil; store.shield.webDomains = nil
        LockShared.defaults?.set(["locked": false, "until": 0], forKey: LockShared.stateKey)
        notifyLockEnded()
    }
    /// Lock time is up: loudest alert iOS allows without Apple's separate Critical Alerts entitlement.
    /// Time Sensitive breaks through Focus / scheduled summary; .defaultCritical plays at full volume even on silent
    /// once that entitlement is granted, and falls back to the standard alert sound until then.
    private func notifyLockEnded() {
        let c = UNMutableNotificationContent()
        c.title = "ClingNote"; c.body = "Your lock time is up."
        c.interruptionLevel = .timeSensitive
        c.sound = .defaultCritical
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "cling.lock.ended.\(UUID().uuidString)", content: c, trigger: nil))
    }
}
