import WidgetKit
import SwiftUI

// Today's tasks on the home screen. Data: JSON written by the app (ClingWidgetPlugin) into the App Group.
// Mockups of all three sizes: /workspace/widget-preview (HTML, same layout/colors).

private let appGroup = "group.app.clingnote.ios"
private let snapshotKey = "widget.today"

struct WidgetTask: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let est: Int
    let pts: Int
    let done: Bool
    let time: String
}

struct WidgetSnapshot: Codable {
    let v: Int
    let date: String
    let total: Int
    let done: Int
    let estLeft: Int
    let ptsTotal: Int
    let ptsDone: Int
    let tasks: [WidgetTask]

    static let empty = WidgetSnapshot(v: 1, date: "", total: 0, done: 0, estLeft: 0, ptsTotal: 0, ptsDone: 0, tasks: [])
    static let sample = WidgetSnapshot(v: 1, date: "", total: 6, done: 2, estLeft: 165, ptsTotal: 120, ptsDone: 35, tasks: [
        WidgetTask(id: "a", title: "Gym session", est: 45, pts: 20, done: false, time: "07:15"),
        WidgetTask(id: "b", title: "Write weekly report", est: 90, pts: 40, done: false, time: "14:00"),
        WidgetTask(id: "c", title: "Call mom", est: 15, pts: 5, done: false, time: ""),
        WidgetTask(id: "d", title: "Groceries", est: 30, pts: 10, done: false, time: ""),
        WidgetTask(id: "e", title: "Wash car", est: 30, pts: 15, done: true, time: ""),
        WidgetTask(id: "f", title: "Meditate", est: 10, pts: 5, done: true, time: "")
    ])

    var progress: Double { total == 0 ? 0 : Double(done) / Double(total) }
    var open: [WidgetTask] { tasks.filter { !$0.done } }

    static func load(today: Date = Date()) -> WidgetSnapshot {
        guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: snapshotKey),
              let snap = try? JSONDecoder().decode(WidgetSnapshot.self, from: Data(json.utf8)) else { return .empty }
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.dateFormat = "yyyy-MM-dd"
        return snap.date == f.string(from: today) ? snap : .empty // yesterday's list never shows as today
    }
}

// MARK: - Timeline

struct Entry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), snapshot: .sample) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        let s = WidgetSnapshot.load()
        completion(Entry(date: Date(), snapshot: context.isPreview && s.total == 0 ? .sample : s))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        // The app reloads timelines on every change; refresh at midnight so the day rolls over.
        let midnight = Calendar.current.startOfDay(for: Date().addingTimeInterval(86_400))
        completion(Timeline(entries: [Entry(date: Date(), snapshot: .load())], policy: .after(midnight)))
    }
}

// MARK: - Design (matches the app: forest green, pill chips "30m · 15p", done = check + dimmed + strikethrough)

enum CN {
    static let bgTop = Color(red: 0.055, green: 0.165, blue: 0.122)     // #0E2A1F
    static let bgBottom = Color(red: 0.027, green: 0.090, blue: 0.067)  // #071711
    static let green = Color(red: 0.239, green: 0.863, blue: 0.592)     // #3DDC97 (--c-success)
    static let text = Color(red: 0.949, green: 0.961, blue: 0.988)      // #F2F5FC
    static let text2 = Color(red: 0.663, green: 0.737, blue: 0.690)
    static let chip = Color.white.opacity(0.08)
    static let ring = Color.white.opacity(0.12)
    static var background: LinearGradient { LinearGradient(colors: [bgTop, bgBottom], startPoint: .top, endPoint: .bottom) }
}

func fmtEst(_ m: Int) -> String {
    guard m > 0 else { return "" }
    let h = m / 60, r = m % 60
    return h > 0 ? (r > 0 ? "\(h)h \(r)m" : "\(h)h") : "\(m)m"
}
func chipText(_ t: WidgetTask) -> String { [fmtEst(t.est), t.pts > 0 ? "\(t.pts)p" : ""].filter { !$0.isEmpty }.joined(separator: " · ") }
func taskURL(_ t: WidgetTask) -> URL { URL(string: "clingnote://task/\(t.id)") ?? URL(string: "clingnote://home")! }

struct Chip: View {
    let text: String
    var body: some View {
        Text(text).font(.system(size: 11, weight: .medium)).monospacedDigit()
            .foregroundColor(CN.text2).padding(.horizontal, 7).padding(.vertical, 2)
            .background(Capsule().fill(CN.chip))
    }
}

struct Ring: View {
    let progress: Double
    var size: CGFloat = 34
    var body: some View {
        ZStack {
            Circle().stroke(CN.ring, lineWidth: 4)
            Circle().trim(from: 0, to: progress).stroke(CN.green, style: StrokeStyle(lineWidth: 4, lineCap: .round)).rotationEffect(.degrees(-90))
        }.frame(width: size, height: size)
    }
}

struct Header: View {
    let snap: WidgetSnapshot
    var body: some View {
        HStack(spacing: 6) {
            Text("Today").font(.system(size: 15, weight: .bold)).foregroundColor(CN.text)
            Text("\(snap.done)/\(snap.total)").font(.system(size: 12, weight: .semibold)).monospacedDigit().foregroundColor(CN.green)
            Spacer()
            if snap.estLeft > 0 { Text("\(fmtEst(snap.estLeft)) left").font(.system(size: 11)).foregroundColor(CN.text2) }
        }
    }
}

