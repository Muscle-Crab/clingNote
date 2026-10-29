// App lock is off for this build: compiled only when CLING_APP_LOCK is defined (needs the Family Controls entitlement). See docs/APP_LOCKING_SETUP.md.
#if CLING_APP_LOCK
// Shared by the app and the Screen Time extensions (ClingLockMonitor, ClingShieldConfig).
import Foundation
#if canImport(ManagedSettings)
import ManagedSettings
import DeviceActivity

@available(iOS 16.0, *)
enum LockShared {
    static let group = "group.app.clingnote.ios"
    static let selectionKey = "lock.selection"
    static let stateKey = "lock.state"
    static let lockEndAlertKey = "lockEndAlert"   // off | subtle | standard | loud | maximum
    static let lockEndAlertDefault = "loud"
    static let lockEndAlertLevels: Set<String> = ["off", "subtle", "standard", "loud", "maximum"]
    static var defaults: UserDefaults? { UserDefaults(suiteName: group) }
    /// Spoken drill-sergeant clip for the lock-ended alert (App/lock_ended_voice.caf, ~2.9 s).
    static let lockEndSoundName = "lock_ended_voice.caf"
    /// Copies the clip from the main app bundle into <App Group>/Library/Sounds, where iOS resolves
    /// UNNotificationSound(named:) for notifications posted by the ClingLockMonitor extension. Main app only.
    static func installLockEndSound() {
        guard let src = Bundle.main.url(forResource: "lock_ended_voice", withExtension: "caf"),
              let box = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else { return }
        let dir = box.appendingPathComponent("Library/Sounds", isDirectory: true), dst = dir.appendingPathComponent(lockEndSoundName)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        if FileManager.default.fileExists(atPath: dst.path) { return }
        try? FileManager.default.copyItem(at: src, to: dst)
    }
}

@available(iOS 16.0, *)
extension ManagedSettingsStore.Name { static let clingLock = Self("clingLock") }
@available(iOS 16.0, *)
extension DeviceActivityName { static let clingLock = Self("clingLock") }

// Per-app locks by user label ("lock TikTok for 2h"). Apple only hands out opaque ApplicationTokens from
// FamilyActivityPicker, so each picked token is stored with the name the user confirmed for it.
@available(iOS 16.0, *)
struct LabeledApp: Codable { var id: String; var label: String; var token: ApplicationToken }

@available(iOS 16.0, *)
enum AppLocks {
    static let appsKey = "lock.apps"          // [LabeledApp] (JSON)
    static let lockedKey = "lock.appsLocked"  // [id: untilMs] (0 = until unlocked)
    static let activityPrefix = "clingApp."
    static let store = ManagedSettingsStore(named: .clingApps)
    static func apps() -> [LabeledApp] {
        guard let d = LockShared.defaults?.data(forKey: appsKey), let a = try? JSONDecoder().decode([LabeledApp].self, from: d) else { return [] }
        return a
    }
    static func saveApps(_ a: [LabeledApp]) { if let d = try? JSONEncoder().encode(a) { LockShared.defaults?.set(d, forKey: appsKey) } }
    static func locked() -> [String: Double] { (LockShared.defaults?.dictionary(forKey: lockedKey) as? [String: Double]) ?? [:] }
    static func saveLocked(_ l: [String: Double]) { LockShared.defaults?.set(l, forKey: lockedKey) }
    /// Drops expired entries, then shields exactly the still-locked tokens.
    static func apply(now: Double = Date().timeIntervalSince1970 * 1000) {
        var l = locked(); l = l.filter { $0.value == 0 || $0.value > now }; saveLocked(l)
        let tokens = Set(apps().filter { l[$0.id] != nil }.map { $0.token })
        store.shield.applications = tokens.isEmpty ? nil : tokens
    }
    /// Schedule components without seconds (DeviceActivity schedules are minute-granular).
    static func comps(_ d: Date) -> DateComponents { Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: d) }
    /// Stops per-app DeviceActivity schedules whose saved entry is gone or expired (they count toward the system
    /// limit), then drops expired entries and re-shields the rest.
    static func cleanupExpired(now: Double = Date().timeIntervalSince1970 * 1000) {
        let l = locked()
        let stale = DeviceActivityCenter().activities.filter { a in
            guard a.rawValue.hasPrefix(activityPrefix) else { return false }
            let id = String(a.rawValue.dropFirst(activityPrefix.count))
            guard let u = l[id] else { return true }
            return u > 0 && u <= now
        }
        if !stale.isEmpty { DeviceActivityCenter().stopMonitoring(stale) }
        apply(now: now)
    }
}
@available(iOS 16.0, *)
extension ManagedSettingsStore.Name { static let clingApps = Self("clingApps") }
#endif

#endif
