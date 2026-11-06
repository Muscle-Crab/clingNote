// App lock (Screen Time): compiled when CLING_APP_LOCK is defined (on for build 35+, needs the Family Controls entitlement). See docs/APP_LOCKING_SETUP.md.
#if CLING_APP_LOCK
import Foundation
import Capacitor
import UserNotifications
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
        CAPPluginMethod(name: "setShieldFriend", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLockEndAlert", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleWakeLock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelWakeLock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setWakeSkip", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "wakeLockStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startBreak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endBreak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "breakState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "offerBreak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearBreakOffer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelScheduledLock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "armDebtHold", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearDebtHold", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "debtHoldStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "allowVaultApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endVaultApps", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "vaultState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startUsage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "vaultUsage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readVaultReport", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveVaultReport", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "celebrateVault", returnType: CAPPluginReturnPromise),
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

    /// Seed for a NEW session's picker (src/utils/sessionApps.js pickerSeed): the previous session's last-used selection, else the current
    /// global selection (loadSelection, empty when none).
    @available(iOS 16.0, *)
    static func sessionSeedSelection() -> FamilyActivitySelection {
        if let data = LockShared.defaults?.data(forKey: LockShared.lastUsedSelectionKey),
           let s = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) { return s }
        return loadSelection()
    }

    @objc func status(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["authorization": "unsupported", "locked": false, "selectionCount": 0]); return }
        let s = Self.loadSelection()
        let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
        // Game plan: remember that Screen Time was approved once, so a later revoke is detected on the next launch (JS books the penalty).
        let auth = Self.authString()
        if auth == "approved" { LockShared.defaults?.set(true, forKey: "cn.everApproved") }
        let everApproved = LockShared.defaults?.bool(forKey: "cn.everApproved") ?? false
        call.resolve(["authorization": auth, "everApproved": everApproved, "locked": (st["locked"] as? Bool) ?? false, "until": st["until"] ?? 0,
                      "monitoring": DeviceActivityCenter().activities.contains(.clingLock),
                      "selectionCount": s.applicationTokens.count + s.categoryTokens.count + s.webDomainTokens.count])
    }

    /// Same rule as lockActive() in src/utils/lockedAppsRow.js: shield state says locked and its end (0 = open) is in the future.
    static func lockIsActive(nowMs: Double = Date().timeIntervalSince1970 * 1000) -> Bool {
        let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
        guard (st["locked"] as? Bool) == true else { return false }
        let until = (st["until"] as? Double) ?? Double((st["until"] as? Int) ?? 0)
        return until <= 0 || until > nowMs
    }

    @objc func pickApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.reject("iOS 16 required"); return }
        DispatchQueue.main.async {
            // session: true = the picker for a new session, pre-filled with the last-used selection (kept or edited before Begin).
            let forSession = call.getBool("session") ?? false
            let model = PickerModel(selection: forSession ? Self.sessionSeedSelection() : Self.loadSelection())
            var host: UIViewController?
            let view = PickerView(model: model) { save in
                // The user can add or remove apps during a lock-in. Whatever remains is shielded again;
                // a removed app leaves the shield. This does not bypass the points vault for apps they keep.
                let s = model.selection
                if save, let data = try? PropertyListEncoder().encode(s) {
                    LockShared.defaults?.set(data, forKey: LockShared.selectionKey); Self.saveSelectionTokens(s)
                    VaultCatalog.sync(selectionTokens: s.applicationTokens, labeled: AppLocks.apps())
                    if Self.lockIsActive() { Self.applyShield() }
                }
                host?.dismiss(animated: true)
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
        // Begin of a session: the selection it locks becomes the "last used" one that seeds the next session's picker.
        if call.getBool("sessionBegin") ?? false, let data = LockShared.defaults?.data(forKey: LockShared.selectionKey) { LockShared.defaults?.set(data, forKey: LockShared.lastUsedSelectionKey) }
        // Same Begin drops any vault allowance first. applyShield subtracts VaultAllow, so a previous session's buys would stay open.
        if call.getBool("sessionBegin") ?? false { VaultAllow.clearActive(); DeviceActivityCenter().stopMonitoring([.clingVault]) }
        Self.applyShield()
        LockShared.defaults?.set(["locked": true, "until": untilMs, "label": call.getString("label") ?? ""], forKey: LockShared.stateKey)
        AppLocks.cleanupExpired()
        // DeviceActivity needs >= 15 min intervals and rejects > 1 week (intervalTooLong): arm the first <= 6.5-day segment of a chain
        // (ScheduleChain; the monitor re-arms at each segment end, the app on sync). The start may be backdated so intervalDidStart re-applies.
        let nowMs = Date().timeIntervalSince1970 * 1000
        guard let seg = ScheduleChain.segment(startMs: nowMs, untilMs: untilMs, nowMs: nowMs) else { call.reject("untilMs must be > 1 min ahead"); return }
        LockShared.defaults?.set(seg.endMs, forKey: ScheduleChain.lockSegKey)
        do {
            DeviceActivityCenter().stopMonitoring([.clingLock])
            try DeviceActivityCenter().startMonitoring(.clingLock, during: ScheduleChain.schedule(seg))
            call.resolve(["locked": true, "monitor": "ok", "segEndMs": seg.endMs])
        } catch {
            DeviceActivityCenter().stopMonitoring([.clingLock])
            LockShared.defaults?.removeObject(forKey: ScheduleChain.lockSegKey)
            // A missed-goal hold is active: never drop the shield on an arm failure (its own clingDebt chain lifts it at the real end).
            if DebtHold.keepShieldIfHeld(nowMs: nowMs) { Self.applyShield(); call.resolve(["locked": true, "monitor": "failed: \(error)", "heldByDebt": true]); return }
            // No schedule means nothing would ever lift the shield: take it down rather than leave an un-expiring lock.
            Self.clearShield()
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
    /// Optional friend-approved unlock (default off): the shield only mentions a friend when this is on.
    @objc func setShieldFriend(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        LockShared.defaults?.set(on, forKey: "clingShieldFriend")
        call.resolve(["on": on])
    }

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
                let previous = AppLocks.apps()
                let kept = Set(result.map { $0.token })
                let removed = Set(previous.filter { !kept.contains($0.token) }.map { $0.token })
                AppLocks.saveApps(result)
                var l = AppLocks.locked(); let ids = Set(result.map { $0.id }); l = l.filter { ids.contains($0.key) }; AppLocks.saveLocked(l); AppLocks.apply()
                if !removed.isEmpty {
                    var sel = Self.loadSelection()
                    sel.applicationTokens.subtract(removed)
                    if let data = try? PropertyListEncoder().encode(sel) { LockShared.defaults?.set(data, forKey: LockShared.selectionKey); Self.saveSelectionTokens(sel) }
                }
                VaultCatalog.sync(selectionTokens: Self.loadSelection().applicationTokens, labeled: result)
                if Self.lockIsActive() { Self.applyShield() }
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

    // ---- earned breaks (BreakState in Shared/LockShared.swift) ----
    override public func load() { if #available(iOS 16.0, *) { DispatchQueue.main.async { ClingBreakNotify.install() } } } // after Capacitor's router
    /// Take break (Home): lift every shield until untilMs; the monitor re-locks at the end even if the app is closed.
    @objc func startBreak(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["started": false]); return }
        let untilMs = call.getDouble("untilMs") ?? 0; let minutes = call.getInt("minutes") ?? Int(((untilMs - Date().timeIntervalSince1970 * 1000) / 60000).rounded())
        if let err = BreakState.begin(untilMs: untilMs, minutes: minutes) { call.resolve(["started": false, "monitor": err]); return }
        LockShared.defaults?.removeObject(forKey: BreakState.offerKey)
        call.resolve(["started": true, "untilMs": untilMs, "monitor": "ok"])
    }
    /// End a break early: re-lock now and cancel "Break's over".
    @objc func endBreak(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["ended": false]); return }
        let live = BreakState.isLive(); BreakState.end(early: live); call.resolve(["ended": live])
    }
    /// Current break + breaks taken from the notification while the app was closed (drained: JS books them once).
    @objc func breakState(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["live": false, "untilMs": 0, "taken": []]); return }
        let taken = (LockShared.defaults?.array(forKey: BreakState.takenKey) as? [[String: Double]]) ?? []
        LockShared.defaults?.removeObject(forKey: BreakState.takenKey)
        if BreakState.until() > 0 && !BreakState.isLive() { BreakState.end(early: false) } // missed monitor callback: re-lock now
        call.resolve(["live": BreakState.isLive(), "untilMs": BreakState.until(), "taken": taken])
    }
    /// Points tier reached: post the "You hit N points" alert with a Take break action (works from the lock screen / app closed).
    /// Thresholds no longer met (tasks un-done, new day): drop the stored offer and its alert so its action can't start a break.
    @objc func clearBreakOffer(_ call: CAPPluginCall) {
        LockShared.defaults?.removeObject(forKey: BreakState.offerKey)
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["cn.break.offer"])
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ["cn.break.offer"])
        call.resolve(["cleared": true])
    }
    /// Session met before its end: cancel the scheduled 2 h miss lock (scheduleLock key).
    @objc func cancelScheduledLock(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["cancelled": false]); return }
        let key = (call.getString("key") ?? "").filter { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
        guard !key.isEmpty else { call.resolve(["cancelled": false]); return }
        var m = ScheduledLocks.all(); let e = m[key]; m[key] = nil; ScheduledLocks.save(m)
        // A block that already started raised the shield and set the lock state to its end; with its entry gone, the monitor's
        // intervalDidEnd sees untilMs 0 and leaves the shield up. Lift it here unless a longer lock (own .clingLock) still runs.
        let now = Date().timeIntervalSince1970 * 1000
        if let e = e, e.count == 2, e[0] <= now, now < e[1] {
            let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
            let curUntil = (st["until"] as? Double) ?? Double((st["until"] as? Int) ?? 0)
            if curUntil <= e[1] + 60_000 { LockShared.defaults?.set(["locked": false, "until": 0], forKey: LockShared.stateKey); Self.clearShield() }
        }
        DeviceActivityCenter().stopMonitoring([ScheduledLocks.name(key)])
        call.resolve(["cancelled": true])
    }
    /// Missed-goal hold { key, startMs, untilMs }: startMs = the short session's end (future: armed ahead so a force-quit app still
    /// locks at the end) or a past miss (shield goes up now). Same key while monitored = no-op; a new key replaces the hold.
    @objc func armDebtHold(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["armed": false, "monitor": "unsupported"]); return }
        let key = (call.getString("key") ?? "").filter { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
        let startMs = call.getDouble("startMs") ?? 0, untilMs = call.getDouble("untilMs") ?? 0
        let nowMs = Date().timeIntervalSince1970 * 1000
        guard !key.isEmpty, startMs > 0, untilMs > nowMs + 60_000 else { call.reject("key, startMs and a future untilMs required"); return }
        if let e = DebtHold.entry(), e.key == key, e.untilMs == untilMs, DeviceActivityCenter().activities.contains(DebtHold.activity) {
            if DebtHold.isActive(nowMs: nowMs) { Self.applyShield() } // re-assert (e.g. after the app lifted it for a break)
            call.resolve(["armed": true, "monitor": "ok", "existing": true]); return
        }
        LockShared.installLockEndSound()
        // Chain of <= 6.5-day segments (iOS caps a schedule at one week; the 14-day hold used to fail with intervalTooLong and be
        // dropped). The monitor re-arms the next segment at each segment end; the app re-calls this on every sync.
        DebtHold.save(key: key, startMs: startMs, untilMs: untilMs) // before stop/start: a restart-triggered intervalDidEnd sees a future end
        let err = DebtHold.armSegment(nowMs: nowMs)
        if startMs <= nowMs {
            // Raise the shield whether or not the schedule armed: a failed arm keeps the hold (entry stays) and the shield up.
            Self.applyShield()
            let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
            let curUntil = (st["until"] as? Double) ?? Double((st["until"] as? Int) ?? 0)
            LockShared.defaults?.set(["locked": true, "until": max(untilMs, curUntil), "label": "ClingNote lock-in"], forKey: LockShared.stateKey)
        }
        if let err = err { call.resolve(["armed": false, "kept": true, "monitor": "failed: \(err)"]); return }
        call.resolve(["armed": true, "monitor": "ok", "segEndMs": DebtHold.segEnd()])
    }
    /// A later session reached its goal (or the lock was turned off): drop the hold and lift the shield unless another lock still runs.
    @objc func clearDebtHold(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["cleared": false]); return }
        let had = DebtHold.entry(); let nowMs = Date().timeIntervalSince1970 * 1000
        DebtHold.clear() // before stop: the extension's intervalDidEnd sees no hold
        DeviceActivityCenter().stopMonitoring([DebtHold.activity])
        if let e = had, DebtHold.holds(startMs: e.startMs, untilMs: e.untilMs, nowMs: nowMs) {
            let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
            let curUntil = (st["until"] as? Double) ?? Double((st["until"] as? Int) ?? 0)
            let other = DeviceActivityCenter().activities.contains(.clingLock) && curUntil > nowMs && curUntil < e.untilMs - 60_000
            if !other { LockShared.defaults?.set(["locked": false, "until": 0], forKey: LockShared.stateKey); Self.clearShield() }
        }
        call.resolve(["cleared": had != nil])
    }
    @objc func debtHoldStatus(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["armed": false]); return }
        let e = DebtHold.entry()
        call.resolve(["armed": e != nil, "key": e?.key ?? "", "startMs": e?.startMs ?? 0, "untilMs": e?.untilMs ?? 0, "active": DebtHold.isActive(),
                      "monitoring": DeviceActivityCenter().activities.contains(DebtHold.activity)])
    }

    // ---- points vault (VaultAllow / UsageLog in Shared/LockShared.swift; logic in src/utils/pointsVault.js) ----
    /// Opens the given labeled apps (ids) until untilMs = the shared app time bought with points. >= 15 min DeviceActivity window
    /// (backdated start); its intervalDidEnd re-shields with the app closed. Refused while a missed-goal hold is active.
    @objc func allowVaultApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["allowed": 0]); return }
        let ids = (call.getArray("ids") as? [String]) ?? []; let untilMs = call.getDouble("untilMs") ?? 0
        let nowMs = Date().timeIntervalSince1970 * 1000
        if DebtHold.isActive(nowMs: nowMs) { call.resolve(["allowed": 0, "reason": "debt"]); return }
        guard !ids.isEmpty, untilMs > nowMs + 60_000 else { call.resolve(["allowed": 0]); return }
        VaultAllow.setActive(ids, until: untilMs)
        let until = Date(timeIntervalSince1970: untilMs / 1000)
        let startDate = min(Date().addingTimeInterval(-60), until.addingTimeInterval(-15 * 60))
        do {
            DeviceActivityCenter().stopMonitoring([.clingVault])
            try DeviceActivityCenter().startMonitoring(.clingVault, during: DeviceActivitySchedule(intervalStart: AppLocks.comps(startDate), intervalEnd: AppLocks.comps(until), repeats: false))
        } catch {
            VaultAllow.clearActive(); TaskAllow.reapply() // nothing would re-lock: refuse rather than leave apps open
            call.resolve(["allowed": 0, "monitor": "failed: \(error)"]); return
        }
        TaskAllow.reapply()
        call.resolve(["allowed": ids.count, "untilMs": untilMs, "monitor": "ok"])
    }
    @objc func endVaultApps(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["ended": false]); return }
        let had = VaultAllow.active() != nil
        VaultAllow.clearActive(); DeviceActivityCenter().stopMonitoring([.clingVault]); TaskAllow.reapply()
        call.resolve(["ended": had])
    }
    @objc func vaultState(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["ids": [], "untilMs": 0, "live": false]); return }
        VaultAllow.expireIfNeeded()
        let a = VaultAllow.active(); let nowMs = Date().timeIntervalSince1970 * 1000
        call.resolve(["ids": a?.ids ?? [], "untilMs": a?.until ?? 0, "live": a.map { VaultAllow.isLive(until: $0.until, nowMs: nowMs) } ?? false])
    }
    /// Owner-supplied Screen Time rows. App Group vault.report.v1 only. Does not write usage.daily.v1 and does not read the iOS report.
    @objc func readVaultReport(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["rows": []]); return }
        let d = LockShared.defaults?.dictionary(forKey: "vault.report.v1") ?? [:]
        call.resolve(["adoptedAt": d["adoptedAt"] ?? "", "periodDays": d["periodDays"] ?? 0, "rows": d["rows"] ?? []])
    }
    @objc func saveVaultReport(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["saved": false]); return }
        var rows: [[String: Any]] = []
        for item in call.getArray("rows") ?? [] {
            guard let d = item as? [String: Any] else { continue }
            let label = String(describing: d["label"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let minutes = (d["minutes"] as? NSNumber)?.intValue ?? Int(d["minutes"] as? Double ?? -1)
            if label.isEmpty || label.lowercased() == "app" || minutes < 0 { continue }
            rows.append(["label": label, "minutes": minutes])
        }
        var payload: [String: Any] = ["adoptedAt": call.getString("adoptedAt") ?? "", "rows": rows]
        let days = call.getInt("periodDays") ?? 0
        if days > 0 && days <= 366 { payload["periodDays"] = days }
        LockShared.defaults?.set(payload, forKey: "vault.report.v1")
        call.resolve(["saved": true, "count": rows.count])
    }
    /// Starts / refreshes the daily "clingUsage" threshold monitor for the labeled apps (no-op when unchanged).
    /// This records threshold buckets in usage.daily.v1. It does not read or replace the Screen Time report.
    @objc func startUsage(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["monitor": "unsupported"]); return }
        VaultCatalog.sync(selectionTokens: Self.loadSelection().applicationTokens, labeled: AppLocks.apps())
        call.resolve(["monitor": UsageLog.ensure()])
    }
    /// On-device usage buckets { days, apps: [{ id, label, icon }] }. Apps are the user's chosen set
    /// (lock-in selection union named apps), ranked later in pointsVault.js by these Screen Time buckets.
    @objc func vaultUsage(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["days": [:], "apps": []]); return }
        let items = VaultCatalog.sync(selectionTokens: Self.loadSelection().applicationTokens, labeled: AppLocks.apps())
        let apps: [[String: Any]] = items.map { a in
            var row: [String: Any] = ["id": a.id, "label": a.label]
            let icon = Self.iconBase64(a.id, a.token)
            if !icon.isEmpty { row["icon"] = "data:image/png;base64,\(icon)" }
            return row
        }
        call.resolve(["days": UsageLog.all(), "apps": apps])
    }
    /// Real home-screen icon for an opaque ApplicationToken. Only Label can draw it; ImageRenderer snapshots that for the web vault row.
    @available(iOS 16.0, *)
    static var iconCache: [String: String] = [:]
    @available(iOS 16.0, *)
    static func iconBase64(_ id: String, _ token: ApplicationToken) -> String {
        if let hit = iconCache[id], !hit.isEmpty { return hit }
        // ImageRenderer / Label / uiImage are MainActor-isolated. Being on the main thread is not enough for
        // Swift 6; assumeIsolated is the sync assertion. Off the main thread, main.sync gets us there first.
        let draw = { () -> String in
            MainActor.assumeIsolated {
                let r = ImageRenderer(content: Label(token).labelStyle(.iconOnly).frame(width: 48, height: 48))
                r.scale = 2
                return r.uiImage?.pngData()?.base64EncodedString() ?? ""
            }
        }
        let b64 = Thread.isMainThread ? draw() : DispatchQueue.main.sync(execute: draw)
        if !b64.isEmpty { iconCache[id] = b64 }
        return b64
    }
    /// Vault unlock celebration with the apps' REAL icons + names. ApplicationTokens are opaque: only Apple's Label(token) can draw
    /// them, so this is a native SwiftUI overlay (VaultUnlockView) over the web view. ids = labeled app ids that just opened.
    /// Resolves at once { shown, missing }: shown = icons on screen (0 = nothing presented -> JS shows the web celebration);
    /// missing = ids with no saved token (JS celebrates those on the web). Once-per-app-per-day stays in JS (cn.vault.celebrated.v1).
    @objc func celebrateVault(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["shown": 0, "missing": call.getArray("ids") ?? []]); return }
        let ids = (call.getArray("ids") as? [String]) ?? []
        let saved = VaultCatalog.apps(); let named = AppLocks.apps(); var apps: [LabeledApp] = []; var missing: [String] = []
        for id in ids {
            if let a = saved.first(where: { $0.id == id }) { apps.append(LabeledApp(id: a.id, label: a.label, token: a.token)) }
            else if let a = named.first(where: { $0.id == id }) { apps.append(a) }
            else { missing.append(id) }
        }
        guard !apps.isEmpty else { call.resolve(["shown": 0, "missing": missing]); return }
        let points = call.getInt("points") ?? 0
        let robot = Self.bundledWebImage(call.getString("robot") ?? "")
        DispatchQueue.main.async {
            guard var top = self.bridge?.viewController else { call.resolve(["shown": 0, "missing": ids]); return }
            while let p = top.presentedViewController { top = p }
            if top is UIHostingController<VaultUnlockView> { call.resolve(["shown": 0, "missing": ids]); return } // one at a time
            var host: UIHostingController<VaultUnlockView>?
            let view = VaultUnlockView(apps: apps, points: points, robot: robot) { host?.dismiss(animated: true) }
            host = UIHostingController(rootView: view)
            host!.view.backgroundColor = .clear; host!.modalPresentationStyle = .overFullScreen; host!.modalTransitionStyle = .crossDissolve
            top.present(host!, animated: true) { call.resolve(["shown": apps.count, "missing": missing]) }
        }
    }
    /// An image from the bundled web build ("/img/assistant-robot@2x.<hash>.png" -> App.app/public/img/...). nil if absent.
    static func bundledWebImage(_ path: String) -> UIImage? {
        guard path.hasPrefix("/"), !path.contains(".."), path.count < 200 else { return nil }
        return UIImage(contentsOfFile: Bundle.main.bundlePath + "/public" + path)
    }

    @objc func offerBreak(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { call.resolve(["posted": false]); return }
        let minutes = call.getInt("minutes") ?? 0; let points = call.getInt("points") ?? 0
        guard minutes > 0 else { call.resolve(["posted": false]); return }
        LockShared.defaults?.set(["minutes": minutes, "points": points, "day": call.getString("day") ?? "", "closeMs": call.getDouble("closeMs") ?? 0, "v": call.getInt("v") ?? 0, "n": call.getInt("n") ?? 0], forKey: BreakState.offerKey)
        ClingBreakNotify.registerCategory()
        let c = UNMutableNotificationContent()
        c.title = call.getString("title") ?? "You hit \(points) points"; c.body = call.getString("body") ?? "Break time if you want it."
        c.categoryIdentifier = BreakState.category; c.sound = .default; c.userInfo = ["minutes": minutes, "points": points]
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "cn.break.offer", content: c, trigger: nil))
        call.resolve(["posted": true])
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

