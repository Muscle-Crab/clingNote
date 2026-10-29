import AppIntents
import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Siri / Shortcuts / Action Button: "Add a task in ClingNote". Queues the task in the App Group ("intent.pending");
/// openAppWhenRun: iOS brings the app forward right after perform(), so the queue is drained (appStateChange -> intentDrain.js)
/// and the task is saved through the normal add path (limits, points) at once. NEEDS ON-DEVICE TESTING.
@available(iOS 16.0, *)
struct AddTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Add task"
    static var description = IntentDescription("Add a task to today's ClingNote list.")
    static var openAppWhenRun: Bool = true
    @Parameter(title: "Task") var title: String
    @Parameter(title: "Time") var time: Date?

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let clean = title.trimmingCharacters(in: .whitespacesAndNewlines).prefix(140)
        guard !clean.isEmpty, let d = UserDefaults(suiteName: "group.app.clingnote.ios") else { return .result(dialog: "Say what the task is.") }
        var q = (d.array(forKey: "intent.pending") as? [[String: Any]]) ?? []
        var item: [String: Any] = ["title": String(clean), "ts": Date().timeIntervalSince1970 * 1000]
        if let t = time {
            let c = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: t)
            item["start"] = String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
            // keep the day too ("tomorrow at 3"): the app schedules it on that date instead of today
            item["date"] = String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
        }
        q.append(item); d.set(Array(q.suffix(20)), forKey: "intent.pending")
        return .result(dialog: "Adding \(String(clean)) to ClingNote.")
    }
}

// MARK: - Today's tasks as Siri entities (read from the widget snapshot the app writes on every change: App Group "widget.today")
// NEEDS ON-DEVICE TESTING: none of this was compiled in the dev box (no Swift toolchain); JS half is tested in scripts/test-siri-intents.js.
private let groupId = "group.app.clingnote.ios"

@available(iOS 16.0, *)
enum ClingSnapshot {
    static func load() -> [String: Any]? {
        guard let d = UserDefaults(suiteName: groupId), let s = d.string(forKey: "widget.today"),
              let snap = (try? JSONSerialization.jsonObject(with: Data(s.utf8))) as? [String: Any] else { return nil }
        // a snapshot from another day is stale: Siri must not act on yesterday's list
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        guard (snap["date"] as? String) == f.string(from: Date()) else { return nil }
        return snap
    }
    static func tasks() -> [[String: Any]] { (load()?["tasks"] as? [[String: Any]]) ?? [] }
    static func openTasks() -> [[String: Any]] { tasks().filter { ($0["done"] as? Bool) != true && !(($0["title"] as? String) ?? "").isEmpty } }
    /// Same rule as src/utils/siriIntents.js whatsNext(): next timed task at/after now, else first untimed, else earliest timed.
    static func next() -> [String: Any]? {
        let open = openTasks(); guard !open.isEmpty else { return nil }
        let c = Calendar.current.dateComponents([.hour, .minute], from: Date())
        let hm = String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
        let time: ([String: Any]) -> String = { (($0["time"] as? String) ?? "") }
        let timed = open.filter { !time($0).isEmpty }.sorted { time($0) < time($1) }
        return timed.first { time($0) >= hm } ?? open.first { time($0).isEmpty } ?? timed.first
    }
}

@available(iOS 16.0, *)
struct ClingTaskEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Task"
    static var defaultQuery = ClingTaskQuery()
    var id: String
    var title: String
    var time: String
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)", subtitle: time.isEmpty ? nil : "\(time)")
    }
    init(id: String, title: String, time: String) { self.id = id; self.title = title; self.time = time }
    init?(_ row: [String: Any]) {
        guard let id = row["id"] as? String, let t = row["title"] as? String else { return nil }
        self.init(id: id, title: t, time: (row["time"] as? String) ?? "")
    }
}

@available(iOS 16.0, *)
struct ClingTaskQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [ClingTaskEntity] {
        ClingSnapshot.tasks().compactMap { ClingTaskEntity($0) }.filter { identifiers.contains($0.id) }
    }
    func entities(matching string: String) async throws -> [ClingTaskEntity] {
        let q = string.lowercased()
        return ClingSnapshot.openTasks().compactMap { ClingTaskEntity($0) }.filter { $0.title.lowercased().contains(q) }
    }
    func suggestedEntities() async throws -> [ClingTaskEntity] { ClingSnapshot.openTasks().compactMap { ClingTaskEntity($0) } }
}

