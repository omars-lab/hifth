import Foundation
import WebKit

/// What the page may ask the shell for. The web side is `native-bridge.ts`;
/// the two files are one contract, and a message added to one is added to
/// the other in the same change.
enum BridgeMessage: Equatable {
    /// The app's resolver exists: a route set now will turn to the verse.
    case ready
    /// The hash the app is showing, every time it changes.
    case route(String)
    /// The reader tapped share: show the platform's sheet for this link.
    case share(url: String, title: String, text: String)

    init?(body: Any) {
        guard let dict = body as? [String: Any], let type = dict["type"] as? String else { return nil }
        switch type {
        case "ready":
            self = .ready
        case "route":
            guard let hash = dict["hash"] as? String else { return nil }
            self = .route(hash)
        case "share":
            guard let url = dict["url"] as? String else { return nil }
            self = .share(
                url: url,
                title: dict["title"] as? String ?? "",
                text: dict["text"] as? String ?? ""
            )
        default:
            return nil
        }
    }
}

/// The page's one message handler, and the script that tells the page it is
/// inside the shell before any of its own code runs.
final class Bridge: NSObject, WKScriptMessageHandler {
    static let handlerName = "hifth"

    var onMessage: (BridgeMessage) -> Void = { _ in }

    /// Runs at document start, main frame only, so `isNative()` is already
    /// true when the app's first module evaluates.
    /// `appVersion` goes only into the reader's own problem report, which they
    /// see in full before choosing to send it; empty leaves it out.
    /// `deviceReports` is the same: Apple's crash and freeze reports the device
    /// keeps (DeviceReports.summary), shown only in that report.
    static func bootScript(platform: String, publicBase: String, appVersion: String = "", deviceReports: String = "") -> WKUserScript {
        var payload: [String: String] = ["platform": platform, "publicBase": publicBase]
        if !appVersion.isEmpty { payload["appVersion"] = appVersion }
        if !deviceReports.isEmpty { payload["deviceReports"] = deviceReports }
        let json = (try? JSONSerialization.data(withJSONObject: payload)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        return WKUserScript(
            source: "window.__HIFTH_NATIVE__ = Object.freeze(\(json));",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
    }

    /// The version as a reader would quote it: `0.1.0 (7)`, the version and the
    /// build number Apple counts, from the app's Info.plist.
    /// Pure, so the app's log can use it from any thread.
    nonisolated static func versionLine(info: [String: Any]) -> String {
        let version = info["CFBundleShortVersionString"] as? String ?? ""
        let build = info["CFBundleVersion"] as? String ?? ""
        if version.isEmpty { return "" }
        return build.isEmpty ? version : "\(version) (\(build))"
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Self.handlerName, let parsed = BridgeMessage(body: message.body) else { return }
        onMessage(parsed)
    }
}
