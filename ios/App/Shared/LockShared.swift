// App lock is off for this build: compiled only when CLING_APP_LOCK is defined (needs the Family Controls entitlement). See docs/APP_LOCKING_SETUP.md.
#if CLING_APP_LOCK
// Shared by the app and the Screen Time extensions (ClingLockMonitor, ClingShieldConfig).
import Foundation
import UserNotifications
#if canImport(ManagedSettings)
import ManagedSettings
import DeviceActivity

@available(iOS 16.0, *)
enum LockShared {
    static let group = "group.app.clingnote.ios"
    static let selectionKey = "lock.selection"
    /// The apps locked by the previous session (FamilyActivitySelection, plist): seeds the next session's picker; replaced at each Begin.
    static let lastUsedSelectionKey = "lock.selection.lastUsed"
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

/// Missed-goal app lock (appLockDebt), native half. One hold at a time: App Group entry { key, startMs, untilMs } + its own
/// DeviceActivity ("clingDebt", startMs -> untilMs = the 14-day safety cap). The app arms it while a session runs short of its goal
/// (startMs = that session's end) or once a miss is known (startMs in the past), for every user, so the shield goes up / stays up at
/// the session end even when ClingNote is closed or force-quit. Only the app clears it (clearDebtHold), when a later session reaches
/// its goal; every other lock end in the extension leaves the shield up while a hold is active.
@available(iOS 16.0, *)
enum DebtHold {
    static let storeKey = "clingnote.debtHold.v1"
    static let activity = DeviceActivityName("clingDebt")
    static func entry() -> (key: String, startMs: Double, untilMs: Double)? {
        guard let d = LockShared.defaults?.dictionary(forKey: storeKey), let k = d["key"] as? String, !k.isEmpty else { return nil }
        let num = { (x: Any?) -> Double in (x as? Double) ?? Double((x as? Int) ?? 0) }
        return (k, num(d["startMs"]), num(d["untilMs"]))
    }
    static func save(key: String, startMs: Double, untilMs: Double, segEndMs: Double = 0) { LockShared.defaults?.set(["key": key, "startMs": startMs, "untilMs": untilMs, "segEndMs": segEndMs], forKey: storeKey) }
    static func segEnd() -> Double { let d = LockShared.defaults?.dictionary(forKey: storeKey) ?? [:]; return (d["segEndMs"] as? Double) ?? Double((d["segEndMs"] as? Int) ?? 0) }
    /// Arms the next segment of the chain (<= 6.5 days, ScheduleChain). Returns nil on success, else the error text. Never clears the entry:
    /// a failed arm keeps the hold (and the shield, when it already holds) so a missed goal is never escaped by an iOS schedule error.
    @discardableResult
    static func armSegment(nowMs: Double = Date().timeIntervalSince1970 * 1000) -> String? {
        guard let e = entry(), let seg = ScheduleChain.segment(startMs: e.startMs, untilMs: e.untilMs, nowMs: nowMs) else { return "no segment" }
        save(key: e.key, startMs: e.startMs, untilMs: e.untilMs, segEndMs: seg.endMs) // before stop/start: the restart's intervalDidEnd sees a future segment end
        do {
            DeviceActivityCenter().stopMonitoring([activity])
            try DeviceActivityCenter().startMonitoring(activity, during: ScheduleChain.schedule(seg))
            return nil
        } catch { return "\(error)" }
    }
    static func clear() { LockShared.defaults?.removeObject(forKey: storeKey) }
    /// Active = started (minute slack, iOS fires interval starts up to a minute early/late) and before the safety cap.
    static func isActive(nowMs: Double = Date().timeIntervalSince1970 * 1000) -> Bool {
        guard let e = entry() else { return false }
        return holds(startMs: e.startMs, untilMs: e.untilMs, nowMs: nowMs)
    }
    static func holds(startMs: Double, untilMs: Double, nowMs: Double) -> Bool { startMs > 0 && startMs <= nowMs + 90_000 && nowMs < untilMs }
    /// A lock ending now: keep the shield and point the lock state at the hold's end instead of lifting it.
    static func keepShieldIfHeld(nowMs: Double = Date().timeIntervalSince1970 * 1000) -> Bool {
        guard let e = entry(), holds(startMs: e.startMs, untilMs: e.untilMs, nowMs: nowMs) else { return false }
        LockShared.defaults?.set(["locked": true, "until": e.untilMs, "label": "ClingNote lock-in"], forKey: LockShared.stateKey)
        return true
    }
}

/// iOS rejects a DeviceActivity interval longer than one week (DeviceActivityCenter.MonitoringError.intervalTooLong). Long holds
/// (DebtHold, the 8-hour lock-in, both up to the 14-day safety cap) are armed in segments of at most 6.5 days and re-armed in a chain
/// until the real end: by ClingLockMonitor at each segment's intervalDidEnd and by the app on every sync. Pure math mirrored in
/// eightHourCore.nativeSegment (scripts/test-points-vault.mjs checks the constants match).
@available(iOS 16.0, *)
enum ScheduleChain {
    static let maxSpanMs: Double = 6.5 * 24 * 3600 * 1000
    static let minSpanMs: Double = 15 * 60 * 1000
    /// Segment to arm now for a hold from startMs to untilMs, or nil when the real end is under a minute away.
    static func segment(startMs: Double, untilMs: Double, nowMs: Double) -> (startMs: Double, endMs: Double)? {
        guard untilMs > nowMs + 60_000 else { return nil }
        let s = min(max(startMs, nowMs - 60_000), untilMs - minSpanMs)
        return (s, min(untilMs, s + maxSpanMs))
    }
    static func schedule(_ seg: (startMs: Double, endMs: Double)) -> DeviceActivitySchedule {
        DeviceActivitySchedule(intervalStart: AppLocks.comps(Date(timeIntervalSince1970: seg.startMs / 1000)),
                               intervalEnd: AppLocks.comps(Date(timeIntervalSince1970: seg.endMs / 1000)), repeats: false)
    }
    /// Segment end of the 8-hour lock-in's current .clingLock schedule (App Group), so the monitor can tell a segment end from a restart.
    static let lockSegKey = "lock.segEndMs"
}

/// Evening mode: later lock-in blocks scheduled ahead of time, one DeviceActivity each ("clingLockAt.<key>"), so the shield goes up at
/// the block start even when ClingNote is closed. App Group map key -> [startMs, untilMs]. A block shorter than 15 min is never scheduled
/// (DeviceActivity minimum interval); iOS starts/ends intervals at minute granularity and may deliver them late.
@available(iOS 16.0, *)
enum ScheduledLocks {
    static let prefix = "clingLockAt."
    static let storeKey = "clingnote.scheduledLocks.v1"
    static func all() -> [String: [Double]] { (LockShared.defaults?.dictionary(forKey: storeKey) as? [String: [Double]]) ?? [:] }
    static func save(_ m: [String: [Double]]) { LockShared.defaults?.set(m, forKey: storeKey) }
    static func name(_ key: String) -> DeviceActivityName { DeviceActivityName(prefix + key) }
    static func key(of activity: DeviceActivityName) -> String? { activity.rawValue.hasPrefix(prefix) ? String(activity.rawValue.dropFirst(prefix.count)) : nil }
    /// Drop entries that already ended (and their schedules): they still count toward the system's activity limit.
    static func cleanupExpired(nowMs: Double = Date().timeIntervalSince1970 * 1000) {
        var m = all(); let done = m.filter { $0.value.count == 2 && $0.value[1] <= nowMs }.map { $0.key }
        if done.isEmpty { return }
        done.forEach { m[$0] = nil }; save(m); DeviceActivityCenter().stopMonitoring(done.map { name($0) })
    }
}

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
        if BreakState.isLive(now: now) { store.shield.applications = nil; return } // earned break: every app open until it ends
        if GoalRelease.isLive(nowMs: now) { store.shield.applications = nil; return } // session goal met: stay open until the day rolls or a new session clears it
        var l = locked(); l = l.filter { $0.value == 0 || $0.value > now }; saveLocked(l)
        let tokens = Set(apps().filter { l[$0.id] != nil }.map { $0.token }).subtracting(TaskAllow.allowed(now: now)).subtracting(VaultAllow.allowed(now: now))
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
        if let a = TaskAllow.active(), !TaskAllow.isLive(until: a.until, nowMs: now) { TaskAllow.clearActive(); DeviceActivityCenter().stopMonitoring([.clingTask]); TaskAllow.reapply(); return }
        apply(now: now)
    }
}

