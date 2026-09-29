import Foundation
import Observation
import WebKit
#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Everything the shell knows about the page it hosts: the one web view, the
/// route it is showing, whether it can take a new one yet, and the queue for
/// one that arrived early. Both platforms' views are thin wrappers around this.
@Observable
final class ShellModel {
    /// The public site, for links the reader shares out of the shell.
    static let publicBase = "https://blog.bytesofpurpose.com/hifth/"
    static let subsystem = "com.bytesofpurpose.hifth"

    /// The hash the page is showing, mirrored for the window title, the
    /// accessibility label the native tests read, and screenshots.
    private(set) var currentHash = ""
    private(set) var ready = false
    /// Set when the web build is missing from the bundle (`make app-web`).
    private(set) var missingBundle = false

    let webView: WKWebView
    private let bridge = Bridge()
    private let navigation = NavigationPolicy()
    private var pendingHash: String?
    private var snapshotTaken = false

    var title: String {
        currentHash.isEmpty ? "Hifth" : "Hifth — \(currentHash.dropFirst())"
    }

    init(launchRoute: String? = Route.fromEnvironment() ?? Route.fromArguments()) {
        #if os(iOS)
        let platform = "ios"
        #else
        let platform = "macos"
        #endif

        let configuration = WKWebViewConfiguration()
        let root = BundleFiles.root
        if let root {
            configuration.setURLSchemeHandler(LocalSchemeHandler(root: root), forURLScheme: BundleFiles.scheme)
        }
        configuration.userContentController.add(bridge, name: Bridge.handlerName)
        configuration.userContentController.addUserScript(
            Bridge.bootScript(platform: platform, publicBase: Self.publicBase)
        )
        #if os(iOS)
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.ignoresViewportScaleLimits = false
        #endif

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isInspectable = true
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.navigationDelegate = navigation
        webView.uiDelegate = navigation
        #if os(macOS)
        // Off on purpose: with it on WebKit eats the trackpad pinch as a page
        // zoom. Off, it forwards the pinch as gesture events the web app's own
        // stage already binds.
        webView.allowsMagnification = false
        #else
        webView.scrollView.bounces = false
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        #endif

        bridge.onMessage = { [weak self] message in self?.receive(message) }
        navigation.onLoaded = { [weak self] in self?.loaded() }

        applyAppearanceOverride()

        guard root != nil else {
            missingBundle = true
            webView.loadHTMLString(Self.missingBundlePage, baseURL: nil)
            return
        }
        // A launch route rides in the first URL: no timing, no race, the page
        // simply opens there.
        var start = BundleFiles.indexURL.absoluteString
        if let launchRoute { start += launchRoute }
        webView.load(URLRequest(url: URL(string: start) ?? BundleFiles.indexURL))
    }

    // MARK: - Routes in

    /// A `hifth://` link, from the system while running or at launch.
    func open(_ url: URL) {
        guard let hash = Route.parse(url) else { return }
        show(hash)
    }

    /// Turn the page to `hash` now if the app is ready, else as soon as it is.
    func show(_ hash: String) {
        guard ready else {
            pendingHash = hash
            return
        }
        pendingHash = nil
        webView.callAsyncJavaScript(
            "location.hash = route;",
            arguments: ["route": hash],
            in: nil,
            in: .page
        ) { _ in }
    }

    // MARK: - Messages from the page

    private func receive(_ message: BridgeMessage) {
        switch message {
        case .ready:
            ready = true
            if let pendingHash { show(pendingHash) }
            probeIfAsked()
            scheduleSnapshotIfAsked()
        case .route(let hash):
            currentHash = hash
        case .share(let url, let title, let text):
            Sharing.present(url: url, title: title, text: text, from: webView)
        }
    }

    private func loaded() {
        #if os(iOS)
        // The viewport meta already forbids zoom in this build; this is the belt
        // to that brace, for the double-tap and the pinch WebKit would otherwise
        // still answer with a page zoom.
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        #endif
    }

    // MARK: - Probe (make app-probe)

