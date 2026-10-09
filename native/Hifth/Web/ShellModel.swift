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

    /// How an x-callback answer leaves the shell: the system opens the
    /// caller's address. Replaced by the tests with a collector.
    var openCallback: (URL) -> Void = { Sharing.openCallback($0) }
    /// How a line of JavaScript reaches the page, with its named arguments.
    /// Replaced by the tests with a collector, so what the shell asks of the
    /// page can be read without a web view.
    @ObservationIgnored var runScript: (_ source: String, _ arguments: [String: Any]) -> Void = { _, _ in }
    /// The one line the Page menu runs: the page's own turn, exposed under
    /// `window.__HIFTH_PAGE__` by `apps/web/src/native-bridge.ts`.
    static let stepPageScript = "window.__HIFTH_PAGE__?.stepPage(step);"
    /// How long `open` waits for the page to show the route before telling
    /// the caller it did not.
    private let callbackTimeout: Duration
    /// `open` requests answered once the page reports their route.
    private var awaitingRoute: [AwaitingRoute] = []
    /// `current` requests made before anything was on screen.
    private var awaitingCurrent: [XCallback.Callbacks] = []

    private struct AwaitingRoute {
        let id = UUID()
        let hash: String
        let callbacks: XCallback.Callbacks
    }

    var title: String {
        currentHash.isEmpty ? "Hifth" : "Hifth — \(currentHash.dropFirst())"
    }

    init(
        launchRoute: String? = Route.fromEnvironment() ?? Route.fromArguments(),
        callbackTimeout: Duration = .seconds(8)
    ) {
        self.callbackTimeout = callbackTimeout
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
        keepDrawingWhileBehindIfAsked()
        #else
        webView.scrollView.bounces = false
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        #endif

        bridge.onMessage = { [weak self] message in self?.receive(message) }
        navigation.onLoaded = { [weak self] in self?.loaded() }
        runScript = { [weak self] source, arguments in
            self?.webView.callAsyncJavaScript(source, arguments: arguments, in: nil, in: .page) { _ in }
        }

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

    /// A `hifth://` link, from the system while running or at launch: an
    /// x-callback-url request, which is answered, or a plain link, which only
    /// turns the page.
    func open(_ url: URL) {
        switch XCallback.parse(url) {
        case .request(let request)?:
            perform(request)
        case .failure(let failure, let callbacks)?:
            answer(callbacks.errorURL(failure))
        case nil:
            guard let hash = Route.parse(url) else { return }
            show(hash)
        }
    }

    // MARK: - x-callback-url

    private func perform(_ request: XCallback.Request) {
        switch request.action {
        case .open(let hash):
            show(hash)
            guard request.callbacks.wantsAnswer else { return }
            let waiting = AwaitingRoute(hash: hash, callbacks: request.callbacks)
            awaitingRoute.append(waiting)
            Task { [weak self, timeout = callbackTimeout] in
                try? await Task.sleep(for: timeout)
                self?.expire(waiting.id)
            }
        case .current:
            guard request.callbacks.wantsAnswer else { return }
            if currentHash.isEmpty {
                awaitingCurrent.append(request.callbacks)
            } else {
                answer(request.callbacks.successURL(route: currentHash, publicBase: Self.publicBase))
            }
        }
    }

    /// The page now shows `hash`: answer everyone who was waiting for it.
    private func settle(_ hash: String) {
        for callbacks in awaitingCurrent {
            answer(callbacks.successURL(route: hash, publicBase: Self.publicBase))
        }
        awaitingCurrent.removeAll()
        let shown = awaitingRoute.filter { $0.hash == hash }
        awaitingRoute.removeAll { $0.hash == hash }
        for waiting in shown {
            answer(waiting.callbacks.successURL(route: hash, publicBase: Self.publicBase))
        }
    }

    /// The page never showed the route: say so, once, and stop waiting.
    private func expire(_ id: UUID) {
        guard let index = awaitingRoute.firstIndex(where: { $0.id == id }) else { return }
        let waiting = awaitingRoute.remove(at: index)
        answer(waiting.callbacks.errorURL(.routeNotShown(waiting.hash)))
    }

    private func answer(_ url: URL?) {
        guard let url else { return }
        openCallback(url)
    }

    /// Turn the page to `hash` now if the app is ready, else as soon as it is.
    func show(_ hash: String) {
        guard ready else {
            pendingHash = hash
            return
        }
        pendingHash = nil
        runScript("location.hash = route;", ["route": hash])
    }

    /// Turn one page for the Mac's Page menu: `1` is the next page (to the
    /// left, as the mus'haf reads), `-1` the previous. Before the page is
    /// ready there is nothing to turn, and a press then is dropped rather than
    /// saved up: a menu item that fires later, on a page the reader has since
    /// moved, would be a turn nobody asked for.
    func stepPage(_ step: Int) {
        guard ready else { return }
        runScript(Self.stepPageScript, ["step": step])
    }

    // MARK: - Messages from the page

    /// Internal, not private, so the tests can play the page.
    func receive(_ message: BridgeMessage) {
        switch message {
        case .ready:
            ready = true
            if let pendingHash { show(pendingHash) }
            probeIfAsked()
            scheduleSnapshotIfAsked()
        case .route(let hash):
            currentHash = hash
            settle(hash)
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
    /// `HIFTH_PROBE_EVAL` adds one more question, a JavaScript expression whose
    /// value lands under `eval`: how a fault that only the app shows gets
    /// measured from inside it (make app-probe EVAL=…). A question that has to
    /// wait, say for a redraw after a tap, answers with a promise; it is awaited.
    private func probeIfAsked() {
        let environment = ProcessInfo.processInfo.environment
        guard environment["HIFTH_PROBE"] == "1" else { return }
        let delayMs = Int(environment["HIFTH_PROBE_DELAY_MS"] ?? "") ?? 0
        let extra = environment["HIFTH_PROBE_EVAL"] ?? ""
        Task {
            try? await Task.sleep(for: .milliseconds(delayMs))
            probe(extra)
        }
    }

    private func probe(_ extra: String) {
        webView.callAsyncJavaScript(Self.probeScript, arguments: ["extra": extra], in: nil, in: .page) { result in
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

    static let probeScript = """
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
      visibility: document.visibilityState,
      eval: extra ? await (async () => { try { return await (0, eval)(extra); } catch (e) { return String(e); } })() : undefined,
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
            // A page the system thinks nobody can see stops its fades at the
            // first frame, so its picture shows notes half slid in and chips
            // still blank. Refuse to keep a picture like that.
            let page = await Self.pageState(of: webView)
            guard page.visibility == "visible" else {
                print("snapshot refused: the page is \(page.visibility), so a picture of it would be frozen mid-animation")
                exit(1)
            }
            let (png, size) = await Self.snapshotPNG(of: webView, page: page.size)
            // The picture is of the page the reader sees, no more: a picture
            // taller than the page shows a blank band the app never draws.
            guard size == page.size else {
                print("snapshot refused: the picture is \(Int(size.width))x\(Int(size.height)) but the page is \(Int(page.size.width))x\(Int(page.size.height))")
                exit(1)
            }
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

    #if os(macOS)
    /// `make app-shot` and `make app-probe` open the Mac app behind the windows
    /// already on screen, so the owner keeps their place. Behind other windows
    /// WebKit calls the page hidden and stops its fades at the first frame, and
    /// the picture shows notes half slid in. Only for those two jobs, and only
    /// in a debug build, the web view is told to keep drawing anyway. WebKit
    /// has no public switch for this; the private one is asked for by name and
    /// skipped if it is not there, so a WebKit without it fails the picture's
    /// own visibility check instead of crashing.
    private func keepDrawingWhileBehindIfAsked() {
        #if DEBUG
        let environment = ProcessInfo.processInfo.environment
        let photographing = !(environment["HIFTH_SNAPSHOT_PATH"] ?? "").isEmpty || environment["HIFTH_PROBE"] == "1"
        let selector = NSSelectorFromString("_setWindowOcclusionDetectionEnabled:")
        guard photographing, webView.responds(to: selector) else { return }
        typealias Setter = @convention(c) (AnyObject, Selector, Bool) -> Void
        let set = unsafeBitCast(webView.method(for: selector), to: Setter.self)
        set(webView, selector, false)
        #endif
    }
    #endif

    private static func pageState(of webView: WKWebView) async -> (visibility: String, size: CGSize) {
        await withCheckedContinuation { continuation in
            webView.callAsyncJavaScript("return [document.visibilityState, innerWidth, innerHeight]", arguments: [:], in: nil, in: .page) { result in
                let values = (try? result.get()) as? [Any] ?? []
                let visibility = values.first as? String ?? "unknown"
                let width = (values.count > 1 ? values[1] as? NSNumber : nil)?.doubleValue ?? 0
                let height = (values.count > 2 ? values[2] as? NSNumber : nil)?.doubleValue ?? 0
                continuation.resume(returning: (visibility, CGSize(width: width, height: height)))
            }
        }
    }

    /// The PNG, and its size in points, to check against the page's own.
    /// On the Mac the web view runs on under the title bar, so the view is
    /// taller than the page; only the page's own area is photographed.
    private static func snapshotPNG(of webView: WKWebView, page: CGSize) async -> (Data, CGSize) {
        let configuration = WKSnapshotConfiguration()
        configuration.rect = CGRect(origin: .zero, size: page)
        return await withCheckedContinuation { continuation in
            webView.takeSnapshot(with: configuration) { image, _ in
                #if os(iOS)
                continuation.resume(returning: (image?.pngData() ?? Data(), image?.size ?? .zero))
                #else
                let png = image
                    .flatMap { $0.tiffRepresentation }
                    .flatMap { NSBitmapImageRep(data: $0) }
                    .flatMap { $0.representation(using: .png, properties: [:]) }
                continuation.resume(returning: (png ?? Data(), image?.size ?? .zero))
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
        openCallback(url)
    }

    /// An x-callback answer: the caller's own address, in whatever app owns
    /// its scheme. `XCallback` has already refused the schemes that must not
    /// be opened from here.
    static func openCallback(_ url: URL) {
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
