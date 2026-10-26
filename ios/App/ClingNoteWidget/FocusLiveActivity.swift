import WidgetKit
import SwiftUI
import ActivityKit

/// Lock screen / Dynamic Island focus timer. NEEDS ON-DEVICE TESTING.
@available(iOS 16.1, *)
struct FocusLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FocusActivityAttributes.self) { ctx in
            HStack {
                VStack(alignment: .leading) {
                    Text("Focus").font(.caption).foregroundColor(.secondary)
                    Text(ctx.attributes.title).font(.headline).lineLimit(1)
                }
                Spacer()
                Text(timerInterval: Date()...max(Date(), ctx.state.endsAt), countsDown: true).font(.title2.monospacedDigit()).frame(width: 90)
            }.padding().widgetURL(URL(string: "clingnote://home"))
        } dynamicIsland: { ctx in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Text(ctx.attributes.title).lineLimit(1) }
                DynamicIslandExpandedRegion(.trailing) { Text(timerInterval: Date()...max(Date(), ctx.state.endsAt), countsDown: true).monospacedDigit() }
            } compactLeading: { Text("⏱") } compactTrailing: {
                Text(timerInterval: Date()...max(Date(), ctx.state.endsAt), countsDown: true).monospacedDigit().frame(width: 44)
            } minimal: { Text("⏱") }
        }
    }
}
