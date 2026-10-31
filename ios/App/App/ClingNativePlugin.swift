import Foundation
import UIKit
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
        CAPPluginMethod(name: "updateFocusActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getFocusActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ackFocusActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getFocusFilter", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ackFocusFilter", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeIntents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeTimerIntents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "calSyncEnsure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "calSyncList", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "calSyncUpsert", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "calSyncRemove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPageZoom", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "trackingStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestTracking", returnType: CAPPluginReturnPromise),
    ]
    /// App Tracking Transparency (InstallAttribution). requestTracking prompts at most once; resolves {status}.
    @objc func trackingStatus(_ call: CAPPluginCall) { call.resolve(["status": InstallAttribution.trackingStatus()]) }
    @objc func requestTracking(_ call: CAPPluginCall) {
        DispatchQueue.main.async { InstallAttribution.requestTracking { call.resolve(["status": $0]) } }
    }
    /// Siri/Shortcuts tasks queued by AddTaskIntent; returned once and cleared.
    @objc func takeIntents(_ call: CAPPluginCall) {
        let d = UserDefaults(suiteName: "group.app.clingnote.ios")
        let q = (d?.array(forKey: "intent.pending") as? [[String: Any]]) ?? []
        d?.removeObject(forKey: "intent.pending"); call.resolve(["items": q])
    }
    /// Siri "Start timer" requests queued by StartTimerIntent ([{taskId, ts}]); returned once and cleared.
    @objc func takeTimerIntents(_ call: CAPPluginCall) {
        let d = UserDefaults(suiteName: "group.app.clingnote.ios")
        let q = (d?.array(forKey: "intent.timer") as? [[String: Any]]) ?? []
        d?.removeObject(forKey: "intent.timer"); call.resolve(["items": q])
    }
    /// Text size (Settings → Appearance): WKWebView.pageZoom reflows the page like Safari's aA menu (vh units stay correct,
    /// unlike CSS zoom). Clamped 0.9...1.35 so layouts hold.
    @objc func setPageZoom(_ call: CAPPluginCall) {
        let z = min(max(call.getDouble("zoom") ?? 1, 0.9), 1.35)
        DispatchQueue.main.async {
            if #available(iOS 14.0, *) { self.bridge?.webView?.pageZoom = CGFloat(z) }
            call.resolve(["zoom": z])
        }
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

    // MARK: two-way calendar sync (JS: src/composables/useCalendarSync.js, logic: src/utils/calendarSync.js)
    // One dedicated "ClingNote" calendar; the app only lists / edits events in it. Events carry url clingnote://task/<key>.
    private func syncCalendar(_ id: String?) -> EKCalendar? {
        if let id = id, !id.isEmpty, let c = store.calendar(withIdentifier: id) { return c }
        return store.calendars(for: .event).first { $0.title == "ClingNote" && $0.allowsContentModifications }
    }
    @objc func calSyncEnsure(_ call: CAPPluginCall) {
        if let c = syncCalendar(call.getString("calendarId")) { call.resolve(["calendarId": c.calendarIdentifier]); return }
        let c = EKCalendar(for: .event, eventStore: store); c.title = "ClingNote"
        c.cgColor = UIColor(red: 0.36, green: 0.55, blue: 1.0, alpha: 1).cgColor
        // iCloud if present, else the local source (Settings may hide "On My iPhone" when iCloud calendars are on)
        let sources = store.sources
        c.source = store.defaultCalendarForNewEvents?.source
            ?? sources.first { $0.sourceType == .calDAV && $0.title.lowercased().contains("icloud") }
            ?? sources.first { $0.sourceType == .local }
        guard c.source != nil else { call.reject("no calendar source"); return }
        do { try store.saveCalendar(c, commit: true); call.resolve(["calendarId": c.calendarIdentifier]) } catch { call.reject("\(error)") }
    }
    @objc func calSyncList(_ call: CAPPluginCall) {
        guard let c = syncCalendar(call.getString("calendarId")) else { call.reject("calendar missing"); return }
        let from = Date(timeIntervalSince1970: (call.getDouble("fromMs") ?? 0) / 1000)
        let to = Date(timeIntervalSince1970: (call.getDouble("toMs") ?? 0) / 1000)
        let evs = store.events(matching: store.predicateForEvents(withStart: from, end: to, calendars: [c]))
            .filter { !$0.isAllDay }
            .map { e -> [String: Any] in [
                "id": e.calendarItemIdentifier, "title": e.title ?? "", "notes": e.notes ?? "", "url": e.url?.absoluteString ?? "",
                "startMs": e.startDate.timeIntervalSince1970 * 1000, "endMs": e.endDate.timeIntervalSince1970 * 1000,
            ] }
        call.resolve(["events": evs])
    }
    @objc func calSyncUpsert(_ call: CAPPluginCall) {
        guard let c = syncCalendar(call.getString("calendarId")), let title = call.getString("title"),
              let s = call.getDouble("startMs"), let e = call.getDouble("endMs") else { call.reject("calendar/title/startMs/endMs"); return }
        let id = call.getString("id") ?? ""
        let ev = (id.isEmpty ? nil : store.calendarItem(withIdentifier: id) as? EKEvent) ?? EKEvent(eventStore: store)
        ev.calendar = c; ev.title = title
        ev.startDate = Date(timeIntervalSince1970: s / 1000); ev.endDate = Date(timeIntervalSince1970: e / 1000)
        if let n = call.getString("notes"), !n.isEmpty { ev.notes = n }
        if let u = call.getString("url"), let url = URL(string: u) { ev.url = url }
        do { try store.save(ev, span: .thisEvent, commit: true); call.resolve(["id": ev.calendarItemIdentifier]) } catch { call.reject("\(error)") }
    }
    @objc func calSyncRemove(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("id"); return }
        guard let ev = store.calendarItem(withIdentifier: id) as? EKEvent else { call.resolve(); return } // already gone
        do { try store.remove(ev, span: .thisEvent, commit: true); call.resolve() } catch { call.reject("\(error)") }
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
    #if canImport(ActivityKit)
    /// ContentState from the JS payload (src/utils/focusActions.js focusActivityState).
    @available(iOS 16.1, *)
    private func focusState(_ call: CAPPluginCall) -> FocusActivityAttributes.ContentState {
        let ends = Date(timeIntervalSince1970: (call.getDouble("endsAtMs") ?? 0) / 1000)
        let paused = call.getBool("paused") ?? false
        let dayEndMs = call.getDouble("dayEndsAtMs") ?? 0
        return FocusActivityAttributes.ContentState(
            endsAt: ends, paused: paused,
            remainingSec: paused ? max(0, call.getInt("remainingSec") ?? 0) : nil,
            ptsDone: call.getInt("ptsDone"), ptsTarget: call.getInt("ptsTarget"),
            dayEndsAt: dayEndMs > 0 ? Date(timeIntervalSince1970: dayEndMs / 1000) : nil,
            locked: (call.getBool("locked") ?? false) ? true : nil,
            appsUnlocked: (call.getInt("appsUnlocked") ?? 0) > 0 ? call.getInt("appsUnlocked") : nil,
            phase: (call.getString("phase") ?? "").isEmpty ? nil : call.getString("phase"))
    }
    #endif
    @objc func startFocusActivity(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *), ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(["started": false]); return }
        let state = focusState(call)
        let taskId = call.getString("taskId") ?? ""
        let notifId = call.getString("notifId") ?? ""
        Task {
            for a in Activity<FocusActivityAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
            do {
                let attrs = FocusActivityAttributes(title: call.getString("title") ?? "Focus",
                                                    taskId: taskId.isEmpty ? nil : taskId, notifId: notifId.isEmpty ? nil : notifId)
                _ = try Activity.request(attributes: attrs, content: .init(state: state, staleDate: state.paused ? nil : state.endsAt))
                call.resolve(["started": true])
            } catch { call.resolve(["started": false, "error": "\(error)"]) }
        }
        #else
        call.resolve(["started": false])
        #endif
    }
    /// Points / paused / day-left changes for the running activity (no new request, so it also works from the background).
    @objc func updateFocusActivity(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { call.resolve(["updated": 0]); return }
        let state = focusState(call)
        let taskId = call.getString("taskId") ?? ""
        Task {
            var n = 0
            for a in Activity<FocusActivityAttributes>.activities where taskId.isEmpty || (a.attributes.taskId ?? "") == taskId {
                await a.update(ActivityContent(state: state, staleDate: state.paused ? nil : state.endsAt)); n += 1
            }
            call.resolve(["updated": n])
        }
        #else
        call.resolve(["updated": 0])
        #endif
    }
    /// Lock-screen Pause/Resume/Done taps queued by FocusIntents.swift ([{id, kind, taskId, ts}]); removed only via ackFocusActions.
    @objc func getFocusActions(_ call: CAPPluginCall) {
        guard let d = UserDefaults(suiteName: FocusActionStore.appGroup) else { call.resolve(["items": []]); return }
        call.resolve(["items": FocusActionStore.read(d)])
    }
    @objc func ackFocusActions(_ call: CAPPluginCall) {
        let ids = Set((call.getArray("ids") as? [String]) ?? [])
        FocusActionStore.ack(ids: ids)
        call.resolve()
    }
    /// iOS Focus filter on/off events queued by ClingFocusFilter ([{id, kind, minutes?, ts}]); removed only via ackFocusFilter.
    @objc func getFocusFilter(_ call: CAPPluginCall) {
        guard let d = UserDefaults(suiteName: FocusFilterStore.appGroup) else { call.resolve(["items": []]); return }
        call.resolve(["items": FocusFilterStore.read(d)])
    }
    @objc func ackFocusFilter(_ call: CAPPluginCall) {
        FocusFilterStore.ack(ids: Set((call.getArray("ids") as? [String]) ?? []))
        call.resolve()
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
