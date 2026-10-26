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
    // Task timer (ms since epoch, written by src/utils/widgetSnapshot.js timerFields; absent = no timer).
    var tS: Double? = nil
    var tE: Double? = nil
    var tP: Double? = nil
}

// MARK: - Timer ring (same math/colors as src/utils/timerRing.js — keep ringStops identical to RING_STOPS there)

let ringStops: [(f: Double, h: Double)] = [(1.0, 130), (0.6, 52), (0.3, 28), (0.1, 0)]
let ringSat = 0.78, ringLight = 0.48
let widgetStep = 0.05, widgetMaxSteps = 20

func ringHue(_ f: Double) -> Double {
    let x = min(1, max(0, f))
    if x >= ringStops[0].f { return ringStops[0].h }
    for i in 1..<ringStops.count {
        let a = ringStops[i - 1], b = ringStops[i]
        if x >= b.f { return b.h + (a.h - b.h) * ((x - b.f) / (a.f - b.f)) }
    }
    return ringStops[ringStops.count - 1].h
}

/// HSL -> Color (SwiftUI's Color(hue:) is HSB).
func ringColor(_ f: Double) -> Color {
    let h = ringHue(f) / 360, s = ringSat, l = ringLight
    let q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
    func c(_ t0: Double) -> Double {
        var t = t0; if t < 0 { t += 1 }; if t > 1 { t -= 1 }
        if t < 1.0 / 6 { return p + (q - p) * 6 * t }
        if t < 0.5 { return q }
        if t < 2.0 / 3 { return p + (q - p) * (2.0 / 3 - t) * 6 }
        return p
    }
    return Color(red: c(h + 1.0 / 3), green: c(h), blue: c(h - 1.0 / 3))
}

extension WidgetTask {
    var timerStart: Date? { (tS ?? 0) > 0 ? Date(timeIntervalSince1970: tS! / 1000) : nil }
    var timerEnd: Date? { (tE ?? 0) > 0 ? Date(timeIntervalSince1970: tE! / 1000) : nil }
    var timerPaused: Date? { (tP ?? 0) > 0 ? Date(timeIntervalSince1970: tP! / 1000) : nil }
    var hasTimer: Bool { !done && timerStart != nil && timerEnd != nil && timerEnd! > timerStart! }
    /// Remaining fraction 1...0 at `date` (frozen at the pause instant while paused).
    func ringFraction(at date: Date) -> Double {
        guard hasTimer, let s = timerStart, let e = timerEnd else { return 0 }
        let at = timerPaused ?? date
        return min(1, max(0, e.timeIntervalSince(at) / e.timeIntervalSince(s)))
    }
    func isRunning(at date: Date) -> Bool { hasTimer && timerPaused == nil && timerEnd! > date }
}

/// Timeline dates: every 5% of each running timer's duration still ahead, plus its end (so the color steps green→red).
func timerStepDates(_ tasks: [WidgetTask], after now: Date) -> [Date] {
    var out: [Date] = []
    for t in tasks where t.isRunning(at: now) {
        let s = t.timerStart!, e = t.timerEnd!, d = e.timeIntervalSince(s)
        var k = 1
        while Double(k) * widgetStep < 1 - 1e-9 {
            let at = s.addingTimeInterval(d * Double(k) * widgetStep)
            if at > now { out.append(at) }
            k += 1
        }
        out.append(e)
    }
    return Array(Set(out)).sorted().prefix(widgetMaxSteps * 3).map { $0 }
}

/// iPhone-timer style ring: the fill animates on its own via ProgressView(timerInterval:) (no per-second reloads);
/// the color comes from the timeline entry date. Paused/finished: static ring.
struct TaskTimerRing: View {
    let task: WidgetTask
    let date: Date
    var size: CGFloat = 16
    var line: CGFloat = 2.5
    var body: some View {
        let f = task.ringFraction(at: date)
        let color = ringColor(f)
        Group {
            if #available(iOSApplicationExtension 16.0, *) {
                if task.isRunning(at: date), let s = task.timerStart, let e = task.timerEnd {
                    ProgressView(timerInterval: s...e, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
                        .progressViewStyle(.circular).tint(color)
                } else { staticRing(f, color) }
            } else { staticRing(f, color) }
        }.frame(width: size, height: size)
    }
    func staticRing(_ f: Double, _ color: Color) -> some View {
        ZStack {
            Circle().stroke(f <= 0 ? ringColor(0).opacity(0.35) : CN.ring, lineWidth: line)
            Circle().trim(from: 0, to: CGFloat(f)).stroke(color, style: StrokeStyle(lineWidth: line, lineCap: .round)).rotationEffect(.degrees(-90))
        }
    }
}