/// Apps the user chose for the vault. The lock-in selection and the named-app list are unioned, and each token keeps a
/// stable id so today's prices don't jump when the picker is reopened. UsageLog and VaultAllow both read this list, so
/// the priced apps and the shielded apps are the same tokens (a name-only list used to disagree with the lock-in shield).
@available(iOS 16.0, *)
enum VaultCatalog {
    static let key = "lock.vaultCatalog"
    static let namesKey = "lock.vaultNames" // encoded-token -> confirmed name. Never a report guess.
    struct Item: Codable { var id: String; var label: String; var token: ApplicationToken }
    static func apps() -> [Item] {
        guard let d = LockShared.defaults?.data(forKey: key), let a = try? JSONDecoder().decode([Item].self, from: d) else { return [] }
        return a
    }
    static func save(_ a: [Item]) { if let d = try? JSONEncoder().encode(a) { LockShared.defaults?.set(d, forKey: key) } }
    static func realName(_ s: String) -> String { let t = s.trimmingCharacters(in: .whitespacesAndNewlines); return (t.isEmpty || t.lowercased() == "app") ? "" : t }
    static func tokenKey(_ token: ApplicationToken) -> String { ((try? JSONEncoder().encode(token)) ?? Data()).base64EncodedString() }
    static func names() -> [String: String] { (LockShared.defaults?.dictionary(forKey: namesKey) as? [String: String]) ?? [:] }
    static func remember(_ token: ApplicationToken, _ label: String) {
        let n = realName(label); if n.isEmpty { return }
        var m = names(); m[tokenKey(token)] = n; LockShared.defaults?.set(m, forKey: namesKey)
    }
    /// Rebuild from the current selection and named apps. A token already in the catalog keeps its id and any real name.
    static func sync(selectionTokens: Set<ApplicationToken>, labeled: [LabeledApp]) -> [Item] {
        let prev = apps(); let known = names()
        var next: [Item] = []
        var seen = Set<ApplicationToken>()
        func add(_ token: ApplicationToken, preferLabel: String, preferId: String?) {
            if seen.contains(token) { return }
            seen.insert(token)
            let named = realName(preferLabel)
            let remembered = realName(known[tokenKey(token)] ?? "")
            if let e = prev.first(where: { $0.token == token || (preferId?.isEmpty == false && $0.id == preferId) }) {
                var c = e
                let keep = named.isEmpty ? (realName(c.label).isEmpty ? remembered : realName(c.label)) : named
                if !keep.isEmpty { c.label = keep; remember(token, keep) }
                next.append(c)
                return
            }
            let id = (preferId?.isEmpty == false) ? preferId! : UUID().uuidString
            let label = named.isEmpty ? (remembered.isEmpty ? "App" : remembered) : named
            if realName(label).isEmpty == false { remember(token, label) }
            next.append(Item(id: id, label: label, token: token))
        }
        for t in selectionTokens {
            let lab = labeled.first(where: { $0.token == t })
            add(t, preferLabel: lab?.label ?? "", preferId: lab?.id)
        }
        for l in labeled { add(l.token, preferLabel: l.label, preferId: l.id) }
        next.sort { $0.id < $1.id }
        save(next)
        return next
    }
}
@available(iOS 16.0, *)
extension ManagedSettingsStore.Name { static let clingApps = Self("clingApps") }

