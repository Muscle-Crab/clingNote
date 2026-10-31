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
        var l = locked(); l = l.filter { $0.value == 0 || $0.value > now }; saveLocked(l)
        let tokens = Set(apps().filter { l[$0.id] != nil }.map { $0.token }).subtracting(TaskAllow.allowed(now: now))
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

/// Lock-in shield (store .clingLock) from the saved selection, minus the running task's allowed apps.
@available(iOS 16.0, *)
enum LockIn {
    static func shield() {
        let store = ManagedSettingsStore(named: .clingLock)
        guard let d = LockShared.defaults?.data(forKey: LockShared.selectionTokensKey),
              let sel = try? JSONDecoder().decode(LockSelectionTokens.self, from: d) else { return }
        let allow = TaskAllow.allowed()
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