struct ProgressBar: View {
    let progress: Double
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(CN.ring)
                Capsule().fill(CN.green).frame(width: max(4, g.size.width * progress))
            }
        }.frame(height: 5)
    }
}

struct TaskRow: View {
    let task: WidgetTask
    var body: some View {
        HStack(spacing: 8) {
            CheckCircle(task: task, size: 15)
            Link(destination: taskURL(task)) {
                HStack(spacing: 8) {
                    Text(task.title).font(.system(size: 13, weight: .semibold)).foregroundColor(CN.text)
                        .strikethrough(task.done, color: CN.text2).lineLimit(1)
                    Spacer(minLength: 4)
                    if !task.time.isEmpty { Text(task.time).font(.system(size: 11)).monospacedDigit().foregroundColor(CN.text2) }
                    if !chipText(task).isEmpty { Chip(text: chipText(task)) }
                }
            }
        }.opacity(task.done ? 0.55 : 1)
    }
}

/// Open task on iOS 17+: a Button that runs CompleteTaskIntent in the background. Done tasks / iOS 15-16: plain icon (row taps open the app).
struct CheckCircle: View {
    let task: WidgetTask
    let size: CGFloat
    var icon: some View {
        Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
            .font(.system(size: size)).foregroundColor(task.done ? CN.green : CN.text2.opacity(0.6))
    }
    var body: some View {
        if #available(iOSApplicationExtension 17.0, *), !task.done {
            Button(intent: CompleteTaskIntent(taskId: task.id)) {
                Image(systemName: "circle").font(.system(size: size)).foregroundColor(CN.green.opacity(0.75)).contentShape(Circle())
            }.buttonStyle(.plain)
        } else { icon }
    }
}

struct EmptyState: View {
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: "checkmark.seal.fill").font(.system(size: 22)).foregroundColor(CN.green)
            Text("No tasks today").font(.system(size: 13, weight: .semibold)).foregroundColor(CN.text)
            Text("Tap to plan your day").font(.system(size: 11)).foregroundColor(CN.text2)
        }.frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct SmallView: View {
    let snap: WidgetSnapshot
    var body: some View {
        if snap.total == 0 { EmptyState() } else {
            let next = snap.open.first
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .center) {
                    Ring(progress: snap.progress)
                    Spacer()
                    VStack(alignment: .trailing, spacing: 0) {
                        Text("\(snap.done)/\(snap.total)").font(.system(size: 17, weight: .bold)).monospacedDigit().foregroundColor(CN.text)
                        Text("done").font(.system(size: 10)).foregroundColor(CN.text2)
                    }
                }
                Spacer(minLength: 0)
                Text(next == nil ? "ALL DONE" : "UP NEXT").font(.system(size: 10, weight: .bold)).kerning(0.6).foregroundColor(CN.green)
                HStack(alignment: .top, spacing: 6) {
                    if let n = next { CheckCircle(task: n, size: 18) }
                    Text(next?.title ?? "Great work today 🎉").font(.system(size: 15, weight: .semibold)).foregroundColor(CN.text).lineLimit(2)
                }
                if let n = next, !chipText(n).isEmpty { Chip(text: (n.time.isEmpty ? "" : n.time + " · ") + chipText(n)) }
            }
            .widgetURL(next.map(taskURL) ?? URL(string: "clingnote://home"))
        }
    }
}

struct ListView: View {
    let snap: WidgetSnapshot
    let maxRows: Int
    let showBar: Bool
    var body: some View {
        if snap.total == 0 { EmptyState() } else {
            VStack(alignment: .leading, spacing: showBar ? 7 : 6) {
                Header(snap: snap)
                if showBar { ProgressBar(progress: snap.progress) }
                ForEach(Array(snap.tasks.prefix(maxRows))) { TaskRow(task: $0) }
                Spacer(minLength: 0)
                if showBar {
                    HStack {
                        Text("\(snap.ptsDone)/\(snap.ptsTotal) pts").font(.system(size: 11, weight: .semibold)).monospacedDigit().foregroundColor(CN.green)
                        Spacer()
                        if snap.total > maxRows { Text("+\(snap.total - maxRows) more").font(.system(size: 11)).foregroundColor(CN.text2) }
                    }
                }
            }
        }
    }
}

struct ClingNoteWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry
    var body: some View {
        let content = Group {
            switch family {
            case .systemSmall: SmallView(snap: entry.snapshot)
            case .systemMedium: ListView(snap: entry.snapshot, maxRows: 4, showBar: false)
            default: ListView(snap: entry.snapshot, maxRows: 8, showBar: true)
            }
        }
        if #available(iOSApplicationExtension 17.0, *) {
            content.containerBackground(for: .widget) { CN.background }
        } else {
            content.padding(16).background(CN.background)
        }
    }
}

@main
struct TodayTasksWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ClingNoteToday", provider: Provider()) { entry in
            ClingNoteWidgetView(entry: entry).widgetURL(URL(string: "clingnote://home"))
        }
        .configurationDisplayName("Today's tasks")
        .description("Your tasks for today with time estimates.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