/// Per-task app unlock: apps a task needs (picked once per task with FamilyActivityPicker, stored as opaque tokens) are
/// taken out of every ClingNote shield while that task runs, then re-locked when it is completed, ended early or its
/// window ends. The window end is a DeviceActivity schedule ("clingTask"), so ClingLockMonitor re-locks even when the app
/// was killed; the app also re-checks on launch (cleanupExpired). Pure rule mirrored in src/utils/taskAppUnlock.js.
@available(iOS 16.0, *)
extension DeviceActivityName { static let clingTask = Self("clingTask") }
@available(iOS 16.0, *)
enum TaskAllow {
    static let appsKey = "lock.taskApps"     // [taskId: [ApplicationToken]] (JSON)
    static let activeKey = "lock.taskAllow"  // ["taskId": String, "until": Double ms]
    static func all() -> [String: [ApplicationToken]] {
        guard let d = LockShared.defaults?.data(forKey: appsKey), let m = try? JSONDecoder().decode([String: [ApplicationToken]].self, from: d) else { return [:] }
        return m
    }
    static func apps(_ taskId: String) -> [ApplicationToken] { all()[taskId] ?? [] }
    static func setApps(_ taskId: String, _ t: [ApplicationToken]) {
        var m = all(); m[taskId] = t.isEmpty ? nil : t
        if let d = try? JSONEncoder().encode(m) { LockShared.defaults?.set(d, forKey: appsKey) }
    }
    static func active() -> (taskId: String, until: Double)? {
        guard let a = LockShared.defaults?.dictionary(forKey: activeKey), let id = a["taskId"] as? String, !id.isEmpty else { return nil }
        return (id, (a["until"] as? Double) ?? Double((a["until"] as? Int) ?? 0))
    }
    /// Pure: is the allowance still live? until 0 never counts (an allowance always has an end).
    static func isLive(until: Double, nowMs: Double) -> Bool { until > nowMs }
    /// Tokens to keep OFF the shields right now (empty when no live allowance).
    static func allowed(now: Double = Date().timeIntervalSince1970 * 1000) -> Set<ApplicationToken> {
        guard let a = active(), isLive(until: a.until, nowMs: now) else { return [] }
        return Set(apps(a.taskId))
    }
    static func setActive(_ taskId: String, until: Double) { LockShared.defaults?.set(["taskId": taskId, "until": until], forKey: activeKey) }
    static func clearActive() { LockShared.defaults?.removeObject(forKey: activeKey) }
    /// Re-applies both shields with the current allowance (lock-in store only while the lock-in is on).
    static func reapply() {
        let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
        if (st["locked"] as? Bool) == true { LockIn.shield() }
        AppLocks.apply()
    }
    /// Drops an expired allowance (relaunch after the app was killed / monitor missed) and re-locks.
    static func expireIfNeeded(now: Double = Date().timeIntervalSince1970 * 1000) {
        guard let a = active(), !isLive(until: a.until, nowMs: now) else { return }
        clearActive(); DeviceActivityCenter().stopMonitoring([.clingTask]); reapply()
    }
}


