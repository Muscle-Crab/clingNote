// Live Activity model shared by the app (starts/updates/ends it) and ClingNoteWidget (renders it).
// New ContentState fields are optional so a state encoded by an older build still decodes.
import Foundation
#if canImport(ActivityKit)
import ActivityKit
@available(iOS 16.1, *)
struct FocusActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var endsAt: Date
        var paused: Bool
        /// Frozen remaining seconds while paused (the lock screen shows this instead of a running countdown).
        var remainingSec: Int? = nil
        /// Points earned today and today's target (e.g. 120/235); target 0 = no target yet.
        var ptsDone: Int? = nil
        var ptsTarget: Int? = nil
        /// End of the started 8-hour day; nil = no day running.
        var dayEndsAt: Date? = nil
        /// Auto-started focus session (src/utils/focusAutoStart.js): no Pause button, only Done.
        var locked: Bool? = nil
        /// Apps unlocked for this task (per-task app unlock, TaskAllow); nil/0 = none.
        var appsUnlocked: Int? = nil
    }
    var title: String
    /// widgetTaskId of the focused task (src/utils/widgetSnapshot.js), carried by the Pause/Resume/Done intents.
    var taskId: String? = nil
    /// Identifier of the app's "Timer finished" local notification (String(notifId(timerKey(task))), src/utils/localNotify.js),
    /// so Pause can withdraw it and Resume can move it to the new end time before the app reconciles.
    var notifId: String? = nil
}
#endif
