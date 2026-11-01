import WidgetKit
import SwiftUI
import AppIntents

/// iOS 18 control (Control Center, lock screen, Action Button): "Start focus" on the next open task.
/// Runs StartFocusIntent (Shared/FocusIntents.swift, also in the App target), which opens the app to start the timer and Live Activity.
@available(iOS 18.0, *)
struct StartFocusControl: ControlWidget {
    static let kind: String = "app.clingnote.ios.start-focus"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: StartFocusIntent()) {
                Label("Start focus", systemImage: "timer")
            }
        }
        .displayName("Start focus")
        .description("Start a focus timer on your next ClingNote task.")
    }
}
