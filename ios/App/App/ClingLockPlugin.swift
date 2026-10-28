// App lock is off for this build: compiled only when CLING_APP_LOCK is defined (needs the Family Controls entitlement). See docs/APP_LOCKING_SETUP.md.
#if CLING_APP_LOCK
import Foundation
import Capacitor
import SwiftUI
#if canImport(FamilyControls)
import FamilyControls
import ManagedSettings
import DeviceActivity
#endif

/// App lock (Screen Time): authorization, app picker, shield on/off, DeviceActivity schedule so the
/// ClingLockMonitor extension lifts the shield at intervalDidEnd even if the app is closed.
/// NEEDS ON-DEVICE TESTING (cannot compile on Linux). JS: src/native/clingLock.js
@objc(ClingLockPlugin)
public class ClingLockPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ClingLockPlugin"
    public let jsName = "ClingLock"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startLock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopLock", returnType: CAPPluginReturnPromise),
    ]

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["status": "unsupported"]); return }
        Task { @MainActor in
            do { try await AuthorizationCenter.shared.requestAuthorization(for: .individual); call.resolve(["status": Self.authString()]) }
            catch { call.resolve(["status": Self.authString(), "error": "\(error)"]) }
        }
    }

    @available(iOS 16.0, *)
    static func authString() -> String {
        switch AuthorizationCenter.shared.authorizationStatus { case .approved: return "approved"; case .denied: return "denied"; default: return "notDetermined" }
    }

    @available(iOS 16.0, *)
    static func loadSelection() -> FamilyActivitySelection {
        guard let data = LockShared.defaults?.data(forKey: LockShared.selectionKey),
              let s = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) else { return FamilyActivitySelection() }
        return s
    }

    @objc func status(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["authorization": "unsupported", "locked": false, "selectionCount": 0]); return }
        let s = Self.loadSelection()
        let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
        call.resolve(["authorization": Self.authString(), "locked": (st["locked"] as? Bool) ?? false, "until": st["until"] ?? 0,
                      "selectionCount": s.applicationTokens.count + s.categoryTokens.count + s.webDomainTokens.count])
    }

    @objc func pickApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.reject("iOS 16 required"); return }
        DispatchQueue.main.async {
            let model = PickerModel(selection: Self.loadSelection())
            var host: UIViewController?
            let view = PickerView(model: model) { save in
                if save, let data = try? PropertyListEncoder().encode(model.selection) { LockShared.defaults?.set(data, forKey: LockShared.selectionKey) }
                host?.dismiss(animated: true)
                let s = model.selection
                call.resolve(["saved": save, "apps": s.applicationTokens.count, "categories": s.categoryTokens.count, "sites": s.webDomainTokens.count])
            }
            host = UIHostingController(rootView: view)
            self.bridge?.viewController?.present(host!, animated: true)
        }
    }

    @objc func startLock(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.reject("iOS 16 required"); return }
        let untilMs = call.getDouble("untilMs") ?? 0
        let until = Date(timeIntervalSince1970: untilMs / 1000)
        guard until.timeIntervalSinceNow > 60 else { call.reject("untilMs must be > 1 min ahead"); return }
        Self.applyShield()
        LockShared.defaults?.set(["locked": true, "until": untilMs, "label": call.getString("label") ?? ""], forKey: LockShared.stateKey)
        let cal = Calendar.current
        // DeviceActivity needs >= 15 min intervals; start a minute back so intervalDidStart re-applies right away.
        let start = cal.dateComponents([.year, .month, .day, .hour, .minute, .second], from: Date().addingTimeInterval(-60))
        let end = cal.dateComponents([.year, .month, .day, .hour, .minute, .second], from: max(until, Date().addingTimeInterval(15 * 60)))
        do {
            DeviceActivityCenter().stopMonitoring([.clingLock])
            try DeviceActivityCenter().startMonitoring(.clingLock, during: DeviceActivitySchedule(intervalStart: start, intervalEnd: end, repeats: false))
            call.resolve(["locked": true])
        } catch { call.resolve(["locked": true, "monitor": "failed: \(error)"]) } // shield is on; app clears it on next open past `until`
    }

    @objc func stopLock(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["locked": false]); return }
        Self.clearShield()
        DeviceActivityCenter().stopMonitoring([.clingLock])
        LockShared.defaults?.set(["locked": false, "until": 0], forKey: LockShared.stateKey)
        call.resolve(["locked": false])
    }

    @available(iOS 16.0, *)
    static func applyShield() {
        let s = loadSelection(); let store = ManagedSettingsStore(named: .clingLock)
        store.shield.applications = s.applicationTokens.isEmpty ? nil : s.applicationTokens
        store.shield.applicationCategories = s.categoryTokens.isEmpty ? nil : .specific(s.categoryTokens)
        store.shield.webDomains = s.webDomainTokens.isEmpty ? nil : s.webDomainTokens
    }
    @available(iOS 16.0, *)
    static func clearShield() {
        let store = ManagedSettingsStore(named: .clingLock)
        store.shield.applications = nil; store.shield.applicationCategories = nil; store.shield.webDomains = nil
    }
}

@available(iOS 16.0, *)
final class PickerModel: ObservableObject { @Published var selection: FamilyActivitySelection; init(selection: FamilyActivitySelection) { self.selection = selection } }

@available(iOS 16.0, *)
struct PickerView: View {
    @ObservedObject var model: PickerModel
    let done: (Bool) -> Void
    var body: some View {
        NavigationView {
            FamilyActivityPicker(selection: $model.selection)
                .navigationTitle("Apps to block")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { done(false) } }
                    ToolbarItem(placement: .confirmationAction) { Button("Save") { done(true) } }
                }
        }
    }
}

#endif