/// Remaining time text: ticks by itself while running, static when paused/finished.
struct TaskTimerText: View {
    let task: WidgetTask
    let date: Date
    var body: some View {
        let color = ringColor(task.ringFraction(at: date))
        let left = max(0, Int(((task.timerEnd ?? date).timeIntervalSince(task.timerPaused ?? date)).rounded(.up)))
        let frozen = Text(String(format: "%d:%02d", left / 60, left % 60)).monospacedDigit().foregroundColor(color)
        if #available(iOSApplicationExtension 16.0, *) {
            if task.isRunning(at: date), let e = task.timerEnd {
                Text(timerInterval: date...e, countsDown: true).monospacedDigit().foregroundColor(color)
            } else { frozen }
        } else { frozen }
    }
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
        if FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) == nil {
            NSLog("[ClingNoteWidget] App Group %@ missing from widget entitlements/profile", appGroup)
        }
        guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: snapshotKey) else {
            NSLog("[ClingNoteWidget] no snapshot in App Group"); return .empty
        }
        let snap: WidgetSnapshot
        do { snap = try JSONDecoder().decode(WidgetSnapshot.self, from: Data(json.utf8)) }
        catch { NSLog("[ClingNoteWidget] snapshot decode failed: %@", String(describing: error)); return .empty }
        // POSIX locale: the JS side always writes ASCII yyyy-MM-dd; a non-Latin-digit device locale must not break the match.
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current; f.dateFormat = "yyyy-MM-dd"
        let todayStr = f.string(from: today)
        if snap.date != todayStr { NSLog("[ClingNoteWidget] stale snapshot %@ (today %@)", snap.date, todayStr); return .empty }
        return snap // yesterday's list never shows as today
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
        // Running task timers add entries at every 5% of their duration (+ end) so the ring color steps green→red.
        let now = Date(), snap = WidgetSnapshot.load()
        let midnight = Calendar.current.startOfDay(for: now.addingTimeInterval(86_400))
        let steps = timerStepDates(snap.tasks, after: now).filter { $0 < midnight }
        completion(Timeline(entries: [Entry(date: now, snapshot: snap)] + steps.map { Entry(date: $0, snapshot: snap) }, policy: .after(midnight)))
    }
}

// MARK: - Design (matches the app: brand blue, pill chips "30m · 15p", done = check + dimmed + strikethrough)

enum CN {
    static let bgTop = Color(red: 0.047, green: 0.086, blue: 0.188)     // #0C1630 (--c-surface)
    static let bgBottom = Color(red: 0.027, green: 0.051, blue: 0.110)  // #070D1C (--c-bg)
    static let green = Color(red: 0.357, green: 0.608, blue: 1.0)     // #5B9BFF (--c-accent-text, brand blue)
    static let text = Color(red: 0.949, green: 0.961, blue: 0.988)      // #F2F5FC
    static let text2 = Color(red: 0.663, green: 0.706, blue: 0.800)  // #A9B4CC
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
    var date: Date = Date()
    var body: some View {
        HStack(spacing: 8) {
            CheckCircle(task: task, size: 15)
            Link(destination: taskURL(task)) {
                HStack(spacing: 8) {
                    Text(task.title).font(.system(size: 13, weight: .semibold)).foregroundColor(CN.text)
                        .strikethrough(task.done, color: CN.text2).lineLimit(1)
                    Spacer(minLength: 4)
                    if task.hasTimer {
                        TaskTimerRing(task: task, date: date, size: 14, line: 2)
                        TaskTimerText(task: task, date: date).font(.system(size: 11, weight: .semibold)).frame(maxWidth: 44)
                    } else if !task.time.isEmpty { Text(task.time).font(.system(size: 11)).monospacedDigit().foregroundColor(CN.text2) }
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
    var date: Date = Date()
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
                if let n = next, n.hasTimer {
                    HStack(spacing: 6) {
                        TaskTimerRing(task: n, date: date, size: 18)
                        TaskTimerText(task: n, date: date).font(.system(size: 13, weight: .bold))
                    }
                } else if let n = next, !chipText(n).isEmpty { Chip(text: (n.time.isEmpty ? "" : n.time + " · ") + chipText(n)) }
            }
            .widgetURL(next.map(taskURL) ?? URL(string: "clingnote://home"))
        }
    }
}

struct ListView: View {
    let snap: WidgetSnapshot
    let maxRows: Int
    let showBar: Bool
    var date: Date = Date()
    var body: some View {
        if snap.total == 0 { EmptyState() } else {
            VStack(alignment: .leading, spacing: showBar ? 7 : 6) {
                Header(snap: snap)
                if showBar { ProgressBar(progress: snap.progress) }
                ForEach(Array(snap.tasks.prefix(maxRows))) { TaskRow(task: $0, date: date) }
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
            case .systemSmall: SmallView(snap: entry.snapshot, date: entry.date)
            case .systemMedium: ListView(snap: entry.snapshot, maxRows: 4, showBar: false, date: entry.date)
            default: ListView(snap: entry.snapshot, maxRows: 8, showBar: true, date: entry.date)
            }
        }
        if #available(iOSApplicationExtension 17.0, *) {
            content.containerBackground(for: .widget) { CN.background }
        } else {
            content.padding(16).background(CN.background)
        }
    }
}

// Registered in ClingNoteWidgets (MatchupWidget.swift).
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
