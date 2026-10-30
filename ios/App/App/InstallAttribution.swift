import Foundation
import TikTokBusinessSDK
import FirebaseCore
import FirebaseAnalytics

/// Ad-network install/open attribution. Scope: installs and app opens only (no purchase or in-app events).
/// - TikTok: TikTok App Events SDK. It auto-logs InstallApp (first launch), LaunchAPP (every launch) and 2Dretention,
///   so no explicit event is sent here. IDFA stays off by default: we never call the ATT prompt, so the SDK only sees the zeroed
///   IDFA and attribution relies on SKAdNetwork + TikTok's non-IDFA matching.
/// - Google Ads / YouTube: Firebase Analytics logs `first_open` automatically once FirebaseApp is configured (no explicit event).
///   On-device conversion measurement (GoogleAdsOnDeviceConversion) comes in transitively with FirebaseAnalytics; no IDFA needed.
/// - Reddit: one first-open ping to our Netlify function (`reddit-install`), which holds the Conversions API token server-side.
enum InstallAttribution {
    static let redditEndpoint = URL(string: "https://clingnote.netlify.app/.netlify/functions/reddit-install")!
    static let installIdKey = "cn.attribution.installId"
    static let redditSentKey = "cn.attribution.redditFirstOpenSent"

    static func start() {
        // Configure Firebase at launch (the auth plugin also does this lazily, guarded the same way) so first_open/session_start are logged.
        if FirebaseApp.app() == nil { FirebaseApp.configure() }
        Analytics.setAnalyticsCollectionEnabled(true)
        startTikTok()
        sendRedditFirstOpenOnce()
    }

    private static func plistString(_ key: String) -> String {
        let v = (Bundle.main.object(forInfoDictionaryKey: key) as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        // An unexpanded "$(VAR)" means the build setting was never defined; treat it as empty.
        return v.hasPrefix("$(") ? "" : v
    }

    static func startTikTok() {
        let appStoreId = plistString("TikTokAppStoreID")
        let tiktokAppId = plistString("TikTokAppID")
        let token = plistString("TikTokAccessToken")
        guard !appStoreId.isEmpty, !tiktokAppId.isEmpty, !token.isEmpty else {
            NSLog("ClingNote: TikTok SDK not configured, skipping")
            return
        }
        guard let config = TikTokConfig(accessToken: token, appId: appStoreId, tiktokAppId: tiktokAppId) else { return }
        // Payment auto-tracking is out of scope (installs/opens only).
        config.disablePaymentTracking()
        TikTokBusiness.initializeSdk(config) { success, error in
            if !success { NSLog("ClingNote: TikTok SDK init failed: \(error?.localizedDescription ?? "unknown")") }
        }
    }

    /// Random per-install id (not the IDFA/IDFV); lets the server dedupe retries.
    static func installId() -> String {
        let d = UserDefaults.standard
        if let id = d.string(forKey: installIdKey) { return id }
        let id = UUID().uuidString
        d.set(id, forKey: installIdKey)
        return id
    }

    static func sendRedditFirstOpenOnce() {
        let d = UserDefaults.standard
        guard !d.bool(forKey: redditSentKey) else { return }
        var req = URLRequest(url: redditEndpoint, timeoutInterval: 15)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["installId": installId(), "platform": "ios", "eventAt": Int(Date().timeIntervalSince1970 * 1000)]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: req) { _, resp, _ in
            // Mark sent on any 2xx (including the server's "not configured" no-op) so it really is once per install; retry next launch otherwise.
            if let code = (resp as? HTTPURLResponse)?.statusCode, (200..<300).contains(code) { d.set(true, forKey: redditSentKey) }
        }.resume()
    }
}