/// Vault unlock: the vault door spins open, then each unlocked app's real icon (Label(token), the only way to draw an opaque
/// ApplicationToken) springs out of it one by one with a haptic tick, confetti bursts, robot cheers. Same palette as the web
/// celebration (PointsCelebration.vue): dim navy backdrop, #1e3a8a -> #0f172a, yellow points, green cheer. Tap anywhere / button to close.
@available(iOS 16.0, *)
struct VaultUnlockView: View {
    let apps: [LabeledApp]
    let points: Int
    let robot: UIImage?
    let done: () -> Void
    @State private var doorOpen = false
    @State private var shown = 0
    @State private var burst = false
    @State private var ready = false
    private static let yellow = Color(red: 0.98, green: 0.80, blue: 0.08)
    private static let blue = Color(red: 0.38, green: 0.65, blue: 0.98)
    private static let green = Color(red: 0.53, green: 0.94, blue: 0.67)
    private static let confetti: [Color] = [yellow, blue, Color(red: 0.20, green: 0.83, blue: 0.60), Color(red: 0.96, green: 0.45, blue: 0.71)]

    /// Where icon i lands: a fan above the door (up to 5 per arc, extra arcs further out).
    static func spot(_ i: Int, of n: Int) -> CGSize {
        let row = i / 5; let inRow = min(5, n - row * 5); let k = i % 5
        let spread = Double(min(inRow - 1, 4)) * 0.36
        let a = -Double.pi / 2 + (inRow > 1 ? -spread / 2 + spread * Double(k) / Double(inRow - 1) : 0)
        let r = 150.0 + Double(row) * 92
        return CGSize(width: cos(a) * r, height: sin(a) * r + 40)
    }

