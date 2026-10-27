import WidgetKit
import SwiftUI

// "Matchup" widget: a sports-matchup style card for today.
// Home side = next incomplete task, away side = the one after it (snapshot order: open tasks with a start time by time,
// then list order — the same order the "Today's tasks" widget shows). Center = first task's start time ("kickoff") if it
// has one, else time left in the day (until the 8-hour lock ends when one is running, else local midnight).
// Bottom = split bar: % of today's points earned vs remaining (task counts when no points are set).

// Extra, optional snapshot fields (older snapshots decode with nil).
private struct LockFields: Codable { let lockStartMs: Double?; let lockEndMs: Double? }
private let mAppGroup = "group.app.clingnote.ios"
private let mSnapshotKey = "widget.today"

struct MatchupEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
    let lockStart: Date?
    let lockEnd: Date?
}

struct MatchupData {
    let home: WidgetTask?
    let away: WidgetTask?
    let left: Int
    let earnedPct: Int          // 0...100
    let kickoff: String?        // home task start time "HH:MM"
    let remaining: String       // compact "5h20m" / "45m"
    let lockedIn: String?       // elapsed since 8-hour lock start (nil = no active lock)
    let snap: WidgetSnapshot
    let date: Date
    let timerTask: WidgetTask?  // first open task with a timer set (running, paused or finished)

    init(_ e: MatchupEntry) {
        let s = e.snapshot
        snap = s
        date = e.date
        timerTask = s.open.first(where: { $0.isRunning(at: e.date) }) ?? s.open.first(where: { $0.hasTimer })
        let open = s.open
        home = open.first
        away = open.dropFirst().first
        left = max(0, s.total - s.done)
        let frac: Double = s.ptsRequired > 0 ? min(1, Double(s.ptsDone) / Double(s.ptsRequired)) : s.progress
        earnedPct = Int((min(1, max(0, frac)) * 100).rounded())
        kickoff = (home?.time.isEmpty == false) ? home?.time : nil
        let end: Date
        if let le = e.lockEnd, le > e.date { end = le } else { end = Calendar.current.startOfDay(for: e.date.addingTimeInterval(86_400)) }
        remaining = compactDuration(end.timeIntervalSince(e.date))
        if let ls = e.lockStart, let le = e.lockEnd, ls <= e.date, le > e.date { lockedIn = compactDuration(e.date.timeIntervalSince(ls)) } else { lockedIn = nil }
    }
}

/// "5h20m", "45m", "0m" (no seconds).
func compactDuration(_ t: TimeInterval) -> String {
    let m = max(0, Int(t / 60))
    let h = m / 60, r = m % 60
    return h > 0 ? "\(h)h\(String(format: "%02d", r))m" : "\(r)m"
}

struct MatchupProvider: TimelineProvider {
    static func loadLock() -> (Date?, Date?) {
        guard let json = UserDefaults(suiteName: mAppGroup)?.string(forKey: mSnapshotKey),
              let f = try? JSONDecoder().decode(LockFields.self, from: Data(json.utf8)) else { return (nil, nil) }
        let s = (f.lockStartMs ?? 0) > 0 ? Date(timeIntervalSince1970: f.lockStartMs! / 1000) : nil
        let e = (f.lockEndMs ?? 0) > 0 ? Date(timeIntervalSince1970: f.lockEndMs! / 1000) : nil
        return (s, e)
    }
    func placeholder(in context: Context) -> MatchupEntry { MatchupEntry(date: Date(), snapshot: .sample, lockStart: nil, lockEnd: nil) }
    func getSnapshot(in context: Context, completion: @escaping (MatchupEntry) -> Void) {
        let s = WidgetSnapshot.load(); let (ls, le) = Self.loadLock()
        completion(MatchupEntry(date: Date(), snapshot: context.isPreview && s.total == 0 ? .sample : s, lockStart: ls, lockEnd: le))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<MatchupEntry>) -> Void) {
        // One entry per minute for the next hour so the compact clocks tick without the app; then ask again.
        // The app also reloads timelines on every task change.
        let snap = WidgetSnapshot.load(); let (ls, le) = Self.loadLock()
        let now = Date()
        let start = Calendar.current.date(bySetting: .second, value: 0, of: now) ?? now
        let midnight = Calendar.current.startOfDay(for: now.addingTimeInterval(86_400))
        var entries: [MatchupEntry] = [MatchupEntry(date: now, snapshot: snap, lockStart: ls, lockEnd: le)]
        for i in 1...60 {
            let d = start.addingTimeInterval(Double(i) * 60)
            if d >= midnight { break }
            entries.append(MatchupEntry(date: d, snapshot: snap, lockStart: ls, lockEnd: le))
        }
        // Timer ring color steps (every 5% of a running timer + its end) within this window.
        let last = entries.last?.date ?? now
        for d in timerStepDates(snap.tasks, after: now) where d <= last && d < midnight {
            entries.append(MatchupEntry(date: d, snapshot: snap, lockStart: ls, lockEnd: le))
        }
        entries.sort { $0.date < $1.date }
        let next = min(midnight, (entries.last?.date ?? now).addingTimeInterval(1))
        completion(Timeline(entries: entries, policy: .after(next)))
    }
}

