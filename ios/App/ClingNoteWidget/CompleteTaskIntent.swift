import AppIntents
import WidgetKit
import Foundation

// iOS 17 interactive widget: tapping the check circle completes a task without opening the app.
// 1) optimistic: mark done in the App Group snapshot ("widget.today") and recompute done/ptsDone/estLeft;
// 2) durable: append {taskId, day, ts} to "widget.pending" - the app drains it on launch/foreground through
//    HomeView's own toggleTaskCompletion (points, streak, boss, report), idempotently (src/utils/widgetQueue.js);
// 3) instant sync when online: POST {taskId, day, done:true} to the widget-complete function with the stored
//    Firebase ID token (set by the app on every open). Failure is fine: the queue still carries the tap.
@available(iOS 17.0, *)
struct CompleteTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete task"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Task ID") var taskId: String

    init() {}
    init(taskId: String) { self.taskId = taskId }

    func perform() async throws -> some IntentResult {
        guard let d = UserDefaults(suiteName: "group.app.clingnote.ios"),
              taskId.range(of: "^[A-Za-z0-9_-]{1,64}$", options: .regularExpression) != nil else { return .result() }
        var day = ""
        if let s = d.string(forKey: "widget.today"),
           var snap = (try? JSONSerialization.jsonObject(with: Data(s.utf8))) as? [String: Any],
           var tasks = snap["tasks"] as? [[String: Any]],
           let i = tasks.firstIndex(where: { ($0["id"] as? String) == taskId }) {
            day = snap["day"] as? String ?? ""
            if (tasks[i]["done"] as? Bool) != true {
                tasks[i]["done"] = true
                let pts = tasks[i]["pts"] as? Int ?? 0, est = tasks[i]["est"] as? Int ?? 0
                snap["done"] = (snap["done"] as? Int ?? 0) + 1
                snap["ptsDone"] = (snap["ptsDone"] as? Int ?? 0) + pts
                snap["estLeft"] = max(0, (snap["estLeft"] as? Int ?? 0) - est)
                // keep the app's order: open first, done last
                let t = tasks.remove(at: i); tasks.append(t)
                snap["tasks"] = tasks
                if let data = try? JSONSerialization.data(withJSONObject: snap), let out = String(data: data, encoding: .utf8) { d.set(out, forKey: "widget.today") }
            }
        } else { return .result() } // unknown task: nothing to do

        let ts = Int(Date().timeIntervalSince1970 * 1000)
        var queue: [[String: Any]] = []
        if let s = d.string(forKey: "widget.pending"), let a = (try? JSONSerialization.jsonObject(with: Data(s.utf8))) as? [[String: Any]] { queue = a }
        if !queue.contains(where: { ($0["taskId"] as? String) == taskId }) {
            queue.append(["taskId": taskId, "day": day, "ts": ts])
            if queue.count > 50 { queue.removeFirst(queue.count - 50) }
            if let data = try? JSONSerialization.data(withJSONObject: queue), let out = String(data: data, encoding: .utf8) { d.set(out, forKey: "widget.pending") }
        }
        WidgetCenter.shared.reloadAllTimelines()

        if let token = d.string(forKey: "widget.token"), !token.isEmpty,
           let ep = d.string(forKey: "widget.endpoint"), ep.hasPrefix("https://"), let url = URL(string: ep), !day.isEmpty {
            var req = URLRequest(url: url, timeoutInterval: 8)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.httpBody = try? JSONSerialization.data(withJSONObject: ["taskId": taskId, "day": day, "done": true])
            _ = try? await URLSession.shared.data(for: req) // expired token -> 401, queue still applies it on next open
        }
        return .result()
    }
}