    var body: some View {
        ZStack {
            Color(red: 5 / 255, green: 10 / 255, blue: 25 / 255).opacity(0.78).ignoresSafeArea().onTapGesture { done() }
            VStack(spacing: 10) {
                Spacer()
                ZStack {
                    ForEach(0..<24, id: \.self) { i in // confetti
                        Circle().fill(Self.confetti[i % 4]).frame(width: 9, height: 9)
                            .offset(y: burst ? -CGFloat(120 + (i % 3) * 45) : 0).rotationEffect(.degrees(Double(i) * 15))
                            .opacity(burst ? 0 : 1).animation(.easeOut(duration: 1.1).delay(0.35), value: burst)
                    }
                    door
                    ForEach(Array(apps.enumerated()), id: \.element.id) { i, a in
                        let out = i < shown
                        VStack(spacing: 4) {
                            Label(a.token).labelStyle(.iconOnly).scaleEffect(2.1).frame(width: 64, height: 64)
                                .background(Circle().fill(Self.blue.opacity(0.25)).blur(radius: 10))
                            Label(a.token).labelStyle(.titleOnly).font(.caption.weight(.semibold)).foregroundColor(.white).lineLimit(1).frame(maxWidth: 84)
                        }
                        .scaleEffect(out ? 1 : 0.2).opacity(out ? 1 : 0)
                        .offset(out ? Self.spot(i, of: apps.count) : CGSize(width: 0, height: 40))
                        .rotationEffect(.degrees(out ? 0 : -30))
                        .animation(.spring(response: 0.5, dampingFraction: 0.55), value: shown)
                    }
                }
                .frame(height: 360)
                Text(apps.count == 1 ? "Vault unlocked!" : "Vault unlocked \(apps.count) apps!")
                    .font(.system(size: 26, weight: .heavy)).foregroundColor(.white).multilineTextAlignment(.center)
                if points > 0 { Text("\(points) pts").font(.system(size: 40, weight: .black)).foregroundColor(Self.yellow) }
                Text("Earned it. 10 pts = 5 min of app time.").font(.subheadline.weight(.bold)).foregroundColor(Self.green)
                Spacer()
                Button(action: done) {
                    Text("Nice!").font(.headline.weight(.heavy)).foregroundColor(.white).padding(.horizontal, 44).padding(.vertical, 14)
                        .background(Capsule().fill(LinearGradient(colors: [Color(red: 0.12, green: 0.23, blue: 0.54), Color(red: 0.06, green: 0.09, blue: 0.16)], startPoint: .top, endPoint: .bottom)))
                        .overlay(Capsule().stroke(Self.blue.opacity(0.7), lineWidth: 1.5)).shadow(color: Self.blue.opacity(0.5), radius: 14)
                }
                .opacity(ready ? 1 : 0).padding(.bottom, 30).accessibilityLabel("Close")
            }
        }
        .accessibilityElement(children: .contain)
        .onAppear(perform: play)
    }

