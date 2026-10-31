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
        CAPPluginMethod(name: "scheduleLock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickNamedApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "labeledApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "lockApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlockApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickTaskApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "taskApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "allowTaskApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endTaskApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLockEndAlert", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleWakeLock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelWakeLock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setWakeSkip", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "wakeLockStatus", returnType: CAPPluginReturnPromise),
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
                      "monitoring": DeviceActivityCenter().activities.contains(.clingLock),
                      "selectionCount": s.applicationTokens.count + s.categoryTokens.count + s.webDomainTokens.count])
    }

    @objc func pickApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.reject("iOS 16 required"); return }
        DispatchQueue.main.async {
            let model = PickerModel(selection: Self.loadSelection())
            var host: UIViewController?
            let view = PickerView(model: model) { save in
                if save, let data = try? PropertyListEncoder().encode(model.selection) { LockShared.defaults?.set(data, forKey: LockShared.selectionKey); Self.saveSelectionTokens(model.selection) }
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
        LockShared.installLockEndSound()
        let untilMs = call.getDouble("untilMs") ?? 0
        let until = Date(timeIntervalSince1970: untilMs / 1000)
        guard until.timeIntervalSinceNow > 60 else { call.reject("untilMs must be > 1 min ahead"); return }
        Self.applyShield()
        LockShared.defaults?.set(["locked": true, "until": untilMs, "label": call.getString("label") ?? ""], forKey: LockShared.stateKey)
        AppLocks.cleanupExpired()
        // DeviceActivity needs >= 15 min intervals. The end is never pushed past `until`: with < 15 min left the
        // window is (until - 15 min ... until), which may start in the past so intervalDidStart re-applies right away.
        let startDate = min(Date().addingTimeInterval(-60), until.addingTimeInterval(-15 * 60))
        let start = AppLocks.comps(startDate), end = AppLocks.comps(until)
        do {
            DeviceActivityCenter().stopMonitoring([.clingLock])
            try DeviceActivityCenter().startMonitoring(.clingLock, during: DeviceActivitySchedule(intervalStart: start, intervalEnd: end, repeats: false))
            call.resolve(["locked": true, "monitor": "ok"])
        } catch {
            // No schedule means nothing would ever lift the shield: take it down rather than leave an un-expiring lock.
            Self.clearShield()
            DeviceActivityCenter().stopMonitoring([.clingLock])
            LockShared.defaults?.set(["locked": false, "until": 0], forKey: LockShared.stateKey)
            call.resolve(["locked": false, "monitor": "failed: \(error)"])
        }
    }

    @objc func stopLock(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["locked": false]); return }
        Self.clearShield()
        LockShared.defaults?.set(["locked": false, "until": 0], forKey: LockShared.stateKey) // before stop: extension sees "stopped by app"
        DeviceActivityCenter().stopMonitoring([.clingLock])
        // Evening mode: also stop scheduled blocks that already started or ended. FUTURE blocks stay: they were fixed before they
        // started and the app calls stopLock on every open while no block runs, which must not cancel tonight's block.
        let now = Date().timeIntervalSince1970 * 1000
        var m = ScheduledLocks.all(); let due = m.filter { $0.value.count == 2 && $0.value[0] <= now }.map { $0.key }
        if !due.isEmpty { due.forEach { m[$0] = nil }; ScheduledLocks.save(m); DeviceActivityCenter().stopMonitoring(due.map { ScheduledLocks.name($0) }) }
        call.resolve(["locked": false])
    }

    /// Evening mode: schedule a later lock-in block { startMs, untilMs, key } as its own DeviceActivity ("clingLockAt.<key>").
    /// The monitor extension raises the shield at startMs and lifts it at untilMs, even when ClingNote is not running.
    /// Same key again = no-op (blocks can't be moved or shortened). Limits: >= 15 min long, starts >= 1 min ahead.
    @objc func scheduleLock(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.reject("iOS 16 required"); return }
        let startMs = call.getDouble("startMs") ?? 0, untilMs = call.getDouble("untilMs") ?? 0
        let key = (call.getString("key") ?? "").filter { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
        guard !key.isEmpty else { call.reject("key required"); return }
        let start = Date(timeIntervalSince1970: startMs / 1000), until = Date(timeIntervalSince1970: untilMs / 1000)
        guard start.timeIntervalSinceNow > 60 else { call.reject("startMs must be > 1 min ahead"); return }
        guard until.timeIntervalSince(start) >= 15 * 60 else { call.reject("blocks under 15 min can't be scheduled"); return }
        LockShared.installLockEndSound()
        ScheduledLocks.cleanupExpired()
        var m = ScheduledLocks.all()
        if m[key] != nil, DeviceActivityCenter().activities.contains(ScheduledLocks.name(key)) { call.resolve(["scheduled": true, "monitor": "ok", "existing": true]); return }
        m[key] = [startMs, untilMs]; ScheduledLocks.save(m)
        do {
            try DeviceActivityCenter().startMonitoring(ScheduledLocks.name(key), during: DeviceActivitySchedule(intervalStart: AppLocks.comps(start), intervalEnd: AppLocks.comps(until), repeats: false))
            call.resolve(["scheduled": true, "monitor": "ok"])
        } catch {
            m[key] = nil; ScheduledLocks.save(m)
            call.resolve(["scheduled": false, "monitor": "failed: \(error)"])
        }
    }

    /// Wake-up auto-lock (B44): { hour, minute, minutes } -> one daily repeating DeviceActivity (WakeLock.activity). Re-scheduling with the
    /// same values is a no-op; new values replace the schedule. Needs Screen Time authorization and picked apps (checked here too).
    @objc func scheduleWakeLock(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.reject("iOS 16 required"); return }
        guard AuthorizationCenter.shared.authorizationStatus == .approved else { call.resolve(["scheduled": false, "monitor": "not-authorized"]); return }
        let sel = ClingLockPlugin.loadSelection()
        guard !(sel.applicationTokens.isEmpty && sel.categoryTokens.isEmpty && sel.webDomainTokens.isEmpty) else { call.resolve(["scheduled": false, "monitor": "no-apps"]); return }
        let h = call.getInt("hour") ?? -1, m = call.getInt("minute") ?? -1
        guard (0...23).contains(h), (0...59).contains(m) else { call.reject("hour/minute required"); return }
        let n = WakeLock.clampMinutes(call.getInt("minutes") ?? 0)
        let cfg: [String: Int] = ["hour": h, "minute": m, "minutes": n]
        if let c = WakeLock.config(), c.hour == h, c.minute == m, c.minutes == n, DeviceActivityCenter().activities.contains(WakeLock.activity) {
            call.resolve(["scheduled": true, "monitor": "ok", "existing": true]); return
        }
        LockShared.installLockEndSound()
        LockShared.defaults?.set(cfg, forKey: WakeLock.configKey)
        let endMin = (h * 60 + m + n) % (24 * 60)
        do {
            DeviceActivityCenter().stopMonitoring([WakeLock.activity])
            try DeviceActivityCenter().startMonitoring(WakeLock.activity, during: DeviceActivitySchedule(
                intervalStart: DateComponents(hour: h, minute: m), intervalEnd: DateComponents(hour: endMin / 60, minute: endMin % 60), repeats: true))
            call.resolve(["scheduled": true, "monitor": "ok"])
        } catch {
            LockShared.defaults?.removeObject(forKey: WakeLock.configKey)
            call.resolve(["scheduled": false, "monitor": "failed: \(error)"])
        }
    }
    @objc func cancelWakeLock(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["cancelled": false]); return }
        DeviceActivityCenter().stopMonitoring([WakeLock.activity]); LockShared.defaults?.removeObject(forKey: WakeLock.configKey)
        call.resolve(["cancelled": true])
    }
    /// "Skip lock-in today": the monitor won't lock on this device-local date ("yyyy-MM-dd"). A lock already up today comes down.
    @objc func setWakeSkip(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["skip": ""]); return }
        let ymd = call.getString("ymd") ?? ""
        LockShared.defaults?.set(ymd, forKey: WakeLock.skipKey)
        let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
        if ymd == WakeLock.ymd(Date()), (st["label"] as? String) == WakeLock.label { ClingLockPlugin.clearShield(); LockShared.defaults?.set(["locked": false, "until": 0], forKey: LockShared.stateKey) }
        call.resolve(["skip": ymd])
    }
    @objc func wakeLockStatus(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["scheduled": false]); return }
        var r: [String: Any] = ["scheduled": DeviceActivityCenter().activities.contains(WakeLock.activity),
                                "lastStartMs": LockShared.defaults?.double(forKey: WakeLock.lastStartKey) ?? 0,
                                "skip": LockShared.defaults?.string(forKey: WakeLock.skipKey) ?? ""]
        if let c = WakeLock.config() { r["hour"] = c.hour; r["minute"] = c.minute; r["minutes"] = c.minutes }
        call.resolve(r)
    }

    /// Lock-end notification level read by ClingLockMonitor.notifyLockEnded(). Omit `level` to just read it.
    @objc func setLockEndAlert(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["level": "loud"]); return }
        LockShared.installLockEndSound()
        if let l = call.getString("level") {
            guard LockShared.lockEndAlertLevels.contains(l) else { call.reject("invalid level"); return }
            LockShared.defaults?.set(l, forKey: LockShared.lockEndAlertKey)
        }
        call.resolve(["level": LockShared.defaults?.string(forKey: LockShared.lockEndAlertKey) ?? LockShared.lockEndAlertDefault])
    }

    // MARK: per-app locks by label (assistant: "lock TikTok and YouTube for 2 hours", "unlock YouTube")

    @available(iOS 16.0, *)
    static func appsPayload() -> [[String: Any]] {
        let l = AppLocks.locked()
        return AppLocks.apps().map { ["id": $0.id, "label": $0.label, "locked": l[$0.id] != nil, "until": l[$0.id] ?? 0] }
    }

    @objc func labeledApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["apps": []]); return }
        AppLocks.cleanupExpired(); call.resolve(["apps": Self.appsPayload(), "authorization": Self.authString()])
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
        LockShared.installLockEndSound()
        guard AuthorizationCenter.shared.authorizationStatus == .approved else { call.resolve(["locked": [], "error": "not_authorized"]); return }
        let want = Set(((call.getArray("labels") as? [String]) ?? []).map { $0.lowercased() })
        let untilMs = call.getDouble("untilMs") ?? 0
        let hits = AppLocks.apps().filter { want.contains($0.label.lowercased()) }
        AppLocks.cleanupExpired()
        var l = AppLocks.locked(); var warn: [String] = []
        for a in hits { l[a.id] = untilMs }
        AppLocks.saveLocked(l) // before stop/start: a restart-triggered intervalDidEnd must see the new (future) end
        for a in hits {
            l[a.id] = untilMs
            let name = DeviceActivityName(AppLocks.activityPrefix + a.id)
            DeviceActivityCenter().stopMonitoring([name])
            if untilMs > 0 {
                let until = Date(timeIntervalSince1970: untilMs / 1000)
                                let startDate = min(Date().addingTimeInterval(-60), until.addingTimeInterval(-15 * 60)) // >= 15 min, end stays `until`
                do { try DeviceActivityCenter().startMonitoring(name, during: DeviceActivitySchedule(intervalStart: AppLocks.comps(startDate), intervalEnd: AppLocks.comps(until), repeats: false)) }
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
        for a in hits { l[a.id] = nil }
        AppLocks.saveLocked(l) // before stop: the extension's intervalDidEnd must see no entry (no alert)
        for a in hits { DeviceActivityCenter().stopMonitoring([DeviceActivityName(AppLocks.activityPrefix + a.id)]) }
        AppLocks.apply()
        call.resolve(["unlocked": hits.map { $0.label }, "apps": Self.appsPayload()])
    }

    // MARK: per-task app unlock (TaskAllow in Shared/LockShared.swift; state machine in src/utils/taskAppUnlock.js)

    /// FamilyActivityPicker (apps only) preselected with the task's saved apps. -> {saved, count}
    @objc func pickTaskApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.reject("iOS 16 required"); return }
        guard let id = call.getString("taskId"), !id.isEmpty else { call.reject("taskId required"); return }
        DispatchQueue.main.async {
            var sel = FamilyActivitySelection(); sel.applicationTokens = Set(TaskAllow.apps(id))
            let model = PickerModel(selection: sel)
            var host: UIViewController?
            let view = PickerView(model: model) { save in
                if save { TaskAllow.setApps(id, Array(model.selection.applicationTokens)); if TaskAllow.active()?.taskId == id { TaskAllow.reapply() } }
                host?.dismiss(animated: true)
                call.resolve(["saved": save, "count": TaskAllow.apps(id).count])
            }
            host = UIHostingController(rootView: view)
            self.bridge?.viewController?.present(host!, animated: true)
        }
    }
    /// -> {count, active: {taskId, untilMs} | null}. Also expires a stale allowance (relaunch after a kill).
    @objc func taskApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["count": 0]); return }
        TaskAllow.expireIfNeeded()
        let a = TaskAllow.active()
        call.resolve(["count": TaskAllow.apps(call.getString("taskId") ?? "").count,
                      "active": a.map { ["taskId": $0.taskId, "untilMs": $0.until, "count": TaskAllow.apps($0.taskId).count] } as Any])
    }
    /// Takes the task's apps off every shield until untilMs (or endTaskApps). The DeviceActivity end re-locks in the extension.
    @objc func allowTaskApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["allowed": 0]); return }
        guard let id = call.getString("taskId"), !id.isEmpty else { call.reject("taskId required"); return }
        let untilMs = call.getDouble("untilMs") ?? 0
        let until = Date(timeIntervalSince1970: untilMs / 1000)
        guard until.timeIntervalSinceNow > 60, !TaskAllow.apps(id).isEmpty else { call.resolve(["allowed": 0]); return }
        TaskAllow.setActive(id, until: untilMs)
        let startDate = min(Date().addingTimeInterval(-60), until.addingTimeInterval(-15 * 60)) // >= 15 min window, never past until
        do {
            DeviceActivityCenter().stopMonitoring([.clingTask])
            try DeviceActivityCenter().startMonitoring(.clingTask, during: DeviceActivitySchedule(intervalStart: AppLocks.comps(startDate), intervalEnd: AppLocks.comps(until), repeats: false))
        } catch {
            TaskAllow.clearActive(); TaskAllow.reapply() // no schedule = nothing would re-lock: refuse rather than leave apps open
            call.resolve(["allowed": 0, "monitor": "failed: \(error)"]); return
        }
        TaskAllow.reapply()
        call.resolve(["allowed": TaskAllow.apps(id).count, "untilMs": untilMs, "monitor": "ok"])
    }
    /// Task completed / ended early / timer done: re-lock now. Optional taskId only ends that task's allowance.
    @objc func endTaskApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["ended": false]); return }
        if let id = call.getString("taskId"), let a = TaskAllow.active(), a.taskId != id { call.resolve(["ended": false]); return }
        TaskAllow.clearActive() // before stop: the extension's intervalDidEnd must see no allowance
        DeviceActivityCenter().stopMonitoring([.clingTask])
        TaskAllow.reapply()
        call.resolve(["ended": true])
    }

    @available(iOS 16.0, *)
    static func applyShield() {
        saveSelectionTokens(loadSelection()); LockIn.shield() // minus the running task's allowed apps (TaskAllow)
    }
    @available(iOS 16.0, *)
    static func saveSelectionTokens(_ s: FamilyActivitySelection) {
        let t = LockSelectionTokens(apps: s.applicationTokens, categories: s.categoryTokens, domains: s.webDomainTokens)
        if let d = try? JSONEncoder().encode(t) { LockShared.defaults?.set(d, forKey: LockShared.selectionTokensKey) }
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
