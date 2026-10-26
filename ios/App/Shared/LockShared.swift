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
#endif
