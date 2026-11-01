import Foundation
import AppTrackingTransparency
import TikTokBusinessSDK
import FirebaseCore
import FirebaseAnalytics

/// Ad-network install/open attribution. Scope: installs and app opens only (no purchase or in-app events).
/// ATT (build 44): the prompt is NEVER shown on cold launch. JS calls ClingNative.requestTracking() once, after onboarding,
/// on the first Home visit (src/utils/tracking.js). Until the user has answered (or if ATT is unavailable), nothing waits:
/// - Firebase Analytics starts at launch (first_open auto-logged once per install). FirebaseAnalyticsIdentitySupport is linked,
///   and Firebase itself reads the IDFA only while ATTrackingManager status == .authorized; otherwise IDFV only.
/// - TikTok App Events SDK starts at launch only when ATT is already decided (authorized/denied/restricted) so InstallApp carries
///   the right IDFA state; when notDetermined it starts right after the prompt resolves (or on the next launch at the latest).
///   The SDK reads the IDFA itself, only when status == .authorized (TikTokDeviceInfo); denied -> zeroed IDFA, SKAN + IDFV.
/// - Reddit first-open ping: DISABLED (Info.plist ClingRedditPingEnabled=false) until the reddit-install function is deployed,
///   so the one-time "sent" flag is never burned against a missing endpoint.
enum InstallAttribution {
    static let redditEndpoint = URL(string: "https://clingnote.netlify.app/.netlify/functions/reddit-install")!
    static let installIdKey = "cn.attribution.installId"
    static let redditSentKey = "cn.attribution.redditFirstOpenSent"
    static let attAskedKey = "cn.attribution.attAsked"
    private static var tiktokStarted = false

    /// ATT status as a string for JS/tests: authorized | denied | restricted | notDetermined | unavailable
    static func trackingStatus() -> String {
        if #available(iOS 14, *) {
            switch ATTrackingManager.trackingAuthorizationStatus {
            case .authorized: return "authorized"
            case .denied: return "denied"
            case .restricted: return "restricted"
            case .notDetermined: return "notDetermined"
            @unknown default: return "denied"
            }
        }
        return "unavailable"
    }

    static func start() {
        if FirebaseApp.app() == nil { FirebaseApp.configure() }
        Analytics.setAnalyticsCollectionEnabled(true)
        // Decided, or prompt already shown once but never answered (app killed mid-prompt): start now, no IDFA wait.
        if trackingStatus() != "notDetermined" || UserDefaults.standard.bool(forKey: attAskedKey) { startTikTok() }
        if redditPingEnabled() { sendRedditFirstOpenOnce() }
    }

    /// Shows the system ATT prompt at most once per install (iOS itself also never re-prompts). Always calls back on main.
    static func requestTracking(_ done: @escaping (String) -> Void) {
        let finish: () -> Void = {
            DispatchQueue.main.async { startTikTok(); done(trackingStatus()) }
        }
        guard #available(iOS 14, *), trackingStatus() == "notDetermined" else { finish(); return }
        UserDefaults.standard.set(true, forKey: attAskedKey)
        ATTrackingManager.requestTrackingAuthorization { _ in finish() }
    }

    static func redditPingEnabled() -> Bool {
        (Bundle.main.object(forInfoDictionaryKey: "ClingRedditPingEnabled") as? Bool) ?? false
    }

    private static func plistString(_ key: String) -> String {
        let v = (Bundle.main.object(forInfoDictionaryKey: key) as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return v.hasPrefix("$(") ? "" : v
    }

    static func startTikTok() {
        guard !tiktokStarted else { return }
        let appStoreId = plistString("TikTokAppStoreID")
        let tiktokAppId = plistString("TikTokAppID")
        let token = plistString("TikTokAccessToken")
        guard !appStoreId.isEmpty, !tiktokAppId.isEmpty, !token.isEmpty else {
            NSLog("ClingNote: TikTok SDK not configured, skipping")
            return
        }
        guard let config = TikTokConfig(accessToken: token, appId: appStoreId, tiktokAppId: tiktokAppId) else { return }
        tiktokStarted = true
        config.disablePaymentTracking()
        #if DEBUG
        config.enableDebugMode() // events show under Events Manager > Test Events
        #endif
        TikTokBusiness.initializeSdk(config) { success, error in
            if !success { NSLog("ClingNote: TikTok SDK init failed: \(error?.localizedDescription ?? "unknown")") }
        }
    }

    static func installId() -> String {
        let d = UserDefaults.standard
        if let id = d.string(forKey: installIdKey) { return id }
        let id = UUID().uuidString
        d.set(id, forKey: installIdKey)
        return id
    }

    static func sendRedditFirstOpenOnce() {
        guard redditPingEnabled() else { return }
        let d = UserDefaults.standard
        guard !d.bool(forKey: redditSentKey) else { return }
        var req = URLRequest(url: redditEndpoint, timeoutInterval: 15)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["installId": installId(), "platform": "ios", "eventAt": Int(Date().timeIntervalSince1970 * 1000)]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: req) { _, resp, _ in
            if let code = (resp as? HTTPURLResponse)?.statusCode, (200..<300).contains(code) { d.set(true, forKey: redditSentKey) }
        }.resume()
    }
}