    /// With `HIFTH_PROBE=1`, ask the page what it can see of its own world
    /// (secure context, caches, share, storage, the marker) and print it as
    /// one JSON line, then quit. The day-one questions from the design review.
    private func probeIfAsked() {
        guard ProcessInfo.processInfo.environment["HIFTH_PROBE"] == "1" else { return }
        webView.callAsyncJavaScript(Self.probeScript, arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success(let value):
                print("probe \(value)")
                exit(0)
            case .failure(let error):
                print("probe failed \(error)")
                exit(1)
            }
        }
    }

    private static let probeScript = """
    const out = {
      href: location.href,
      origin: location.origin,
      isSecureContext,
      caches: typeof caches,
      serviceWorker: "serviceWorker" in navigator,
      share: typeof navigator.share,
      clipboard: typeof navigator.clipboard,
      storageManager: typeof navigator.storage,
      indexedDB: typeof indexedDB,
      localStorage: (() => { try { localStorage.setItem("__p", "1"); localStorage.removeItem("__p"); return "ok"; } catch (e) { return String(e); } })(),
      native: window.__HIFTH_NATIVE__ ?? null,
      viewport: [innerWidth, innerHeight, devicePixelRatio],
      touch: navigator.maxTouchPoints,
      ua: navigator.userAgent,
    };
    return JSON.stringify(out);
    """

    // MARK: - Screenshots (make app-shot)

    /// With `HIFTH_SNAPSHOT_PATH` set, the app photographs its own page once it
    /// is ready and settled, writes the PNG there, and quits. Headless, no
    /// Screen Recording permission, identical on both platforms.
    private func scheduleSnapshotIfAsked() {
        let environment = ProcessInfo.processInfo.environment
        guard !snapshotTaken, let path = environment["HIFTH_SNAPSHOT_PATH"], !path.isEmpty else { return }
        snapshotTaken = true
        let delayMs = Int(environment["HIFTH_SNAPSHOT_DELAY_MS"] ?? "") ?? 1500
        Task {
            try? await Task.sleep(for: .milliseconds(delayMs))
            let png = await Self.snapshotPNG(of: webView)
            do {
                try png.write(to: URL(fileURLWithPath: path))
                print("snapshot written \(path)")
                exit(0)
            } catch {
                print("snapshot failed \(error)")
                exit(1)
            }
        }
    }

    private static func snapshotPNG(of webView: WKWebView) async -> Data {
        await withCheckedContinuation { continuation in
            webView.takeSnapshot(with: nil) { image, _ in
                #if os(iOS)
                continuation.resume(returning: image?.pngData() ?? Data())
                #else
                let png = image
                    .flatMap { $0.tiffRepresentation }
                    .flatMap { NSBitmapImageRep(data: $0) }
                    .flatMap { $0.representation(using: .png, properties: [:]) }
                continuation.resume(returning: png ?? Data())
                #endif
            }
        }
    }

    // MARK: - Appearance (HIFTH_APPEARANCE=dark|light)

    private func applyAppearanceOverride() {
        guard let wanted = ProcessInfo.processInfo.environment["HIFTH_APPEARANCE"] else { return }
        #if os(iOS)
        switch wanted {
        case "dark": webView.overrideUserInterfaceStyle = .dark
        case "light": webView.overrideUserInterfaceStyle = .light
        default: break
        }
        #else
        switch wanted {
        case "dark": NSApp.appearance = NSAppearance(named: .darkAqua)
        case "light": NSApp.appearance = NSAppearance(named: .aqua)
        default: break
        }
        #endif
    }

    private static let missingBundlePage = """
    <!doctype html><meta charset="utf-8"><title>Hifth</title>
    <body style="font: 16px -apple-system, system-ui; padding: 2rem; color: #333">
    <h1>No web build in this app</h1>
    <p>Run <code>make app-web</code> (the pitch build) or <code>make app-web FLAVOUR=public</code>,
    then build the app again.</p>
    """
}

/// Where navigation may go: inside the bundle, or out to the system browser.
/// A page that opened a new window (`target="_blank"`) also goes out.
final class NavigationPolicy: NSObject, WKNavigationDelegate, WKUIDelegate {
    var onLoaded: () -> Void = {}

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction
    ) async -> WKNavigationActionPolicy {
        guard let url = navigationAction.request.url else { return .cancel }
        if url.scheme == BundleFiles.scheme || url.scheme == "about" { return .allow }
        Sharing.openExternally(url)
        return .cancel
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        onLoaded()
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url { Sharing.openExternally(url) }
        return nil
    }
}

/// The two things that leave the shell: a link to the system browser, and a
/// shared link to the platform's share sheet.
enum Sharing {
    static func openExternally(_ url: URL) {
        guard let scheme = url.scheme, scheme == "http" || scheme == "https" || scheme == "mailto" else { return }
        #if os(iOS)
        UIApplication.shared.open(url)
        #else
        NSWorkspace.shared.open(url)
        #endif
    }

    static func present(url: String, title: String, text: String, from webView: WKWebView) {
        guard let link = URL(string: url) else { return }
        #if os(iOS)
        let sheet = UIActivityViewController(activityItems: [text, link], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = webView
        sheet.popoverPresentationController?.sourceRect = CGRect(
            x: webView.bounds.midX, y: webView.bounds.maxY - 1, width: 1, height: 1
        )
        webView.window?.rootViewController?.presentedOrSelf.present(sheet, animated: true)
        #else
        let picker = NSSharingServicePicker(items: [text, link])
        picker.show(relativeTo: CGRect(x: webView.bounds.midX, y: 8, width: 1, height: 1), of: webView, preferredEdge: .minY)
        #endif
    }
}

#if os(iOS)
private extension UIViewController {
    /// The controller a sheet can be presented from: the top of the stack.
    var presentedOrSelf: UIViewController {
        presentedViewController?.presentedOrSelf ?? self
    }
}
#endif
