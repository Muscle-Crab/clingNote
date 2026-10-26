import Foundation
import Capacitor
import EventKit
import CoreLocation
import UserNotifications
#if canImport(ActivityKit)
import ActivityKit
#endif

/// ClingNative: device calendar (EventKit free/busy + optional event writes), geofence reminders (CoreLocation
/// region monitoring -> local notification), focus Live Activity. JS: src/native/clingNative.js. NEEDS ON-DEVICE TESTING.
@objc(ClingNativePlugin)
public class ClingNativePlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "ClingNativePlugin"
    public let jsName = "ClingNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "calendarAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "busy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentLocation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addGeofence", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeGeofence", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startFocusActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endFocusActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeIntents", returnType: CAPPluginReturnPromise),
    ]
    /// Siri/Shortcuts tasks queued by AddTaskIntent; returned once and cleared.
    @objc func takeIntents(_ call: CAPPluginCall) {
        let d = UserDefaults(suiteName: "group.app.clingnote.ios")
        let q = (d?.array(forKey: "intent.pending") as? [[String: Any]]) ?? []
        d?.removeObject(forKey: "intent.pending"); call.resolve(["items": q])
    }
    private let store = EKEventStore()
    private lazy var loc: CLLocationManager = { let m = CLLocationManager(); m.delegate = self; return m }()
    private var pendingLoc: [CAPPluginCall] = []

    // MARK: calendar
    @objc func calendarAccess(_ call: CAPPluginCall) {
        let done: (Bool, Error?) -> Void = { ok, _ in call.resolve(["granted": ok]) }
        // free/busy needs full access (write-only cannot read); asked only when the user turns calendar sync on
        if #available(iOS 17.0, *) { store.requestFullAccessToEvents(completion: done) } else { store.requestAccess(to: .event, completion: done) }
    }
    @objc func busy(_ call: CAPPluginCall) {
        let from = Date(timeIntervalSince1970: (call.getDouble("fromMs") ?? Date().timeIntervalSince1970 * 1000) / 1000)
        let to = Date(timeIntervalSince1970: (call.getDouble("toMs") ?? from.timeIntervalSince1970 * 1000 + 86_400_000) / 1000)
        let events = store.events(matching: store.predicateForEvents(withStart: from, end: to, calendars: nil))
            .filter { !$0.isAllDay && $0.availability != .free }
            .map { ["startMs": $0.startDate.timeIntervalSince1970 * 1000, "endMs": $0.endDate.timeIntervalSince1970 * 1000] } // no titles leave the device
        call.resolve(["busy": events])
    }
    @objc func addEvent(_ call: CAPPluginCall) {
        guard let title = call.getString("title"), let s = call.getDouble("startMs"), let e = call.getDouble("endMs") else { call.reject("title/startMs/endMs"); return }
        let ev = EKEvent(eventStore: store); ev.title = title
        ev.startDate = Date(timeIntervalSince1970: s / 1000); ev.endDate = Date(timeIntervalSince1970: e / 1000)
        ev.calendar = store.defaultCalendarForNewEvents
        do { try store.save(ev, span: .thisEvent); call.resolve(["id": ev.eventIdentifier ?? ""]) } catch { call.reject("\(error)") }
    }

    // MARK: location
    @objc func currentLocation(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.pendingLoc.append(call)
            if self.loc.authorizationStatus == .notDetermined { self.loc.requestAlwaysAuthorization() }
            self.loc.requestLocation()
        }
    }
    public func locationManager(_ m: CLLocationManager, didUpdateLocations l: [CLLocation]) {
        guard let c = l.last?.coordinate else { return }
        pendingLoc.forEach { $0.resolve(["lat": c.latitude, "lng": c.longitude]) }; pendingLoc.removeAll()
    }
    public func locationManager(_ m: CLLocationManager, didFailWithError e: Error) { pendingLoc.forEach { $0.reject("location: \(e)") }; pendingLoc.removeAll() }
    @objc func addGeofence(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let lat = call.getDouble("lat"), let lng = call.getDouble("lng") else { call.reject("id/lat/lng"); return }
        let r = CLCircularRegion(center: CLLocationCoordinate2D(latitude: lat, longitude: lng), radius: min(max(call.getDouble("radius") ?? 150, 100), 1000), identifier: "cn.geo.\(id)")
        r.notifyOnEntry = true; r.notifyOnExit = false
        // A location-trigger notification fires even when the app is closed (needs "when in use"+ location permission).
        let content = UNMutableNotificationContent(); content.title = "ClingNote"; content.body = call.getString("body") ?? "You're here: time for your task."; content.sound = .default
        content.userInfo = ["route": "/home", "type": "geo"]
        let req = UNNotificationRequest(identifier: r.identifier, content: content, trigger: UNLocationNotificationTrigger(region: r, repeats: call.getBool("repeats") ?? false))
        DispatchQueue.main.async { if self.loc.authorizationStatus == .notDetermined { self.loc.requestWhenInUseAuthorization() } }
        UNUserNotificationCenter.current().add(req) { err in if let err = err { call.reject("\(err)") } else { call.resolve(["id": r.identifier]) } }
    }
    @objc func removeGeofence(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("id"); return }
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["cn.geo.\(id)"]); call.resolve()
    }

    // MARK: Live Activity
    @objc func startFocusActivity(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *), ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(["started": false]); return }
        let ends = Date(timeIntervalSince1970: (call.getDouble("endsAtMs") ?? 0) / 1000)
        Task {
            for a in Activity<FocusActivityAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
            do {
                _ = try Activity.request(attributes: FocusActivityAttributes(title: call.getString("title") ?? "Focus"),
                                         content: .init(state: .init(endsAt: ends, paused: false), staleDate: ends))
                call.resolve(["started": true])
            } catch { call.resolve(["started": false, "error": "\(error)"]) }
        }
        #else
        call.resolve(["started": false])
        #endif
    }
    @objc func endFocusActivity(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task { for a in Activity<FocusActivityAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }; call.resolve() }
        #else
        call.resolve()
        #endif
    }
}