// MARK: - "Complete <task> in ClingNote"
// Same two steps as the widget's CompleteTaskIntent: optimistic done in "widget.today" + durable {taskId, day, ts} in "widget.pending",
// which the app applies on open through toggleTaskCompletion (points, streak, report). No network call from here.
@available(iOS 16.0, *)
struct CompleteTaskSiriIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete task"
    static var description = IntentDescription("Mark one of today's ClingNote tasks as done.")
    static var openAppWhenRun: Bool = false
    @Parameter(title: "Task") var task: ClingTaskEntity

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let d = UserDefaults(suiteName: groupId), let s = d.string(forKey: "widget.today"),
              var snap = (try? JSONSerialization.jsonObject(with: Data(s.utf8))) as? [String: Any],
              var tasks = snap["tasks"] as? [[String: Any]],
              let i = tasks.firstIndex(where: { ($0["id"] as? String) == task.id }) else {
            return .result(dialog: "I couldn't find that task on today's list. Open ClingNote to refresh it.")
        }
        if (tasks[i]["done"] as? Bool) == true { return .result(dialog: "\(task.title) is already done.") }
        tasks[i]["done"] = true
        snap["done"] = (snap["done"] as? Int ?? 0) + 1
        snap["ptsDone"] = (snap["ptsDone"] as? Int ?? 0) + (tasks[i]["pts"] as? Int ?? 0)
        snap["estLeft"] = max(0, (snap["estLeft"] as? Int ?? 0) - (tasks[i]["est"] as? Int ?? 0))
        let t = tasks.remove(at: i); tasks.append(t); snap["tasks"] = tasks
        if let data = try? JSONSerialization.data(withJSONObject: snap), let out = String(data: data, encoding: .utf8) { d.set(out, forKey: "widget.today") }
        var queue: [[String: Any]] = []
        if let q = d.string(forKey: "widget.pending"), let a = (try? JSONSerialization.jsonObject(with: Data(q.utf8))) as? [[String: Any]] { queue = a }
        if !queue.contains(where: { ($0["taskId"] as? String) == task.id }) {
            queue.append(["taskId": task.id, "day": snap["day"] as? String ?? "", "ts": Int(Date().timeIntervalSince1970 * 1000)])
            if queue.count > 50 { queue.removeFirst(queue.count - 50) }
            if let data = try? JSONSerialization.data(withJSONObject: queue), let out = String(data: data, encoding: .utf8) { d.set(out, forKey: "widget.pending") }
        }
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
        let left = (snap["tasks"] as? [[String: Any]] ?? []).filter { ($0["done"] as? Bool) != true }.count
        return .result(dialog: "Done: \(task.title). \(left) left today.")
    }
}

// MARK: - "What's next in ClingNote"
@available(iOS 16.0, *)
struct WhatsNextIntent: AppIntent {
    static var title: LocalizedStringResource = "What's next"
    static var description = IntentDescription("Hear the next task on today's ClingNote list.")
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snap = ClingSnapshot.load() else { return .result(dialog: "Open ClingNote once today so I can see your list.") }
        guard let n = ClingSnapshot.next() else {
            return .result(dialog: ((snap["total"] as? Int) ?? 0) > 0 ? "You are done for today. Nice work." : "Nothing planned for today yet.")
        }
        let left = ClingSnapshot.openTasks().count
        let time = (n["time"] as? String) ?? ""
        return .result(dialog: "Next: \((n["title"] as? String) ?? "")\(time.isEmpty ? "" : " at \(time)"). \(left) task\(left == 1 ? "" : "s") left today.")
    }
}

// MARK: - "Start a timer in ClingNote"
// Queues {taskId, minutes, ts} in "intent.timer" and opens the app; HomeView drains it (ClingNative.takeTimerIntents) and starts the
// timer through its normal startTimer() (8-hour shutdown, notifications, Live Activity all apply). No task = the next task.
@available(iOS 16.0, *)
struct StartTimerIntent: AppIntent {
    static var title: LocalizedStringResource = "Start timer"
    static var description = IntentDescription("Start a focus timer on a ClingNote task.")
    static var openAppWhenRun: Bool = true
    @Parameter(title: "Task") var task: ClingTaskEntity?
    @Parameter(title: "Minutes", inclusiveRange: (1, 240)) var minutes: Int?

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let d = UserDefaults(suiteName: groupId) else { return .result(dialog: "Couldn't reach ClingNote.") }
        let id = task?.id ?? ((ClingSnapshot.next()?["id"] as? String) ?? "")
        var q = (d.array(forKey: "intent.timer") as? [[String: Any]]) ?? []
        var item: [String: Any] = ["taskId": id, "ts": Date().timeIntervalSince1970 * 1000]
        if let m = minutes { item["minutes"] = m }
        q.append(item); d.set(Array(q.suffix(5)), forKey: "intent.timer")
        let name = task?.title ?? ((ClingSnapshot.next()?["title"] as? String) ?? "your next task")
        return .result(dialog: "Starting a timer for \(name).")
    }
}

@available(iOS 16.0, *)
struct ClingShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: AddTaskIntent(), phrases: ["Add a task in \(.applicationName)", "New \(.applicationName) task"],
                    shortTitle: "Add task", systemImageName: "plus.circle")
        AppShortcut(intent: CompleteTaskSiriIntent(), phrases: ["Complete \(\.$task) in \(.applicationName)", "Mark a task done in \(.applicationName)"],
                    shortTitle: "Complete task", systemImageName: "checkmark.circle")
        AppShortcut(intent: WhatsNextIntent(), phrases: ["What's next in \(.applicationName)", "What's my next \(.applicationName) task"],
                    shortTitle: "What's next", systemImageName: "list.bullet")
        AppShortcut(intent: StartTimerIntent(), phrases: ["Start a timer in \(.applicationName)", "Start a \(.applicationName) timer for \(\.$task)"],
                    shortTitle: "Start timer", systemImageName: "timer")
    }
}
