import WidgetKit
import SwiftUI
import ActivityKit
#if canImport(AppIntents)
import AppIntents
#endif

/// Lock screen / Dynamic Island focus timer: countdown (or frozen remaining time + "Paused"), points toward today's target,
/// time left in the 8-hour day, and on iOS 17+ Pause/Resume + Done buttons (FocusIntents.swift). NEEDS ON-DEVICE TESTING.
@available(iOS 16.1, *)
struct FocusLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FocusActivityAttributes.self) { ctx in
            FocusLockScreenView(attributes: ctx.attributes, state: ctx.state)
                .padding()
                .widgetURL(URL(string: "clingnote://home"))
        } dynamicIsland: { ctx in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(ctx.state.paused ? "Paused" : "Focus").font(.caption2).foregroundColor(.secondary)
                        Text(ctx.attributes.title).font(.subheadline).lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    FocusTimeText(state: ctx.state).font(.title3.monospacedDigit())
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        FocusProgressLine(state: ctx.state)
                        FocusButtons(attributes: ctx.attributes, state: ctx.state)
                    }
                }
            } compactLeading: {
                Image(systemName: ctx.state.paused ? "pause.fill" : "timer")
            } compactTrailing: {
                FocusTimeText(state: ctx.state).monospacedDigit().frame(width: 48)
            } minimal: {
                Image(systemName: ctx.state.paused ? "pause.fill" : "timer")
            }
        }
    }
}

@available(iOS 16.1, *)
struct FocusLockScreenView: View {
    let attributes: FocusActivityAttributes
    let state: FocusActivityAttributes.ContentState
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(state.paused ? "Paused" : "Focus").font(.caption).foregroundColor(state.paused ? .orange : .secondary)
                    Text(attributes.title).font(.headline).lineLimit(1)
                }
                Spacer()
                FocusTimeText(state: state).font(.title2.monospacedDigit()).frame(width: 96, alignment: .trailing)
                    .foregroundColor(state.paused ? .secondary : .primary)
            }
            FocusProgressLine(state: state)
            FocusButtons(attributes: attributes, state: state)
        }
    }
}

/// Running: live countdown. Paused: the frozen remaining time.
@available(iOS 16.1, *)
struct FocusTimeText: View {
    let state: FocusActivityAttributes.ContentState
    var body: some View {
        if state.paused {
            Text(FocusFormat.clock(state.remainingSec ?? 0))
        } else {
            Text(timerInterval: Date()...max(Date(), state.endsAt), countsDown: true)
        }
    }
}

/// "120/235 pts · 3:12:05 left today" (each half only when known).
@available(iOS 16.1, *)
struct FocusProgressLine: View {
    let state: FocusActivityAttributes.ContentState
    var body: some View {
        let done = state.ptsDone ?? 0
        let target = state.ptsTarget ?? 0
        let dayEnd = state.dayEndsAt.flatMap { $0 > Date() ? $0 : nil }
        if target > 0 || dayEnd != nil {
            HStack(spacing: 6) {
                if target > 0 {
                    Text("\(done)/\(target) pts").foregroundColor(done >= target ? .green : .secondary)
                }
                if target > 0 && dayEnd != nil {
                    Text("·").foregroundColor(.secondary)
                }
                if let end = dayEnd {
                    Text(timerInterval: Date()...max(Date(), end), countsDown: true).monospacedDigit().foregroundColor(.secondary)
                    Text("left today").foregroundColor(.secondary)
                }
                Spacer(minLength: 0)
            }
            .font(.caption)
            .lineLimit(1)
        }
    }
}

/// iOS 17+: interactive Pause/Resume + Done (LiveActivityIntent). Older iOS: nothing (tapping opens the app).
@available(iOS 16.1, *)
struct FocusButtons: View {
    let attributes: FocusActivityAttributes
    let state: FocusActivityAttributes.ContentState
    var body: some View {
        if #available(iOS 17.0, *) {
            if let id = attributes.taskId, !id.isEmpty {
                HStack(spacing: 8) {
                    if state.paused {
                        Button(intent: FocusResumeIntent(taskId: id)) {
                            Label("Resume", systemImage: "play.fill").frame(maxWidth: .infinity)
                        }
                    } else if !(state.locked ?? false) {
                        Button(intent: FocusPauseIntent(taskId: id)) {
                            Label("Pause", systemImage: "pause.fill").frame(maxWidth: .infinity)
                        }
                    }
                    Button(intent: FocusDoneIntent(taskId: id)) {
                        Label("Done", systemImage: "checkmark").frame(maxWidth: .infinity)
                    }
                    .tint(.green)
                }
                .buttonStyle(.bordered)
                .font(.subheadline.weight(.semibold))
            }
        }
    }
}

enum FocusFormat {
    static func clock(_ sec: Int) -> String {
        let s = max(0, sec)
        let h = s / 3600, m = (s % 3600) / 60, r = s % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, r) : String(format: "%d:%02d", m, r)
    }
}
