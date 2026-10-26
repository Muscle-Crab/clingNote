import AppIntents
import Foundation

/// Siri / Shortcuts / Action Button: "Add a task in ClingNote". Queues the task in the App Group ("intent.pending");
/// the app drains it on open/foreground through its normal add path (limits, points). NEEDS ON-DEVICE TESTING.
@available(iOS 16.0, *)
struct AddTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Add task"
    static var description = IntentDescription("Add a task to today's ClingNote list.")
    static var openAppWhenRun: Bool = false
    @Parameter(title: "Task") var title: String
    @Parameter(title: "Time") var time: Date?

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let clean = title.trimmingCharacters(in: .whitespacesAndNewlines).prefix(140)
        guard !clean.isEmpty, let d = UserDefaults(suiteName: "group.app.clingnote.ios") else { return .result(dialog: "Say what the task is.") }
        var q = (d.array(forKey: "intent.pending") as? [[String: Any]]) ?? []
        var item: [String: Any] = ["title": String(clean), "ts": Date().timeIntervalSince1970 * 1000]
        if let t = time { let c = Calendar.current.dateComponents([.hour, .minute], from: t); item["start"] = String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0) }
        q.append(item); d.set(Array(q.suffix(20)), forKey: "intent.pending")
        return .result(dialog: "Added \(String(clean)). Open ClingNote to lock it in.")
    }
}

@available(iOS 16.0, *)
struct ClingShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: AddTaskIntent(), phrases: ["Add a task in \(.applicationName)", "New \(.applicationName) task"],
                    shortTitle: "Add task", systemImageName: "plus.circle")
    }
}
