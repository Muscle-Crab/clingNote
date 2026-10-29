// App lock (Screen Time): compiled when CLING_APP_LOCK is defined (on for build 35+, needs the Family Controls entitlement). See docs/APP_LOCKING_SETUP.md.
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
        CAPPluginMethod(name: "pickNamedApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "labeledApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "lockApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlockApps", returnType: CAPPluginReturnPromise),
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


    // MARK: per-app locks by label (assistant: "lock TikTok and YouTube for 2 hours", "unlock YouTube")

    @available(iOS 16.0, *)
    static func appsPayload() -> [[String: Any]] {
        let l = AppLocks.locked()
        return AppLocks.apps().map { ["id": $0.id, "label": $0.label, "locked": l[$0.id] != nil, "until": l[$0.id] ?? 0] }
    }

    @objc func labeledApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["apps": []]); return }
        AppLocks.apply(); call.resolve(["apps": Self.appsPayload(), "authorization": Self.authString()])
    }

    /// FamilyActivityPicker (preselected with saved apps) then a naming step: Apple shows each app's real name/icon
    /// (Label(token)) to the user but never to us, so the user confirms the name we store. `suggest` prefills new rows.
    @objc func pickNamedApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.reject("iOS 16 required"); return }
        let suggest = (call.getArray("suggest") as? [String]) ?? []
        DispatchQueue.main.async {
            var sel = FamilyActivitySelection(); sel.applicationTokens = Set(AppLocks.apps().map { $0.token })
            let model = PickerModel(selection: sel)
            var host: UIViewController?
            let view = NamedPickerView(model: model, existing: AppLocks.apps(), suggest: suggest) { result in
                host?.dismiss(animated: true)
                guard let result = result else { call.resolve(["saved": false, "apps": Self.appsPayload()]); return }
                AppLocks.saveApps(result)
                var l = AppLocks.locked(); let ids = Set(result.map { $0.id }); l = l.filter { ids.contains($0.key) }; AppLocks.saveLocked(l); AppLocks.apply()
                call.resolve(["saved": true, "apps": Self.appsPayload()])
            }
            host = UIHostingController(rootView: view)
            self.bridge?.viewController?.present(host!, animated: true)
        }
    }

    /// labels: [String] (already resolved to saved labels by JS); untilMs: Double? (absent/0 = until unlocked).
    @objc func lockApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.reject("iOS 16 required"); return }
        guard AuthorizationCenter.shared.authorizationStatus == .approved else { call.resolve(["locked": [], "error": "not_authorized"]); return }
        let want = Set(((call.getArray("labels") as? [String]) ?? []).map { $0.lowercased() })
        let untilMs = call.getDouble("untilMs") ?? 0
        let hits = AppLocks.apps().filter { want.contains($0.label.lowercased()) }
        var l = AppLocks.locked(); var warn: [String] = []
        let cal = Calendar.current; let comps: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
        for a in hits {
            l[a.id] = untilMs
            let name = DeviceActivityName(AppLocks.activityPrefix + a.id)
            DeviceActivityCenter().stopMonitoring([name])
            if untilMs > 0 {
                let until = Date(timeIntervalSince1970: untilMs / 1000)
                // DeviceActivity needs >= 15 min; shorter locks are cleared by the app (apply() drops expired) on next open.
                let end = max(until, Date().addingTimeInterval(15 * 60))
                do { try DeviceActivityCenter().startMonitoring(name, during: DeviceActivitySchedule(intervalStart: cal.dateComponents(comps, from: Date().addingTimeInterval(-60)), intervalEnd: cal.dateComponents(comps, from: end), repeats: false)) }
                catch { warn.append("\(a.label): \(error)") }
            }
        }
        AppLocks.saveLocked(l); AppLocks.apply()
        call.resolve(["locked": hits.map { $0.label }, "untilMs": untilMs, "apps": Self.appsPayload(), "warnings": warn])
    }

    @objc func unlockApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["unlocked": []]); return }
        let raw = (call.getArray("labels") as? [String]) ?? []
        let all = raw.isEmpty || raw.contains("*")
        let want = Set(raw.map { $0.lowercased() })
        let hits = AppLocks.apps().filter { all || want.contains($0.label.lowercased()) }
        var l = AppLocks.locked()
        for a in hits { l[a.id] = nil; DeviceActivityCenter().stopMonitoring([DeviceActivityName(AppLocks.activityPrefix + a.id)]) }
        AppLocks.saveLocked(l); AppLocks.apply()
        call.resolve(["unlocked": hits.map { $0.label }, "apps": Self.appsPayload()])
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

/// Picker, then "Name your apps": one row per picked app showing Apple's Label (real name + icon, visible only to the
/// user) and a name field. Saved names are what the assistant matches ("TikTok", "YouTube").
@available(iOS 16.0, *)
struct NamedPickerView: View {
    @ObservedObject var model: PickerModel
    let existing: [LabeledApp]
    let suggest: [String]
    let done: ([LabeledApp]?) -> Void
    @State private var naming = false
    @State private var rows: [LabeledApp] = []
    var body: some View {
        NavigationView {
            if naming {
                List {
                    Section(footer: Text("Type the name you'll say, like \"TikTok\". Apple keeps app names private, so ClingNote only knows the names you confirm here.")) {
                        ForEach($rows, id: \.id) { $r in
                            HStack { Label(r.token); Spacer(); TextField("App name", text: $r.label).textInputAutocapitalization(.words) }
                        }
                    }
                }
                .navigationTitle("Name your apps")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Back") { naming = false } }
                    ToolbarItem(placement: .confirmationAction) { Button("Done") {
                        done(rows.map { var r = $0; r.label = r.label.trimmingCharacters(in: .whitespaces); return r }.filter { !$0.label.isEmpty })
                    }.disabled(rows.contains { $0.label.trimmingCharacters(in: .whitespaces).isEmpty }) }
                }
            } else {
                FamilyActivityPicker(selection: $model.selection)
                    .navigationTitle("Choose apps")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { done(nil) } }
                        ToolbarItem(placement: .confirmationAction) { Button("Next") { buildRows(); naming = true }.disabled(model.selection.applicationTokens.isEmpty) }
                    }
            }
        }
    }
    private func buildRows() {
        var pending = suggest.filter { s in !existing.contains { $0.label.lowercased() == s.lowercased() } }
        rows = model.selection.applicationTokens.map { t in
            if let e = existing.first(where: { $0.token == t }) { return e }
            let name = pending.isEmpty ? "" : pending.removeFirst()
            return LabeledApp(id: UUID().uuidString, label: name, token: t)
        }.sorted { ($0.label.isEmpty ? 1 : 0, $0.label) < ($1.label.isEmpty ? 1 : 0, $1.label) }
    }
}

#endif