/// Points vault (src/utils/pointsVault.js): apps the user opened with the day's points, for the shared app time bought with them
/// (every 10 points = 5 min). Same shape as TaskAllow: App Group ["ids": [LabeledApp.id], "until": ms] + one DeviceActivity
/// ("clingVault", >= 15 min window, start backdated) whose intervalDidEnd re-shields with the app closed. A priced
/// release stays open through a missed-goal hold; the next session's Begin clears it. A live break already opens everything.
@available(iOS 16.0, *)
extension DeviceActivityName { static let clingVault = Self("clingVault") }
@available(iOS 16.0, *)
enum VaultAllow {
    static let activeKey = "lock.vaultAllow"
    static func active() -> (ids: [String], until: Double)? {
        guard let a = LockShared.defaults?.dictionary(forKey: activeKey), let ids = a["ids"] as? [String], !ids.isEmpty else { return nil }
        return (ids, (a["until"] as? Double) ?? Double((a["until"] as? Int) ?? 0))
    }
    static func isLive(until: Double, nowMs: Double) -> Bool { until > nowMs }
    static func allowed(now: Double = Date().timeIntervalSince1970 * 1000) -> Set<ApplicationToken> {
        guard let a = active(), isLive(until: a.until, nowMs: now) else { return [] }
        let ids = Set(a.ids)
        let tokens = AppLocks.apps().filter { ids.contains($0.id) }.map { $0.token } + VaultCatalog.apps().filter { ids.contains($0.id) }.map { $0.token }
        return Set(tokens)
    }
    static func setActive(_ ids: [String], until: Double) { LockShared.defaults?.set(["ids": ids, "until": until], forKey: activeKey) }
    static func clearActive() { LockShared.defaults?.removeObject(forKey: activeKey) }
    static func expireIfNeeded(now: Double = Date().timeIntervalSince1970 * 1000) {
        guard let a = active(), !isLive(until: a.until, nowMs: now) else { return }
        clearActive(); DeviceActivityCenter().stopMonitoring([.clingVault]); TaskAllow.reapply()
    }
}

