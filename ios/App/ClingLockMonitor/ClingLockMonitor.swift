import DeviceActivity
import ManagedSettings
import FamilyControls
import Foundation

/// DeviceActivityMonitor extension (bundle app.clingnote.ios.lockmonitor). NOT yet an Xcode target: add it in Xcode
/// (File > New > Target > Device Activity Monitor Extension), include ../Shared/LockShared.swift. NEEDS ON-DEVICE TEST
/// and Family Controls (Distribution) on this extension App ID.
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
        guard activity == .clingLock else { return }
        store.shield.applications = nil; store.shield.applicationCategories = nil; store.shield.webDomains = nil
        LockShared.defaults?.set(["locked": false, "until": 0], forKey: LockShared.stateKey)
    }
}