    private var door: some View {
        ZStack {
            Circle().fill(LinearGradient(colors: [Color(red: 0.12, green: 0.23, blue: 0.54), Color(red: 0.06, green: 0.09, blue: 0.16)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(Circle().stroke(Self.blue.opacity(0.8), lineWidth: 4)).shadow(color: Self.blue.opacity(0.55), radius: 30)
            ForEach(0..<3, id: \.self) { k in Capsule().fill(Self.blue.opacity(0.9)).frame(width: 6, height: 70).rotationEffect(.degrees(Double(k) * 60)) }
            if let r = robot { Image(uiImage: r).resizable().scaledToFit().frame(width: 58, height: 58) }
            else { Circle().fill(Self.yellow).frame(width: 18, height: 18) }
        }
        .frame(width: 130, height: 130)
        .rotationEffect(.degrees(doorOpen ? 200 : 0))
        .scaleEffect(doorOpen ? 0.82 : 1)
        .rotation3DEffect(.degrees(doorOpen ? 58 : 0), axis: (x: 0, y: 1, z: 0), anchor: .leading, perspective: 0.6)
        .offset(y: 40)
    }

    private func play() {
        let ok = UINotificationFeedbackGenerator(); let tick = UIImpactFeedbackGenerator(style: .medium); ok.prepare(); tick.prepare()
        withAnimation(.spring(response: 0.6, dampingFraction: 0.65).delay(0.25)) { doorOpen = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { ok.notificationOccurred(.success); burst = true }
        for i in 0..<apps.count { // staggered pop-outs
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7 + 0.22 * Double(i)) { shown = i + 1; tick.impactOccurred(intensity: 0.8) }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9 + 0.22 * Double(apps.count)) { withAnimation(.easeIn(duration: 0.25)) { ready = true } }
    }
}

/// Notification action "Take break" (background, no app UI): starts the offered break natively (shields off + monitor re-lock +
/// "Break's over"), so it works from the lock screen with the app closed. Every other notification is forwarded to the delegate
/// that was installed before (Capacitor's router), so local-notification taps keep working.
@available(iOS 16.0, *)
final class ClingBreakNotify: NSObject, UNUserNotificationCenterDelegate {
    static let shared = ClingBreakNotify()
    weak var forward: UNUserNotificationCenterDelegate?
    static func registerCategory() {
        let take = UNNotificationAction(identifier: BreakState.takeAction, title: "Take break", options: []) // [] = background action
        let cat = UNNotificationCategory(identifier: BreakState.category, actions: [take], intentIdentifiers: [], options: [])
        let c = UNUserNotificationCenter.current()
        c.getNotificationCategories { cur in c.setNotificationCategories(cur.filter { $0.identifier != BreakState.category }.union([cat])) }
    }
    static func install() {
        let c = UNUserNotificationCenter.current()
        if let d = c.delegate, !(d === shared) { shared.forward = d }
        c.delegate = shared; registerCategory()
    }
    /// Pure rule: the action starts min(offered, 30, minutes to the close); nothing without an offer or while a break is live.
    static func actionMinutes(offer: [String: Any]?, nowMs: Double, live: Bool) -> Int {
        // Only offers made under the tasks + points rules (v 2), for today, before the close.
        guard !live, let o = offer, let m = o["minutes"] as? Int, m > 0, (o["v"] as? Int) == 2 else { return 0 }
        let close = (o["closeMs"] as? Double) ?? 0
        guard close > nowMs else { return 0 }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        guard (o["day"] as? String) == f.string(from: Date(timeIntervalSince1970: nowMs / 1000)) else { return 0 }
        let left = Int((close - nowMs) / 60000)
        return max(0, min(m, 30, left))
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler done: @escaping () -> Void) {
        guard response.actionIdentifier == BreakState.takeAction else {
            if let f = forward, f.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))) { f.userNotificationCenter?(center, didReceive: response, withCompletionHandler: done) } else { done() }
            return
        }
        let now = Date().timeIntervalSince1970 * 1000
        let offer = LockShared.defaults?.dictionary(forKey: BreakState.offerKey)
        let m = Self.actionMinutes(offer: offer, nowMs: now, live: BreakState.isLive(now: now))
        if m > 0, BreakState.begin(untilMs: now + Double(m) * 60000, minutes: m) == nil {
            LockShared.defaults?.removeObject(forKey: BreakState.offerKey) // one offer = one break
            BreakState.recordTaken(at: now, minutes: m, until: now + Double(m) * 60000, points: (offer?["points"] as? Int) ?? 0)
        }
        done()
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) {
        if let f = forward, f.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:))) { f.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: done) }
        else { done([.banner, .sound, .list]) }
    }
}

#endif