/// Usage estimate for vault prices: ONE shared repeating DeviceActivity ("clingUsage", all day) with threshold events per labeled app at
/// 15/30/60/120/240 min (event "u|<appId>|<min>"). ClingLockMonitor.eventDidReachThreshold records the largest threshold reached per
/// app per local day in the App Group (idempotent: max). Data stays on the device; the app averages the last 7 days (pointsVault.js).
@available(iOS 16.0, *)
enum UsageLog {
    static let activity = DeviceActivityName("clingUsage")
    static let key = "usage.daily.v1"          // ["yyyy-MM-dd": [appId: minutes]]
    static let reportKey = "vault.report.v1"   // owner-supplied report rows. Never written by threshold events.
    static let sigKey = "usage.sig.v1"
    static let thresholds = [15, 30, 60, 120, 240]
    static let keepDays = 14
    static func all() -> [String: [String: Int]] { (LockShared.defaults?.dictionary(forKey: key) as? [String: [String: Int]]) ?? [:] }
    static func eventName(_ id: String, _ m: Int) -> DeviceActivityEvent.Name { DeviceActivityEvent.Name("u|\(id)|\(m)") }
    static func parse(_ e: DeviceActivityEvent.Name) -> (id: String, min: Int)? {
        let p = e.rawValue.split(separator: "|").map(String.init)
        guard p.count == 3, p[0] == "u", let m = Int(p[2]) else { return nil }
        return (p[1], m)
    }
    /// Pure fold (idempotent): keep the larger value, drop days older than keepDays.
    static func fold(_ m0: [String: [String: Int]], ymd: String, id: String, min: Int) -> [String: [String: Int]] {
        var m = m0; var day = m[ymd] ?? [:]; day[id] = max(day[id] ?? 0, min); m[ymd] = day
        let keep = Set(m.keys.sorted().suffix(keepDays)); return m.filter { keep.contains($0.key) }
    }
    static func record(id: String, min: Int, now: Date = Date()) { LockShared.defaults?.set(fold(all(), ymd: WakeLock.ymd(now), id: id, min: min), forKey: key) }
    /// Marks today as observed (an app absent from an observed day used < 15 min). Called at intervalDidStart and on app sync.
    static func markDay(now: Date = Date()) { var m = all(); let d = WakeLock.ymd(now); if m[d] == nil { m[d] = [:]; LockShared.defaults?.set(m, forKey: key) } }
    /// (Re)starts the schedule when the labeled app set changed. One activity, apps x 5 events.
    static func ensure() -> String {
        // Chosen apps (selection + named). Fall back to named apps if the catalog has not been synced yet.
        let catalog = VaultCatalog.apps()
        let apps: [(id: String, token: ApplicationToken)] = catalog.isEmpty ? AppLocks.apps().map { ($0.id, $0.token) } : catalog.map { ($0.id, $0.token) }
        let sig = apps.map { $0.id }.sorted().joined(separator: ",")
        if apps.isEmpty { DeviceActivityCenter().stopMonitoring([activity]); LockShared.defaults?.removeObject(forKey: sigKey); return "no-apps" }
        if LockShared.defaults?.string(forKey: sigKey) == sig, DeviceActivityCenter().activities.contains(activity) { markDay(); return "ok" }
        var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
        for a in apps { for m in thresholds { events[eventName(a.id, m)] = DeviceActivityEvent(applications: [a.token], threshold: DateComponents(minute: m)) } }
        do {
            DeviceActivityCenter().stopMonitoring([activity])
            try DeviceActivityCenter().startMonitoring(activity, during: DeviceActivitySchedule(intervalStart: DateComponents(hour: 0, minute: 0), intervalEnd: DateComponents(hour: 23, minute: 59), repeats: true), events: events)
            LockShared.defaults?.set(sig, forKey: sigKey); markDay(); return "ok"
        } catch { return "failed: \(error)" }
    }
}

/// Session goal met: every ClingNote shield stays down until local midnight or the next session Begin.
/// App Group lock.goalRelease = { day, until, session }. The monitor honors it with the app killed.
@available(iOS 16.0, *)
enum GoalRelease {
    static let key = "lock.goalRelease"
    static func entry() -> (day: String, until: Double, session: String)? {
        guard let d = LockShared.defaults?.dictionary(forKey: key) else { return nil }
        let day = d["day"] as? String ?? ""
        let until = (d["until"] as? Double) ?? Double((d["until"] as? Int) ?? 0)
        let session = d["session"] as? String ?? ""
        guard !day.isEmpty, until > 0 else { return nil }
        return (day, until, session)
    }
    static func isLive(nowMs: Double = Date().timeIntervalSince1970 * 1000, today: String = WakeLock.ymd(Date())) -> Bool {
        guard let e = entry() else { return false }
        return e.day == today && e.until > nowMs
    }
    static func mark(day: String, untilMs: Double, session: String) {
        LockShared.defaults?.set(["day": day, "until": untilMs, "session": session], forKey: key)
    }
    static func clear() { LockShared.defaults?.removeObject(forKey: key) }
    /// True when the goal release is live: both shields are cleared and the caller must not put them back.
    static func liftIfLive(nowMs: Double = Date().timeIntervalSince1970 * 1000) -> Bool {
        guard isLive(nowMs: nowMs) else { return false }
        let store = ManagedSettingsStore(named: .clingLock)
        store.shield.applications = nil
        store.shield.applicationCategories = nil
        store.shield.webDomains = nil
        AppLocks.store.shield.applications = nil
        return true
    }
}

