import Foundation
import Capacitor
import WidgetKit

/// Local Capacitor plugin: the web layer hands over the widget snapshot JSON (src/utils/widgetSnapshot.js);
/// it is stored in the shared App Group so the ClingNoteWidget extension can read it, then widget timelines reload.
@objc(ClingWidgetPlugin)
public class ClingWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ClingWidgetPlugin"
    public let jsName = "ClingWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ackPending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAuth", returnType: CAPPluginReturnPromise)
    ]

    static let appGroup = "group.app.clingnote.ios"
    static let key = "widget.today"
    static let pendingKey = "widget.pending"   // JSON [{taskId, day, ts}] appended by CompleteTaskIntent (iOS 17 widget)
    static let tokenKey = "widget.token"       // short-lived Firebase ID token for the widget-complete function
    static let endpointKey = "widget.endpoint"

    static func readPending(_ d: UserDefaults) -> [[String: Any]] {
        guard let s = d.string(forKey: pendingKey), let a = try? JSONSerialization.jsonObject(with: Data(s.utf8)) as? [[String: Any]] else { return [] }
        return a
    }
    static func entryKey(_ e: [String: Any]) -> String {
        let ts: String
        if let n = e["ts"] as? NSNumber { ts = n.stringValue } else { ts = "\(e["ts"] ?? "")" }
        return "\(e["taskId"] ?? "")@\(ts)"
    }

    @objc func setSnapshot(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), json.utf8.count < 64_000,
              (try? JSONSerialization.jsonObject(with: Data(json.utf8))) != nil else {
            call.reject("invalid snapshot"); return
        }
        // containerURL is nil when the signed app lacks the App Group entitlement (provisioning profile without the group);
        // UserDefaults(suiteName:) would then silently write to a private store the widget can never read.
        guard FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.appGroup) != nil else {
            NSLog("[ClingWidget] App Group %@ not in entitlements/profile; widget cannot read the snapshot", Self.appGroup)
            call.reject("app group container unavailable (entitlement missing)"); return
        }
        guard let defaults = UserDefaults(suiteName: Self.appGroup) else { call.reject("app group unavailable"); return }
        defaults.set(json, forKey: Self.key)
        NSLog("[ClingWidget] snapshot written (%d bytes), reloading timelines", json.utf8.count)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    @objc func getPending(_ call: CAPPluginCall) {
        guard let d = UserDefaults(suiteName: Self.appGroup) else { call.resolve(["items": []]); return }
        call.resolve(["items": Self.readPending(d)])
    }

    /// Removes exactly the drained entries (keys "taskId@ts"); taps queued meanwhile by the widget are kept.
    @objc func ackPending(_ call: CAPPluginCall) {
        let keys = Set((call.getArray("keys") as? [String]) ?? [])
        guard let d = UserDefaults(suiteName: Self.appGroup) else { call.resolve(); return }
        let rest = Self.readPending(d).filter { !keys.contains(Self.entryKey($0)) }
        if let data = try? JSONSerialization.data(withJSONObject: rest), let s = String(data: data, encoding: .utf8) { d.set(s, forKey: Self.pendingKey) }
        call.resolve()
    }

    @objc func setAuth(_ call: CAPPluginCall) {
        guard let d = UserDefaults(suiteName: Self.appGroup) else { call.resolve(); return }
        let token = call.getString("token") ?? "", endpoint = call.getString("endpoint") ?? ""
        if token.isEmpty || !endpoint.hasPrefix("https://") { d.removeObject(forKey: Self.tokenKey); d.removeObject(forKey: Self.endpointKey) }
        else { d.set(token, forKey: Self.tokenKey); d.set(endpoint, forKey: Self.endpointKey) }
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        let d = UserDefaults(suiteName: Self.appGroup)
        for k in [Self.key, Self.pendingKey, Self.tokenKey, Self.endpointKey] { d?.removeObject(forKey: k) }
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}

/// Bridge view controller that registers the app's local (non-npm) plugins.
class AppBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ClingWidgetPlugin())
        bridge?.registerPluginInstance(ClingVoicePlugin())
        bridge?.registerPluginInstance(ClingLockPlugin())
        bridge?.registerPluginInstance(ClingNativePlugin())
    }
}