// MARK: - Pieces

struct MatchupSide: View {
    let task: WidgetTask?
    let fallbackTop: String
    let fallbackBottom: String
    let alignment: HorizontalAlignment
    var body: some View {
        VStack(alignment: alignment, spacing: 3) {
            if let t = task {
                Text(t.title).font(.system(size: 14, weight: .bold)).foregroundColor(CN.text)
                    .lineLimit(2).multilineTextAlignment(alignment == .leading ? .leading : .trailing)
                Text(t.pts > 0 ? "\(t.pts) pts" : (fmtEst(t.est).isEmpty ? "—" : fmtEst(t.est)))
                    .font(.system(size: 20, weight: .heavy)).monospacedDigit().foregroundColor(CN.green)
            } else {
                Text(fallbackTop).font(.system(size: 14, weight: .bold)).foregroundColor(CN.text2)
                Text(fallbackBottom).font(.system(size: 20, weight: .heavy)).monospacedDigit().foregroundColor(CN.text)
            }
        }.frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }
}

struct SplitBar: View {
    let pct: Int
    var body: some View {
        VStack(spacing: 3) {
            GeometryReader { g in
                HStack(spacing: 2) {
                    Capsule().fill(CN.green).frame(width: max(3, (g.size.width - 2) * CGFloat(pct) / 100))
                    Capsule().fill(CN.text2.opacity(0.35))
                }
            }.frame(height: 5)
            HStack {
                Text("\(pct)% earned").foregroundColor(CN.green)
                Spacer()
                Text("\(100 - pct)% left").foregroundColor(CN.text2)
            }.font(.system(size: 10, weight: .semibold)).monospacedDigit()
        }
    }
}

struct MatchupAllDone: View {
    let snap: WidgetSnapshot
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: "trophy.fill").font(.system(size: 22)).foregroundColor(CN.green)
            Text(snap.total == 0 ? "No tasks today" : "All done").font(.system(size: 15, weight: .bold)).foregroundColor(CN.text)
            Text(snap.total == 0 ? "Tap to plan your day" : "\(snap.done)/\(snap.total) · \(snap.ptsLabel)")
                .font(.system(size: 11)).monospacedDigit().foregroundColor(CN.text2)
        }.frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Families

struct MatchupMediumView: View {
    let m: MatchupData
    var body: some View {
        if m.home == nil { MatchupAllDone(snap: m.snap) } else {
            VStack(spacing: 8) {
                HStack {
                    Text("TODAY").font(.system(size: 10, weight: .bold)).kerning(0.8).foregroundColor(CN.text2)
                    Spacer()
                    if let l = m.lockedIn { Label(l, systemImage: "lock.fill").font(.system(size: 10, weight: .semibold)).foregroundColor(CN.text2) }
                    Text("\(m.left) left").font(.system(size: 10, weight: .semibold)).monospacedDigit().foregroundColor(CN.text2)
                }
                HStack(alignment: .center, spacing: 8) {
                    VStack(alignment: .leading, spacing: 3) {
                        MatchupSide(task: m.home, fallbackTop: "", fallbackBottom: "", alignment: .leading)
                        if let t = m.timerTask {
                            HStack(spacing: 4) {
                                TaskTimerRing(task: t, date: m.date, size: 14, line: 2)
                                TaskTimerText(task: t, date: m.date).font(.system(size: 11, weight: .semibold)).lineLimit(1)
                            }
                        }
                    }
                    VStack(spacing: 1) {
                        Text(m.kickoff ?? m.remaining).font(.system(size: 17, weight: .heavy)).monospacedDigit().foregroundColor(CN.text)
                        Text(m.kickoff == nil ? "left today" : "starts").font(.system(size: 9, weight: .medium)).foregroundColor(CN.text2)
                    }.frame(minWidth: 62)
                    MatchupSide(task: m.away, fallbackTop: "Done", fallbackBottom: "\(m.snap.done)/\(m.snap.total)", alignment: .trailing)
                }
                Spacer(minLength: 0)
                SplitBar(pct: m.earnedPct)
            }
            .widgetURL(m.home.map(taskURL) ?? URL(string: "clingnote://home"))
        }
    }
}

