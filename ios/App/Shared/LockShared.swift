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
    static var defaults: UserDefaults? { UserDefaults(suiteName: group) }
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
}
@available(iOS 16.0, *)
extension ManagedSettingsStore.Name { static let clingApps = Self("clingApps") }
#endif

#endif
