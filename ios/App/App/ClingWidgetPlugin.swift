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
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    static let appGroup = "group.app.clingnote.ios"
    static let key = "widget.today"

    @objc func setSnapshot(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), json.utf8.count < 64_000,
              (try? JSONSerialization.jsonObject(with: Data(json.utf8))) != nil else {
            call.reject("invalid snapshot"); return
        }
        guard let defaults = UserDefaults(suiteName: Self.appGroup) else { call.reject("app group unavailable"); return }
        defaults.set(json, forKey: Self.key)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        UserDefaults(suiteName: Self.appGroup)?.removeObject(forKey: Self.key)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}

/// Bridge view controller that registers the app's local (non-npm) plugins.
class AppBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ClingWidgetPlugin())
    }
}
