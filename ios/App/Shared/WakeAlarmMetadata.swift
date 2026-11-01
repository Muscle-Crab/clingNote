// Shared by the App (schedules the alarm) and the widget extension (renders the AlarmKit Live Activity while snoozing).
// AlarmKit exists only in the iOS 26 SDK; older SDKs compile this file to nothing.
import Foundation
#if canImport(AlarmKit)
import AlarmKit

@available(iOS 26.0, *)
public struct ClingWakeMetadata: AlarmMetadata {
    public var label: String
    public init(label: String = "Wake-up alarm") { self.label = label }
}
#endif
