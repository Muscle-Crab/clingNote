// Live Activity model shared by the app (starts/ends it) and ClingNoteWidget (renders it).
import Foundation
#if canImport(ActivityKit)
import ActivityKit
@available(iOS 16.1, *)
struct FocusActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable { var endsAt: Date; var paused: Bool }
    var title: String
}
#endif
