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
    static func bootScript(platform: String, publicBase: String) -> WKUserScript {
        let payload: [String: String] = ["platform": platform, "publicBase": publicBase]
        let json = (try? JSONSerialization.data(withJSONObject: payload)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        return WKUserScript(
            source: "window.__HIFTH_NATIVE__ = Object.freeze(\(json));",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Self.handlerName, let parsed = BridgeMessage(body: message.body) else { return }
        onMessage(parsed)
    }
}
