// ClingAlarm: ONE-TIME wake-up alarms.
// iOS 26+: AlarmKit (system alarm UI, rings through silent mode + Focus, Stop / Snooze buttons, shows on the Watch).
// iOS < 26 / AlarmKit denied: the JS side falls back to a burst of time-sensitive local notifications (cannot beat the silent switch).
// The whole AlarmKit path is gated by `#if canImport(AlarmKit)` (iOS 26 SDK) + `#available(iOS 26.0, *)` (deployment target is 16).
import Foundation
import Capacitor
import SwiftUI
#if canImport(AlarmKit)
import AlarmKit
import ActivityKit
#endif

@objc(ClingAlarmPlugin)
public class ClingAlarmPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ClingAlarmPlugin"
    public let jsName = "ClingAlarm"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleOnce", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "snooze", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "list", returnType: CAPPluginReturnPromise),
    ]

    @objc func availability(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            call.resolve(["alarmKit": true, "authorization": Self.authString(AlarmManager.shared.authorizationState)])
            return
        }
        #endif
        call.resolve(["alarmKit": false, "authorization": "unsupported"])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            Task {
                do {
                    let state = try await AlarmManager.shared.requestAuthorization()
                    call.resolve(["alarmKit": true, "authorization": Self.authString(state)])
                } catch {
                    call.resolve(["alarmKit": true, "authorization": Self.authString(AlarmManager.shared.authorizationState), "error": error.localizedDescription])
                }
            }
            return
        }
        #endif
        call.resolve(["alarmKit": false, "authorization": "unsupported"])
    }

    /// { atMs, id?, title?, snoozeMinutes?, sound? } -> { scheduled, id?, reason? }
    @objc func scheduleOnce(_ call: CAPPluginCall) {
        let atMs = call.getDouble("atMs") ?? 0
        let date = Date(timeIntervalSince1970: atMs / 1000)
        guard date.timeIntervalSinceNow > 5 else { call.resolve(["scheduled": false, "reason": "past"]); return }
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let title = call.getString("title") ?? "Wake up"
            let snoozeMin = max(1, min(30, call.getInt("snoozeMinutes") ?? 9))
            let sound = call.getString("sound") ?? ""
            let uuid = call.getString("id").flatMap { UUID(uuidString: $0) } ?? UUID()
            Task {
                do {
                    var state = AlarmManager.shared.authorizationState
                    if state == .notDetermined { state = try await AlarmManager.shared.requestAuthorization() }
                    guard state == .authorized else { call.resolve(["scheduled": false, "reason": "denied"]); return }
                    let config = Self.makeConfiguration(at: date, title: title, snoozeSeconds: TimeInterval(snoozeMin * 60), sound: sound)
                    _ = try await AlarmManager.shared.schedule(id: uuid, configuration: config)
                    call.resolve(["scheduled": true, "id": uuid.uuidString, "kind": "alarmkit"])
                } catch {
                    call.resolve(["scheduled": false, "reason": "error", "error": error.localizedDescription])
                }
            }
            return
        }
        #endif
        call.resolve(["scheduled": false, "reason": "unsupported"])
    }

    @objc func cancel(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *), let s = call.getString("id"), let id = UUID(uuidString: s) {
            try? AlarmManager.shared.cancel(id: id)
        }
        #endif
        call.resolve()
    }

    @objc func cancelAll(_ call: CAPPluginCall) {
        var n = 0
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let all: [Alarm] = (try? AlarmManager.shared.alarms) ?? []
            for a in all { try? AlarmManager.shared.cancel(id: a.id); n += 1 }
        }
        #endif
        call.resolve(["cancelled": n])
    }

    @objc func stop(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *), let s = call.getString("id"), let id = UUID(uuidString: s) {
            try? AlarmManager.shared.stop(id: id)
        }
        #endif
        call.resolve()
    }

    /// Snooze an alerting alarm (= AlarmKit "countdown" for the configured post-alert duration).
    @objc func snooze(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *), let s = call.getString("id"), let id = UUID(uuidString: s) {
            try? AlarmManager.shared.countdown(id: id)
        }
        #endif
        call.resolve()
    }

    @objc func list(_ call: CAPPluginCall) {
        var out: [[String: Any]] = []
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let all: [Alarm] = (try? AlarmManager.shared.alarms) ?? []
            for a in all { out.append(["id": a.id.uuidString, "state": Self.stateString(a.state)]) }
        }
        #endif
        call.resolve(["alarms": out])
    }

    #if canImport(AlarmKit)
    @available(iOS 26.0, *)
    static func makeConfiguration(at date: Date, title: String, snoozeSeconds: TimeInterval, sound: String) -> AlarmManager.AlarmConfiguration<ClingWakeMetadata> {
        let titleRes = LocalizedStringResource(stringLiteral: title)
        let snoozeButton = AlarmButton(text: "Snooze", textColor: .white, systemImageName: "zzz")
        let alert: AlarmPresentation.Alert
        if #available(iOS 26.1, *) {
            alert = AlarmPresentation.Alert(title: titleRes, secondaryButton: snoozeButton, secondaryButtonBehavior: .countdown)
        } else {
            let stopButton = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.circle")
            alert = AlarmPresentation.Alert(title: titleRes, stopButton: stopButton, secondaryButton: snoozeButton, secondaryButtonBehavior: .countdown)
        }
        let countdown = AlarmPresentation.Countdown(title: "Snoozing", pauseButton: nil)
        let presentation = AlarmPresentation(alert: alert, countdown: countdown, paused: nil)
        let attributes = AlarmAttributes<ClingWakeMetadata>(presentation: presentation, metadata: ClingWakeMetadata(label: title), tintColor: Color(red: 0.36, green: 0.55, blue: 1.0))
        let alertSound: AlertConfiguration.AlertSound = sound.isEmpty ? .default : .named(sound)
        return AlarmManager.AlarmConfiguration<ClingWakeMetadata>(
            countdownDuration: Alarm.CountdownDuration(preAlert: nil, postAlert: snoozeSeconds),
            schedule: .fixed(date),
            attributes: attributes,
            sound: alertSound
        )
    }

    @available(iOS 26.0, *)
    static func authString(_ s: AlarmManager.AuthorizationState) -> String {
        switch s {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    @available(iOS 26.0, *)
    static func stateString(_ s: Alarm.State) -> String {
        switch s {
        case .scheduled: return "scheduled"
        case .countdown: return "countdown"
        case .paused: return "paused"
        case .alerting: return "alerting"
        @unknown default: return "unknown"
        }
    }
    #endif
}