/// Lock-in shield (store .clingLock) from the saved selection, minus the running task's allowed apps.
@available(iOS 16.0, *)
enum LockIn {
    static func shield() {
        let store = ManagedSettingsStore(named: .clingLock)
        if GoalRelease.liftIfLive() { return }
        if BreakState.isLive() { store.shield.applications = nil; store.shield.applicationCategories = nil; store.shield.webDomains = nil; return }
        guard let d = LockShared.defaults?.data(forKey: LockShared.selectionTokensKey),
              let sel = try? JSONDecoder().decode(LockSelectionTokens.self, from: d) else { return }
        let allow = TaskAllow.allowed().union(VaultAllow.allowed()) // running task's apps + points-vault apps with app time left
        let apps = sel.apps.subtracting(allow)
        store.shield.applications = apps.isEmpty ? nil : apps
        store.shield.applicationCategories = sel.categories.isEmpty ? nil : .specific(sel.categories, except: allow)
        store.shield.webDomains = sel.domains.isEmpty ? nil : sel.domains
    }
}
/// Token copy of the lock-in FamilyActivitySelection, so extensions shield it without importing FamilyControls here.
@available(iOS 16.0, *)
struct LockSelectionTokens: Codable { var apps: Set<ApplicationToken>; var categories: Set<ActivityCategoryToken>; var domains: Set<WebDomainToken> }
@available(iOS 16.0, *)
extension LockShared { static let selectionTokensKey = "lock.selectionTokens" }
#endif

#endif

/// Wake-up auto-lock (B44): ONE daily repeating DeviceActivity ("clingWakeLock") from the wake time for the day length, so the picked
/// apps lock at wake-up even when ClingNote is closed (no Confirm tap). The monitor extension raises the shield at intervalDidStart,
/// posts "Your lock-in started" and lifts it at the end. App Group keys (mirrored in scripts/test-b44-wake-lock.mjs):
///   lock.wake = ["hour", "minute", "minutes"]  · lock.wakeSkip = "yyyy-MM-dd" (Skip lock-in today) · lock.wakeLastStart = ms
@available(iOS 16.0, *)
enum WakeLock {
    static let activity = DeviceActivityName("clingWakeLock")
    static let configKey = "lock.wake"
    static let skipKey = "lock.wakeSkip"
    static let lastStartKey = "lock.wakeLastStart"
    static let label = "ClingNote wake lock-in"
    static let startedIdentifier = "cling.lock.started"
    static func ymd(_ d: Date) -> String {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"; return f.string(from: d)
    }
    static func config() -> (hour: Int, minute: Int, minutes: Int)? {
        guard let c = LockShared.defaults?.dictionary(forKey: configKey), let h = c["hour"] as? Int, let m = c["minute"] as? Int, let n = c["minutes"] as? Int else { return nil }
        return (h, m, n)
    }
    /// 15 min .. 12 h (DeviceActivity minimum interval; day length is already clamped 3..12 h in the app).
    static func clampMinutes(_ n: Int) -> Int { min(12 * 60, max(15, n)) }
    /// Pure gate used by the monitor: skipped today, or an evening block / longer lock already running -> don't start.
    static func shouldStart(skipYmd: String?, todayYmd: String, blockRunning: Bool, curUntilMs: Double, untilMs: Double) -> Bool {
        if let s = skipYmd, s == todayYmd { return false }
        if blockRunning { return false }
        return curUntilMs < untilMs
    }
    /// Today's interval from the saved config (start = wake time today).
    static func todayWindow(now: Date = Date()) -> (startMs: Double, untilMs: Double)? {
        guard let c = config(), let s = Calendar.current.date(bySettingHour: c.hour, minute: c.minute, second: 0, of: now) else { return nil }
        let start = s.timeIntervalSince1970 * 1000
        return (start, start + Double(clampMinutes(c.minutes)) * 60_000)
    }
}