@available(iOSApplicationExtension 16.0, *)
struct MatchupRectangularView: View {
    let m: MatchupData
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            if let h = m.home {
                Text(m.away.map { "\(h.title) vs \($0.title)" } ?? "\(h.title) vs Done")
                    .font(.system(size: 14, weight: .semibold)).lineLimit(1).widgetAccentable()
                if let t = m.timerTask {
                    HStack(spacing: 4) {
                        TaskTimerRing(task: t, date: m.date, size: 12, line: 2)
                        TaskTimerText(task: t, date: m.date).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                        Text("· \(m.left) left").font(.system(size: 12)).monospacedDigit().lineLimit(1)
                    }
                } else {
                    Text("\(m.left) left · \(m.kickoff ?? m.remaining)\(m.kickoff == nil ? " today" : "")")
                        .font(.system(size: 12)).monospacedDigit().lineLimit(1)
                }
            } else {
                Text(m.snap.total == 0 ? "No tasks today" : "All done").font(.system(size: 14, weight: .semibold)).widgetAccentable()
                Text(m.snap.ptsLabel).font(.system(size: 12)).monospacedDigit()
            }
            ProgressView(value: Double(m.earnedPct), total: 100).progressViewStyle(.linear).widgetAccentable()
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

@available(iOSApplicationExtension 16.0, *)
struct MatchupCircularView: View {
    let m: MatchupData
    var body: some View {
        if let t = m.timerTask {
            ZStack {
                TaskTimerRing(task: t, date: m.date, size: 50, line: 5)
                TaskTimerText(task: t, date: m.date).font(.system(size: 11, weight: .bold)).multilineTextAlignment(.center)
                    .lineLimit(1).minimumScaleFactor(0.5).frame(width: 36)
            }
        } else { pointsGauge }
    }
    var pointsGauge: some View {
        Gauge(value: Double(m.earnedPct), in: 0...100) {
            Text("pts")
        } currentValueLabel: {
            VStack(spacing: 0) {
                if let l = m.lockedIn {
                    HStack(spacing: 1) { Image(systemName: "lock.fill").font(.system(size: 6)); Text(l).font(.system(size: 7, weight: .semibold)).monospacedDigit() }
                        .lineLimit(1).minimumScaleFactor(0.6)
                }
                Text("\(m.left)").font(.system(size: 18, weight: .bold)).monospacedDigit().widgetAccentable()
                Text(m.remaining).font(.system(size: 7, weight: .medium)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
            }
        }
        .gaugeStyle(.accessoryCircular)
    }
}

@available(iOSApplicationExtension 16.0, *)
struct MatchupInlineView: View {
    let m: MatchupData
    private func short(_ s: String, _ n: Int = 14) -> String { s.count > n ? String(s.prefix(n - 1)) + "…" : s }
    var body: some View {
        if let h = m.home {
            Text("Next: \(short(h.title))\(m.away.map { " vs \(short($0.title))" } ?? "") · \(m.left) left")
        } else {
            Text(m.snap.total == 0 ? "No tasks today" : "All done · \(m.snap.ptsLabel)")
        }
    }
}

struct MatchupWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: MatchupEntry
    @ViewBuilder var content: some View {
        let m = MatchupData(entry)
        if #available(iOSApplicationExtension 16.0, *) {
            switch family {
            case .accessoryRectangular: MatchupRectangularView(m: m)
            case .accessoryCircular: MatchupCircularView(m: m)
            case .accessoryInline: MatchupInlineView(m: m)
            default: MatchupMediumView(m: m)
            }
        } else { MatchupMediumView(m: m) }
    }
    var isAccessory: Bool {
        if #available(iOSApplicationExtension 16.0, *) {
            return family == .accessoryRectangular || family == .accessoryCircular || family == .accessoryInline
        }
        return false
    }
    var body: some View {
        if #available(iOSApplicationExtension 17.0, *) {
            if isAccessory { content.containerBackground(for: .widget) { Color.clear } }
            else { content.containerBackground(for: .widget) { CN.background } }
        } else if isAccessory {
            content
        } else {
            content.padding(16).background(CN.background)
        }
    }
}

struct MatchupWidget: Widget {
    private var families: [WidgetFamily] {
        if #available(iOSApplicationExtension 16.0, *) { return [.systemMedium, .accessoryRectangular, .accessoryCircular, .accessoryInline] }
        return [.systemMedium]
    }
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ClingNoteMatchup", provider: MatchupProvider()) { entry in
            MatchupWidgetView(entry: entry).widgetURL(URL(string: "clingnote://home"))
        }
        .configurationDisplayName("Matchup")
        .description("Your next two tasks head to head, time left and points earned.")
        .supportedFamilies(families)
    }
}

@main
struct ClingNoteWidgets: WidgetBundle {
    var body: some Widget {
        TodayTasksWidget()
        MatchupWidget()
        if #available(iOS 16.1, *) { FocusLiveActivity() }
        if #available(iOS 26.0, *) { WakeAlarmLiveActivity() } // AlarmKit wake-up alarm snooze countdown
    }
}
