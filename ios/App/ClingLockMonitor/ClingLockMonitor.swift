import DeviceActivity
import ManagedSettings
import FamilyControls
import Foundation
import UserNotifications

/// DeviceActivityMonitor extension (bundle app.clingnote.ios.lockmonitor). Clears the 8-hour shield and per-app timed locks.
class ClingLockMonitor: DeviceActivityMonitor {
    let store = ManagedSettingsStore(named: .clingLock)
    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        if let key = ScheduledLocks.key(of: activity) { // evening mode: a scheduled block begins
            let now = Date().timeIntervalSince1970 * 1000
            guard let e = ScheduledLocks.all()[key], e.count == 2, now < e[1] else { return }
            let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
            let curUntil = (st["until"] as? Double) ?? Double((st["until"] as? Int) ?? 0)
            LockShared.defaults?.set(["locked": true, "until": max(e[1], curUntil), "label": "ClingNote lock-in"], forKey: LockShared.stateKey)
            applyLockShield(); return
        }
        if activity == WakeLock.activity { startWakeLock(); return }
        if activity == UsageLog.activity { UsageLog.markDay(); return } // new day observed (apps absent = < 15 min)
        if activity == DebtHold.activity { // missed-goal hold begins (the session ended short): shield up, app open or not
            let now = Date().timeIntervalSince1970 * 1000
            guard let e = DebtHold.entry(), now < e.untilMs else { return }
            let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
            let curUntil = (st["until"] as? Double) ?? Double((st["until"] as? Int) ?? 0)
            LockShared.defaults?.set(["locked": true, "until": max(e.untilMs, curUntil), "label": "ClingNote lock-in"], forKey: LockShared.stateKey)
            applyLockShield(); return
        }
        guard activity == .clingLock else { return }
        applyLockShield()
    }
    /// Wake-up auto-lock: shield the picked apps for today's window and tell the user (no Confirm tap needed). The app creates the
    /// matching server lock (start = scheduled wake time) on its next open.
    private func startWakeLock() {
        guard let w = WakeLock.todayWindow() else { return }
        let now = Date().timeIntervalSince1970 * 1000
        guard now < w.untilMs else { return }
        let blockRunning = ScheduledLocks.all().values.contains { $0.count == 2 && $0[0] <= now && now < $0[1] }
        let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
        let curUntil = (st["until"] as? Double) ?? Double((st["until"] as? Int) ?? 0)
        guard WakeLock.shouldStart(skipYmd: LockShared.defaults?.string(forKey: WakeLock.skipKey), todayYmd: WakeLock.ymd(Date()),
                                   blockRunning: blockRunning, curUntilMs: curUntil > now ? curUntil : 0, untilMs: w.untilMs) else { return }
        LockShared.defaults?.set(["locked": true, "until": w.untilMs, "label": WakeLock.label], forKey: LockShared.stateKey)
        LockShared.defaults?.set(w.startMs, forKey: WakeLock.lastStartKey)
        applyLockShield()
        let c = UNMutableNotificationContent()
        c.title = "ClingNote"; c.body = "Your lock-in started"; c.interruptionLevel = .timeSensitive; c.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: WakeLock.startedIdentifier, content: c, trigger: nil))
    }
    private func applyLockShield() {
        if BreakState.isLive() { return } // a scheduled/wake block starting during a break shields at the break end (intervalDidEnd .clingBreak)
        if LockShared.defaults?.data(forKey: LockShared.selectionTokensKey) != nil { LockIn.shield(); return } // minus task-allowed apps
        guard let data = LockShared.defaults?.data(forKey: LockShared.selectionKey),
              let s = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data) else { return }
        store.shield.applications = s.applicationTokens.isEmpty ? nil : s.applicationTokens
        store.shield.applicationCategories = s.categoryTokens.isEmpty ? nil : .specific(s.categoryTokens)
        store.shield.webDomains = s.webDomainTokens.isEmpty ? nil : s.webDomainTokens
    }
    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        if activity == .clingBreak { // earned break over: re-lock every shield (app may be closed). "Break's over" was scheduled at start.
            if !LockEndAlertGate.isRealEnd(untilMs: BreakState.until(), nowMs: Date().timeIntervalSince1970 * 1000) { return } // restart artifact / ended early
            BreakState.end(early: false); return
        }
        if activity == .clingTask { // per-task app unlock window ended (works when the app was killed)
            let until = TaskAllow.active()?.until ?? 0
            if !LockEndAlertGate.isRealEnd(untilMs: until, nowMs: Date().timeIntervalSince1970 * 1000) { return } // restart / already ended by the app
            TaskAllow.clearActive(); TaskAllow.reapply(); DeviceActivityCenter().stopMonitoring([activity]); return
        }
        if activity == .clingVault { // points-vault app time used up: re-shield those apps (app open or closed)
            let until = VaultAllow.active()?.until ?? 0
            if !LockEndAlertGate.isRealEnd(untilMs: until, nowMs: Date().timeIntervalSince1970 * 1000) { return } // restart / ended by the app
            VaultAllow.clearActive(); TaskAllow.reapply(); DeviceActivityCenter().stopMonitoring([activity]); return
        }
        if activity == UsageLog.activity { return } // daily usage window: repeats on its own
        if activity.rawValue.hasPrefix(AppLocks.activityPrefix) {  // per-app timed lock ended
            let id = String(activity.rawValue.dropFirst(AppLocks.activityPrefix.count))
            // Restart artifact (app re-scheduled/unlocked this activity): leave the saved lock and the new schedule alone.
            let untilMs = AppLocks.locked()[id] ?? 0
            if !LockEndAlertGate.isRealEnd(untilMs: untilMs, nowMs: Date().timeIntervalSince1970 * 1000) { return }
            var l = AppLocks.locked(); l[id] = nil; AppLocks.saveLocked(l); AppLocks.apply()
            DeviceActivityCenter().stopMonitoring([activity]) // free the slot (schedules count toward the system limit)
            notifyLockEnded(); return
        }
        if activity == DebtHold.activity { // only the 14-day safety cap ends a hold here; a met goal clears it from the app
            guard let e = DebtHold.entry() else { return } // cleared by the app (clearDebtHold): it already lifted the shield
            let now = Date().timeIntervalSince1970 * 1000
            // Chain (iOS caps a schedule at 1 week): a segment ended before the real end -> keep the shield, arm the next segment.
            if e.untilMs > now + LockEndAlertGate.endSlackMs && LockEndAlertGate.isRealEnd(untilMs: DebtHold.segEnd(), nowMs: now) {
                if DebtHold.holds(startMs: e.startMs, untilMs: e.untilMs, nowMs: now) { applyLockShield() }
                DebtHold.armSegment(nowMs: now); return // a failure keeps the entry + shield; the app re-arms on its next sync
            }
            if !LockEndAlertGate.isRealEnd(untilMs: e.untilMs, nowMs: Date().timeIntervalSince1970 * 1000) { return } // restart / re-arm artifact
            DebtHold.clear(); DeviceActivityCenter().stopMonitoring([activity])
            let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
            let curUntil = (st["until"] as? Double) ?? Double((st["until"] as? Int) ?? 0)
            if curUntil > e.untilMs + 60_000 { return }
            store.shield.applications = nil; store.shield.applicationCategories = nil; store.shield.webDomains = nil
            LockShared.defaults?.set(["locked": false, "until": 0], forKey: LockShared.stateKey)
            notifyLockEnded(); return
        }
        if activity == WakeLock.activity { // wake-up lock window ended (the daily schedule stays for tomorrow)
            let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
            guard (st["label"] as? String) == WakeLock.label else { return } // not ours (skipped, or another lock took over)
            let untilMs = (st["until"] as? Double) ?? Double((st["until"] as? Int) ?? 0)
            if !LockEndAlertGate.isRealEnd(untilMs: untilMs, nowMs: Date().timeIntervalSince1970 * 1000) { return } // re-schedule artifact
            if DebtHold.keepShieldIfHeld() { return } // missed goal: apps stay locked
            store.shield.applications = nil; store.shield.applicationCategories = nil; store.shield.webDomains = nil
            LockShared.defaults?.set(["locked": false, "until": 0], forKey: LockShared.stateKey)
            notifyLockEnded(); return
        }
        if let key = ScheduledLocks.key(of: activity) { // evening mode: a scheduled block ended
            let untilMs = ScheduledLocks.all()[key]?.last ?? 0
            if !LockEndAlertGate.isRealEnd(untilMs: untilMs, nowMs: Date().timeIntervalSince1970 * 1000) { return } // restart artifact
            var m = ScheduledLocks.all(); m[key] = nil; ScheduledLocks.save(m)
            DeviceActivityCenter().stopMonitoring([activity])
            let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
            let curUntil = (st["until"] as? Double) ?? Double((st["until"] as? Int) ?? 0)
            if curUntil > untilMs + 60_000 { return } // a longer lock (app's own .clingLock) is still running: keep the shield
            if DebtHold.keepShieldIfHeld() { return } // missed goal: apps stay locked
            store.shield.applications = nil; store.shield.applicationCategories = nil; store.shield.webDomains = nil
            LockShared.defaults?.set(["locked": false, "until": 0], forKey: LockShared.stateKey)
            notifyLockEnded(); return
        }
        guard activity == .clingLock else { return }
        // iOS also calls intervalDidEnd when the app stops/restarts monitoring (startLock does stop+start on every open and
        // minute tick). Build 36 treated that as the lock ending: cleared the shield, stopped the NEW schedule and alerted,
        // so the app restarted it a minute later -> "Your lock time is up." over and over. Only a real end counts.
        let st = LockShared.defaults?.dictionary(forKey: LockShared.stateKey) ?? [:]
        let untilMs = (st["until"] as? Double) ?? Double((st["until"] as? Int) ?? 0)
        if !LockEndAlertGate.isRealEnd(untilMs: untilMs, nowMs: Date().timeIntervalSince1970 * 1000) {
            if untilMs > 0 { // lock still running: a restart, or the end of a <= 6.5-day segment of a longer lock (ScheduleChain)
                let now = Date().timeIntervalSince1970 * 1000, seg = LockShared.defaults?.double(forKey: ScheduleChain.lockSegKey) ?? 0
                if LockEndAlertGate.isRealEnd(untilMs: seg, nowMs: now), let next = ScheduleChain.segment(startMs: now, untilMs: untilMs, nowMs: now) {
                    LockShared.defaults?.set(next.endMs, forKey: ScheduleChain.lockSegKey) // before stop/start: the restart's end is not "real"
                    DeviceActivityCenter().stopMonitoring([.clingLock])
                    try? DeviceActivityCenter().startMonitoring(.clingLock, during: ScheduleChain.schedule(next))
                    applyLockShield() // stays up either way; the app re-arms on its next sync if this failed
                }
                return
            }
            store.shield.applications = nil; store.shield.applicationCategories = nil; store.shield.webDomains = nil
            return // stopped by the app (stopLock): no alert
        }
        // Session over short of its goal (hold armed for this end, or an older miss still unpaid): keep the shield, even with the
        // app force-quit. The hold's own interval (clingDebt) may start a moment after this end fires; holds() has minute slack.
        if DebtHold.keepShieldIfHeld() { DeviceActivityCenter().stopMonitoring([.clingLock]); return }
        store.shield.applications = nil; store.shield.applicationCategories = nil; store.shield.webDomains = nil
        AppLocks.cleanupExpired() // clingApps store: drop expired per-app locks and their schedules, keep still-active ones
        DeviceActivityCenter().stopMonitoring([.clingLock])
        LockShared.defaults?.set(["locked": false, "until": 0], forKey: LockShared.stateKey)
        notifyLockEnded()
    }
    /// Usage thresholds for vault prices ("u|<appId>|<min>"): idempotent max per app per local day, kept on the device.
    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        super.eventDidReachThreshold(event, activity: activity)
        guard activity == UsageLog.activity, let u = UsageLog.parse(event) else { return }
        UsageLog.record(id: u.id, min: u.min)
    }
    /// Lock time is up. Aggressiveness is user-selectable (Settings > Lock-in > "Lock-end alert", App Group key
    /// LockShared.lockEndAlertKey): off | subtle (passive, silent) | standard (active, default sound) |
    /// loud (timeSensitive, default sound; default) | maximum (timeSensitive + .defaultCritical, which plays at full
    /// volume on silent only once Apple grants the Critical Alerts entitlement, else falls back to the standard sound).
    private func notifyLockEnded() {
        // One alert per lock end. Every per-app lock is its own DeviceActivity, so locking 8 apps until the same time fired
        // intervalDidEnd 8 times at once and each posted a new UUID-identified notification (8 identical banners, build 36).
        // Debounce across all activities through the App Group, and use one stable identifier so iOS replaces instead of stacking.
        let now = Date().timeIntervalSince1970
        if !LockEndAlertGate.shouldPost(last: LockShared.defaults?.double(forKey: LockEndAlertGate.lastKey) ?? 0, now: now) { return }
        LockShared.defaults?.set(now, forKey: LockEndAlertGate.lastKey)
        let level = LockShared.defaults?.string(forKey: LockShared.lockEndAlertKey) ?? LockShared.lockEndAlertDefault
        if level == "off" { return }
        let voice = UNNotificationSoundName(LockShared.lockEndSoundName)
        let c = UNMutableNotificationContent()
        c.title = "ClingNote"; c.body = "Your lock time is up."
        switch level {
        case "subtle": c.interruptionLevel = .passive; c.sound = nil
        // Standard/Loud/Maximum play the spoken clip (App Group Library/Sounds, installed by the app);
        // iOS falls back to the default sound if the file is missing. Maximum's critical variant needs the
        // Critical Alerts entitlement to bypass silent; without it iOS plays it as a normal sound.
        case "standard": c.interruptionLevel = .active; c.sound = UNNotificationSound(named: voice)
        case "maximum": c.interruptionLevel = .timeSensitive; c.sound = .criticalSoundNamed(voice, withAudioVolume: 1.0)
        default: c.interruptionLevel = .timeSensitive; c.sound = UNNotificationSound(named: voice) // loud
        }
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: LockEndAlertGate.identifier, content: c, trigger: nil))
    }
}

/// Pure dedupe rule for the lock-end alert (mirrored in scripts/test-lock-end-dedupe.mjs).
enum LockEndAlertGate {
    static let identifier = "cling.lock.ended"
    static let lastKey = "lock.endAlert.lastAt"
    static let window: Double = 90 // seconds: ends of several activities at the same minute collapse into one alert
    /// Real end = a saved end time that has (nearly) arrived. Schedules are minute-granular (end truncated to the minute,
    /// so it can fire up to 60 s before `until`), hence the slack. 0 / missing = stopped by the app, far future = restart.
    static let endSlackMs: Double = 90_000
    static func isRealEnd(untilMs: Double, nowMs: Double) -> Bool { untilMs > 0 && untilMs <= nowMs + endSlackMs }
    static func shouldPost(last: Double, now: Double) -> Bool { last <= 0 || now - last >= window || now < last }
}