/// Earned break (game plan): lifts EVERY ClingNote shield (lock-in store .clingLock and per-app store .clingApps) for exactly the
/// break, without touching the lock state. The re-lock is a DeviceActivity schedule ("clingBreak") whose intervalDidEnd in
/// ClingLockMonitor clears the break and re-applies the same shields, so it works with the app closed or killed. Started only by
/// the user (Home "Take break" or the notification's Take break action), never automatically. Pure rule mirrored in src/utils/breakUnlock.js.
@available(iOS 16.0, *)
extension DeviceActivityName { static let clingBreak = Self("clingBreak") }
@available(iOS 16.0, *)
enum BreakState {
    static let key = "lock.break"            // ["until": ms, "startMs": ms, "minutes": Int]
    static let takenKey = "lock.breakTaken"  // [[at, min, until, points]] taken from the notification while the app was closed (JS drains)
    static let offerKey = "lock.breakOffer"  // ["minutes": Int, "points": Int, "day": "yyyy-MM-dd"] what the alert's action may start
    static let endNoteId = "cn.break.end"
    static let category = "CLING_BREAK"
    static let takeAction = "TAKE_BREAK"
    static func until() -> Double { let d = LockShared.defaults?.dictionary(forKey: key) ?? [:]; return (d["until"] as? Double) ?? Double((d["until"] as? Int) ?? 0) }
    /// Pure: a break is live while its end is in the future.
    static func isLive(until u: Double, nowMs: Double) -> Bool { u > nowMs }
    static func isLive(now: Double = Date().timeIntervalSince1970 * 1000) -> Bool { isLive(until: until(), nowMs: now) }
    /// Pure: the DeviceActivity window for a break ending at untilMs (iOS needs >= 15 min, so the start is backdated).
    static func windowStartMs(untilMs: Double, nowMs: Double) -> Double { min(nowMs - 60000, untilMs - 15 * 60000) }
    /// Starts the break: record it, schedule the re-lock, lift all shields, schedule "Break's over". Returns nil on success.
    static func begin(untilMs: Double, minutes: Int) -> String? {
        let now = Date().timeIntervalSince1970 * 1000
        guard untilMs - now > 30000 else { return "too short" }
        let until = Date(timeIntervalSince1970: untilMs / 1000)
        let start = Date(timeIntervalSince1970: windowStartMs(untilMs: untilMs, nowMs: now) / 1000)
        LockShared.defaults?.set(["until": untilMs, "startMs": now, "minutes": minutes], forKey: key)
        do {
            DeviceActivityCenter().stopMonitoring([.clingBreak])
            try DeviceActivityCenter().startMonitoring(.clingBreak, during: DeviceActivitySchedule(intervalStart: AppLocks.comps(start), intervalEnd: AppLocks.comps(until), repeats: false))
        } catch {
            clear(); return "monitor failed: \(error)" // nothing would re-lock: refuse rather than leave apps open
        }
        TaskAllow.reapply(); AppLocks.apply() // both stores see the live break -> cleared
        scheduleEndNote(untilMs: untilMs)
        return nil
    }
    /// Break ended (monitor at the end, or the user ended it early): clear, stop the schedule, cancel the note if early, re-shield.
    static func end(early: Bool) {
        clear(); DeviceActivityCenter().stopMonitoring([.clingBreak])
        if early { UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [endNoteId]) }
        TaskAllow.reapply()
    }
    static func clear() { LockShared.defaults?.removeObject(forKey: key) }
    static func scheduleEndNote(untilMs: Double) {
        let c = UNMutableNotificationContent()
        c.title = "Break's over"; c.body = "Your apps are locked again, same as before the break."; c.sound = .default
        let secs = max(1, (untilMs - Date().timeIntervalSince1970 * 1000) / 1000)
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: endNoteId, content: c, trigger: UNTimeIntervalNotificationTrigger(timeInterval: secs, repeats: false)))
    }
    static func recordTaken(at: Double, minutes: Int, until: Double, points: Int) {
        var a = (LockShared.defaults?.array(forKey: takenKey) as? [[String: Double]]) ?? []
        a.append(["at": at, "min": Double(minutes), "until": until, "points": Double(points)]); LockShared.defaults?.set(Array(a.suffix(20)), forKey: takenKey)
    }
}
