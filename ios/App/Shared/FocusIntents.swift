// Lock-screen focus timer actions. Member of BOTH the App and ClingNoteWidget targets: a LiveActivityIntent / control intent must be
// compiled into the app so iOS can run it in the app's process (and open the app for StartFocusIntent).
// Pattern (same as CompleteTaskIntent / the Siri drain): the intent only (1) updates the Live Activity for instant feedback and
// (2) appends {id, kind, taskId, ts} to App Group "focus.pending". The app reconciles that queue on launch/foreground
// (src/utils/focusActions.js) through its own timer and task-completion code, so points are credited exactly once.
// NEEDS CI COMPILE + ON-DEVICE TESTING (no Swift toolchain with the iOS SDK on the dev box).
import Foundation
#if canImport(AppIntents)
import AppIntents
#endif
#if canImport(ActivityKit)
import ActivityKit
#endif
#if canImport(WidgetKit)
import WidgetKit
#endif
#if canImport(UserNotifications)
import UserNotifications
#endif

enum FocusActionStore {
    static let appGroup = "group.app.clingnote.ios"
    static let pendingKey = "focus.pending"
    static let maxItems = 30

    static func read(_ d: UserDefaults) -> [[String: Any]] {
        return (d.array(forKey: pendingKey) as? [[String: Any]]) ?? []
    }

    static func append(kind: String, taskId: String) {
        guard let d = UserDefaults(suiteName: appGroup),
              taskId.range(of: "^[A-Za-z0-9_-]{1,64}$", options: .regularExpression) != nil else { return }
        var q = read(d)
        let item: [String: Any] = [
            "id": UUID().uuidString,
            "kind": kind,
            "taskId": taskId,
            "ts": Date().timeIntervalSince1970 * 1000,
        ]
        q.append(item)
        if q.count > maxItems { q.removeFirst(q.count - maxItems) }
        d.set(q, forKey: pendingKey)
    }

    /// Removes exactly the reconciled entries (by id); actions queued meanwhile are kept.
    static func ack(ids: Set<String>) {
        guard let d = UserDefaults(suiteName: appGroup) else { return }
        let rest = read(d).filter { !ids.contains(($0["id"] as? String) ?? "") }
        d.set(rest, forKey: pendingKey)
    }
}

#if canImport(AppIntents) && canImport(ActivityKit)
@available(iOS 17.0, *)
enum FocusActivityUpdater {
    /// Pause: freeze the remaining time. Resume: restart the countdown from the frozen remaining time.
    static func setPaused(_ paused: Bool, taskId: String) async {
        for a in Activity<FocusActivityAttributes>.activities where (a.attributes.taskId ?? "") == taskId {
            var s = a.content.state
            let now = Date()
            if paused {
                if s.paused { continue }
                s.remainingSec = max(0, Int(s.endsAt.timeIntervalSince(now).rounded()))
                s.paused = true
                await a.update(ActivityContent(state: s, staleDate: nil))
                withdrawTimerNotification(a.attributes.notifId)
            } else {
                if !s.paused { continue }
                let left = TimeInterval(s.remainingSec ?? 0)
                s.endsAt = now.addingTimeInterval(left)
                s.paused = false
                s.remainingSec = nil
                await a.update(ActivityContent(state: s, staleDate: s.endsAt))
                rescheduleTimerNotification(a.attributes.notifId, title: a.attributes.title, at: s.endsAt)
            }
        }
    }

    static func withdrawTimerNotification(_ id: String?) {
        #if canImport(UserNotifications)
        guard let id = id, !id.isEmpty else { return }
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
        #endif
    }

    /// Same identifier as the app's notification, so the app's own reschedule (on reconcile) replaces this one.
    static func rescheduleTimerNotification(_ id: String?, title: String, at: Date) {
        #if canImport(UserNotifications)
        guard let id = id, !id.isEmpty else { return }
        let secs = at.timeIntervalSinceNow
        guard secs > 1 else { return }
        let c = UNMutableNotificationContent()
        c.title = "Timer finished"
        c.body = "Time's up: \(title)"
        c.sound = .default
        let req = UNNotificationRequest(identifier: id, content: c, trigger: UNTimeIntervalNotificationTrigger(timeInterval: secs, repeats: false))
        UNUserNotificationCenter.current().add(req) { _ in }
        #endif
    }

    static func end(taskId: String) async {
        for a in Activity<FocusActivityAttributes>.activities where (a.attributes.taskId ?? "") == taskId {
            withdrawTimerNotification(a.attributes.notifId)
            await a.end(nil, dismissalPolicy: .immediate)
        }
    }
}

@available(iOS 17.0, *)
struct FocusPauseIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Pause focus"
    static var isDiscoverable: Bool = false
    @Parameter(title: "Task ID") var taskId: String

    init() {}
    init(taskId: String) { self.taskId = taskId }

    func perform() async throws -> some IntentResult {
        // An auto-started (locked) focus can't be paused; the button is hidden, this also covers an older activity.
        if Activity<FocusActivityAttributes>.activities.contains(where: { ($0.attributes.taskId ?? "") == taskId && ($0.content.state.locked ?? false) }) {
            return .result()
        }
        FocusActionStore.append(kind: "pause", taskId: taskId)
        await FocusActivityUpdater.setPaused(true, taskId: taskId)
        return .result()
    }
}

@available(iOS 17.0, *)
struct FocusResumeIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Resume focus"
    static var isDiscoverable: Bool = false
    @Parameter(title: "Task ID") var taskId: String

    init() {}
    init(taskId: String) { self.taskId = taskId }

    func perform() async throws -> some IntentResult {
        FocusActionStore.append(kind: "resume", taskId: taskId)
        await FocusActivityUpdater.setPaused(false, taskId: taskId)
        return .result()
    }
}

/// Done: the app marks the task complete and awards its points on its next launch/foreground (one completion path).
@available(iOS 17.0, *)
struct FocusDoneIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Finish focus task"
    static var isDiscoverable: Bool = false
    @Parameter(title: "Task ID") var taskId: String

    init() {}
    init(taskId: String) { self.taskId = taskId }

    func perform() async throws -> some IntentResult {
        FocusActionStore.append(kind: "done", taskId: taskId)
        await FocusActivityUpdater.end(taskId: taskId)
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
        return .result()
    }
}
#endif

#if canImport(AppIntents)
/// Control Center / lock-screen control (iOS 18): start focus on the next task. Opens the app, because ActivityKit only starts a
/// Live Activity from the foreground; queues {taskId, ts} in "intent.timer", which HomeView already drains (drainTimerIntents ->
/// startTimer, same as Siri "Start a timer"). taskId "" lets the app pick the next task itself.
@available(iOS 18.0, *)
struct StartFocusIntent: AppIntent {
    static var title: LocalizedStringResource = "Start focus"
    static var description = IntentDescription("Start a focus timer on your next ClingNote task.")
    static var openAppWhenRun: Bool = true
    static var isDiscoverable: Bool = false

    init() {}

    func perform() async throws -> some IntentResult {
        guard let d = UserDefaults(suiteName: FocusActionStore.appGroup) else { return .result() }
        var q = (d.array(forKey: "intent.timer") as? [[String: Any]]) ?? []
        let item: [String: Any] = ["taskId": "", "ts": Date().timeIntervalSince1970 * 1000, "source": "control"]
        q.append(item)
        d.set(Array(q.suffix(5)), forKey: "intent.timer")
        return .result()
    }
}
#endif
