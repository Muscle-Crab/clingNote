// Lock Screen / Dynamic Island UI for the AlarmKit wake-up alarm while it is snoozing (countdown).
// AlarmKit requires a widget extension with an ActivityConfiguration for AlarmAttributes when the alarm has a countdown (snooze).
import WidgetKit
import SwiftUI
#if canImport(AlarmKit)
import AlarmKit
import ActivityKit

@available(iOS 26.0, *)
struct WakeAlarmLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<ClingWakeMetadata>.self) { context in
            HStack(spacing: 12) {
                Image(systemName: "alarm.fill").font(.title2).foregroundStyle(context.attributes.tintColor)
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.attributes.metadata?.label ?? "Wake-up alarm").font(.headline)
                    Text("ClingNote").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                WakeAlarmTimeText(mode: context.state.mode).font(.title2.monospacedDigit())
            }
            .padding()
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Image(systemName: "alarm.fill").foregroundStyle(context.attributes.tintColor) }
                DynamicIslandExpandedRegion(.trailing) { WakeAlarmTimeText(mode: context.state.mode).monospacedDigit() }
                DynamicIslandExpandedRegion(.bottom) { Text(context.attributes.metadata?.label ?? "Wake-up alarm") }
            } compactLeading: {
                Image(systemName: "alarm.fill")
            } compactTrailing: {
                WakeAlarmTimeText(mode: context.state.mode).monospacedDigit()
            } minimal: {
                Image(systemName: "alarm.fill")
            }
        }
    }
}

@available(iOS 26.0, *)
struct WakeAlarmTimeText: View {
    let mode: AlarmPresentationState.Mode
    var body: some View {
        switch mode {
        case .countdown(let c):
            Text(timerInterval: Date()...max(Date(), c.fireDate), countsDown: true)
        default:
            Text("Alarm")
        }
    }
}
#else
@available(iOS 26.0, *)
struct WakeAlarmLiveActivity: Widget {
    var body: some WidgetConfiguration { EmptyWidgetConfiguration() }
}
#endif
