import AuthenticationServices
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

    /// The one web view, built the first time the screen asks for it, never
    /// when the model is made. The model is made while iPadOS is still
    /// starting the app; a web view built then closed the app on the first
    /// touch of a verse on iPadOS 18.5 (docs/issues/ipad-crash-on-verse-touch.md).
    @ObservationIgnored private(set) lazy var webView: WKWebView = makeWebView()
    /// Whether the web view exists yet: the tests read it.
    @ObservationIgnored private(set) var webViewBuilt = false
    @ObservationIgnored private let launchRoute: String?
    private let bridge = Bridge()
    private let navigation = NavigationPolicy()
    private var pendingHash: String?
    private var snapshotTaken = false
    /// The probe runs once, though the page says it is ready after every reload.
    private var probeStarted = false
    /// How many times the page has said it is ready: a walk of steps reloads
    /// the page for each one and waits for this to go up.
    private var readyCount = 0

    // MARK: - The launch file (launch item ㉑, AppStatus.swift)

    /// What the launch file says for this build; empty until it is read, and
    /// empty for good when it cannot be.
    private(set) var status = AppStatus.Verdict()
    /// "Please update" was closed; it comes back at the next launch.
    private(set) var updateClosed = false
    /// The read in flight, kept so tests can wait for it.
    @ObservationIgnored private(set) var statusRead: Task<Void, Never>?
    /// Reads the launch file; nil when this build reads none.
    @ObservationIgnored var loadStatus: () async -> Data? = {
        guard let address = AppStatus.launchAddress() else { return nil }
        return await AppStatus.fetch(from: address)
    }
    @ObservationIgnored var statusDefaults: UserDefaults = .standard
    @ObservationIgnored var appVersion: String =
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""

    /// The card to show over the page, if any, in the reader's language.
    var statusWords: String? {
        let arabic = AppStatus.readsArabic
        if status.tooOld && !updateClosed { return AppStatus.updateWords(arabic: arabic) }
        if let notice = status.notice { return arabic ? notice.arabic : notice.english }
        return nil
    }

    func closeStatusCard() {
        if status.tooOld && !updateClosed { updateClosed = true } else { closeNotice() }
    }

    func closeNotice() {
        guard let notice = status.notice else { return }
        AppStatus.dismiss(notice.id, in: statusDefaults)
        status.notice = nil
    }

    /// Once per launch, after the first page is up, so the read never holds
    /// up the page.
    private func readStatusOnce() {
        guard statusRead == nil else { return }
        #if os(iOS)
        let platform = "ios"
        #else
        let platform = "macos"
        #endif
        let load = loadStatus
        statusRead = Task { [weak self] in
            guard let data = await load(), let file = AppStatus.parse(data) else { return }
            guard let self else { return }
            self.status = file.verdict(
                platform: platform, version: self.appVersion,
                dismissed: AppStatus.dismissed(in: self.statusDefaults))
        }
    }
    #if os(iOS)
    /// Kept here because the pencil interaction holds it only weakly.
    @ObservationIgnored private let pencilListener = PencilListener()
    #endif

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
    /// How the shell answers a question the page asked (`askApp` in
    /// `native-bridge.ts`): the page's answer door, put in place before the
    /// question left, with the id and the answer bound, never written in.
    static let answerScript = "window.__HIFTH_ANSWER__?.(id, answer);"
    /// The last question being answered, kept so tests can wait for it.
    @ObservationIgnored private(set) var lastAsk: Task<Void, Never>?
    /// How long `open` waits for the page to show the route before telling
    /// the caller it did not.
    private let callbackTimeout: Duration
    /// `open` requests answered once the page reports their route.
    private var awaitingRoute: [AwaitingRoute] = []
    /// `current` requests made before anything was on screen.
    private var awaitingCurrent: [XCallback.Callbacks] = []
    /// The place the last link asked the page to show, until it shows it.
    private var askedHash: String?

    private struct AwaitingRoute {
        let id = UUID()
        let hash: String
        let callbacks: XCallback.Callbacks
    }

    var title: String {
        currentHash.isEmpty ? "Hifth" : "Hifth: \(currentHash.dropFirst())"
    }

    init(
        launchRoute: String? = Route.launchRoute(),
        callbackTimeout: Duration = .seconds(8)
    ) {
        self.callbackTimeout = callbackTimeout
        self.launchRoute = launchRoute
        missingBundle = BundleFiles.root == nil

        bridge.onMessage = { [weak self] message in self?.receive(message) }
        navigation.onLoaded = { [weak self] in self?.loaded() }
        runScript = { [weak self] source, arguments in
            self?.webView.runPageScript(source, arguments: arguments) { _ in }
        }
        #if os(iOS)
        pencilListener.model = self
        #endif
    }

    /// Builds the web view, sets it up and starts the page loading. Runs once,
    /// on the first read of `webView`.
    private func makeWebView() -> WKWebView {
        webViewBuilt = true
        #if os(iOS)
        let platform = "ios"
        #else
        let platform = "macos"
        #endif

        let configuration = WKWebViewConfiguration()
        if ScreenshotData.atLaunch {
            configuration.websiteDataStore = .nonPersistent()
        }
        let root = BundleFiles.root
        if let root {
            configuration.setURLSchemeHandler(LocalSchemeHandler(root: root), forURLScheme: BundleFiles.scheme)
        }
        configuration.userContentController.add(bridge, name: Bridge.handlerName)
        configuration.userContentController.addUserScript(
            Bridge.bootScript(
                platform: platform,
                publicBase: Self.publicBase,
                appVersion: Bridge.versionLine(info: Bundle.main.infoDictionary ?? [:]),
                deviceReports: DeviceReports.folder.map { DeviceReports.summary(in: $0) } ?? ""
            )
        )
        #if os(iOS)
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.ignoresViewportScaleLimits = false
        #endif

        let webView = WKWebView(frame: .zero, configuration: configuration)
        #if DEBUG
        // Safari's Web Inspector reaches the page over the cable: builds from this
        // laptop only, never a release.
        webView.isInspectable = true
        #endif
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.navigationDelegate = navigation
        webView.uiDelegate = navigation
        #if os(macOS)
        // Off on purpose: with it on WebKit eats the trackpad pinch as a page
        // zoom. Off, it forwards the pinch as gesture events the web app's own
        // stage already binds.
        webView.allowsMagnification = false
        keepDrawingWhileBehindIfAsked(webView)
        #else
        webView.scrollView.bounces = false
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        let pencil = UIPencilInteraction()
        pencil.delegate = pencilListener
        webView.addInteraction(pencil)
        #endif

        #if !STORE
        applyAppearanceOverride(webView)
        #endif

        guard root != nil else {
            webView.loadHTMLString(Self.missingBundlePage, baseURL: nil)
            return webView
        }
        // A launch route (and language) rides in the first URL: no timing, no
        // race, the page simply opens there.
        webView.load(URLRequest(url: Route.startURL(route: launchRoute, language: Route.launchLanguage())))
        return webView
    }

    // MARK: - Routes in

    /// A `hifth://` link, from the system while running or at launch: an
    /// x-callback-url request, which is answered, or a plain link, which only
    /// turns the page.
    /// The launch file can switch links from other apps off for a version
    /// with a problem in them: a request is told so, a plain link does nothing.
    func open(_ url: URL) {
        let linksOff = status.off.contains(.links)
        switch XCallback.parse(url) {
        case .request(let request)?:
            if linksOff { answer(request.callbacks.errorURL(.switchedOff)); return }
            perform(request)
        case .failure(let failure, let callbacks)?:
            answer(callbacks.errorURL(failure))
        case nil:
            guard !linksOff, let hash = Route.parse(url) else { return }
            show(hash)
        }
    }

    // MARK: - x-callback-url

    /// A build installed from the laptop (Swift's debug switch on). Only these
    /// take the laptop's links: check cards, capture links, current-to-file.
    #if DEBUG
    static let laptopBuild = true
    #else
    static let laptopBuild = false
    #endif

    private func perform(_ request: XCallback.Request) {
        if let refusal = XCallback.refusal(for: request.action, laptopBuild: Self.laptopBuild) {
            answer(request.callbacks.errorURL(refusal))
            return
        }
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
        case .check(let check):
            #if DEBUG
            // A new card replaces the one on screen; what was answered there is kept.
            if let old = checkCard, old.touched { save(old) }
            checkCard = CheckCard(check: check, callbacks: request.callbacks)
            #else
            _ = check
            #endif
        case .capture(let name):
            #if DEBUG
            keepCaptureForLink(name, answering: request.callbacks)
            #else
            _ = name
            #endif
        case .currentToFile:
            #if DEBUG
            writeCurrentToFile(answering: request.callbacks)
            #endif
            break
        }
    }

    #if DEBUG
    // MARK: - Walk capture (builds from the laptop only)

    /// The last ten seconds of page moves, touches and Pencil strokes, for a
    /// walk capture to keep beside its picture.
    @ObservationIgnored var captureTrail = CaptureTrail()
    /// Where captures are kept; the tests and the launch flag point it elsewhere.
    @ObservationIgnored var captureStore = CaptureStore(folder: CaptureStore.defaultFolder)
    /// The capture the "Add a note" banner is for, while it is up.
    private(set) var captureNote: URL?
    /// What has been typed in the banner so far.
    var captureNoteText = ""

    /// Show the banner for a new capture. One already up is closed first, so
    /// what was typed there is kept with its own capture.
    func offerNote(for capture: URL) {
        closeNote()
        captureNote = capture
    }

    /// Close the banner, keeping whatever was typed.
    func closeNote() {
        guard let capture = captureNote else { return }
        do {
            try captureStore.keepNote(captureNoteText, in: capture)
        } catch {
            print("walk capture note not kept \(error)")
        }
        captureNote = nil
        captureNoteText = ""
    }

    /// The touch, Pencil and page-move trail: the recorder on the iPad feeds it.
    func noteOnTrail(_ happening: CaptureTrail.Happening) {
        captureTrail.add(happening, at: Date())
    }

    /// Set by `startWalkCaptureOnce` (WalkCapture.swift), which runs at the
    /// first `ready` only, though the page says it is ready after every reload.
    @ObservationIgnored var walkCaptureStarted = false
    @ObservationIgnored var walkCaptureObserver: NSObjectProtocol?
    #if os(iOS)
    @ObservationIgnored var touchTrailRecorder: UIGestureRecognizer?
    /// Apple's recorder of the last few seconds, and what starts and stops it
    /// as the app comes to the front and goes to the back.
    @ObservationIgnored var clipRecorder: ClipRecorder?
    @ObservationIgnored var clipObservers: [NSObjectProtocol] = []
    #endif

    // MARK: - Capture links (builds from the laptop only)

    /// How a capture link keeps its capture: as a screenshot would, named, with
    /// no note banner. The tests put a collector here, as there is no web view.
    @ObservationIgnored lazy var captureByLink: (String) async -> URL? = { [weak self] name in
        await self?.captureWalk(trigger: "link", name: name)
    }
    /// How long a capture link waits once the page shows its place, so a page
    /// turn has finished drawing before the picture is taken.
    @ObservationIgnored var captureSettle: Duration = .milliseconds(600)
    /// Capture links and current-to-file requests waiting for the page.
    @ObservationIgnored private var awaitingPage: [CaptureLinkWaiting] = []

    private struct CaptureLinkWaiting {
        let id = UUID()
        /// The place an `open` just asked for, if the page is not showing it
        /// yet; `nil` once any place will do.
        var hash: String?
        let run: () -> Void
    }

    private func keepCaptureForLink(_ name: String, answering callbacks: XCallback.Callbacks) {
        whenPageShows { [weak self] in
            guard let self else { return }
            Task {
                try? await Task.sleep(for: self.captureSettle)
                let route = self.currentHash
                if let folder = await self.captureByLink(name) {
                    self.answer(callbacks.captureURL(folder: folder.lastPathComponent, route: route, publicBase: Self.publicBase))
                } else {
                    self.answer(callbacks.errorURL(.captureNotKept))
                }
            }
        }
    }

    private func writeCurrentToFile(answering callbacks: XCallback.Callbacks) {
        whenPageShows { [weak self] in
            guard let self else { return }
            let hash = currentHash
            do {
                let file = try captureStore.keepCurrent(route: hash, publicBase: Self.publicBase, at: Date())
                print("current written \(file.lastPathComponent) \(hash)")
                answer(callbacks.successURL(route: hash, publicBase: Self.publicBase))
            } catch {
                print("current not written \(error)")
                answer(callbacks.errorURL(.currentNotWritten))
            }
        }
    }

    /// Run `job` once the page is ready and showing a place, and, if an `open`
    /// was just sent, that place: a capture right after an open is of the new
    /// page, not the one before. An open the page never shows stops holding
    /// the job back after the same wait `open` gives its own answer.
    private func whenPageShows(_ job: @escaping () -> Void) {
        let wanted = askedHash.flatMap { $0 == currentHash ? nil : $0 }
        let waiting = CaptureLinkWaiting(hash: wanted, run: job)
        awaitingPage.append(waiting)
        runCaptureLinkWaiting()
        guard wanted != nil else { return }
        Task { [weak self, timeout = callbackTimeout] in
            try? await Task.sleep(for: timeout)
            self?.stopWaitingForPlace(waiting.id)
        }
    }

    private func stopWaitingForPlace(_ id: UUID) {
        guard let index = awaitingPage.firstIndex(where: { $0.id == id }) else { return }
        if awaitingPage[index].hash == askedHash { askedHash = nil }
        awaitingPage[index].hash = nil
        runCaptureLinkWaiting()
    }

    private func runCaptureLinkWaiting() {
        guard ready, !currentHash.isEmpty, !awaitingPage.isEmpty else { return }
        let due = awaitingPage.filter { $0.hash == nil || $0.hash == currentHash }
        awaitingPage.removeAll { job in due.contains { $0.id == job.id } }
        for job in due { job.run() }
    }
    #endif

    // MARK: - The check card (builds from the laptop only)

    /// The card a `check` link opened, while it is on screen.
    private(set) var checkCard: CheckCard?
    /// Where answers are saved; the tests point it at a scratch folder.
    @ObservationIgnored var checksFolder: URL = CheckStore.defaultFolder

    /// Done: save the answers, tell the caller the result, close the card.
    func finishCheck() {
        guard let card = checkCard else { return }
        save(card)
        checkCard = nil
        answer(card.callbacks.checkDoneURL(id: card.check.id, result: card.result))
    }

    /// Closed without Done: keep what was answered, tell nobody.
    func closeCheck() {
        guard let card = checkCard else { return }
        if card.touched { save(card) }
        checkCard = nil
    }

    private func save(_ card: CheckCard) {
        do {
            let file = try CheckStore.save(card.record(route: currentHash, at: Date()), in: checksFolder)
            print("check answers saved \(file.lastPathComponent)")
        } catch {
            print("check answers not saved \(error)")
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
        askedHash = hash
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
            readyCount += 1
            readStatusOnce()
            checkSessionOnce()
            if let pendingHash { show(pendingHash) }
            #if !STORE
            probeIfAsked()
            scheduleSnapshotIfAsked()
            #endif
            #if DEBUG
            startWalkCaptureOnce()
            #endif
        case .route(let hash):
            currentHash = hash
            if hash == askedHash { askedHash = nil }
            #if DEBUG
            captureTrail.add(.route(hash), at: Date())
            #endif
            settle(hash)
            #if DEBUG
            runCaptureLinkWaiting()
            #endif
        case .share(let url, let title, let text):
            Sharing.present(url: url, title: title, text: text, from: webView)
        case .ask(let id, let name, let text):
            lastAsk = Task { [weak self] in
                guard let self else { return }
                let answer = await self.answer(question: name, text: text)
                self.runScript(Self.answerScript, ["id": id, "answer": answer])
            }
        }
    }

    /// The questions the page may ask, each answered with `ok` and a `value`,
    /// or `ok: false` and an `error`. Every question gets an answer, so the
    /// page never waits forever. `ping` is the harmless one the trial on a
    /// device uses (sign-in ⑤); `sign-in` shows Apple's sheet (step 8);
    /// `signed-in` says "signed-in" or "signed-out" and nothing more (step 15).
    /// The account section's questions (steps 14 and 16): `account` says "off",
    /// "signed-out" or "signed-in"; `sign-out`; `delete-account`; `invite-kept`
    /// says "yes" or "no", never the code; `forget-invite`.
    /// `text` is the invite code a tester typed with `sign-in` (step 18): it
    /// goes to hifth.app and the Keychain, and never back to the page.
    private func answer(question name: String, text: String? = nil) async -> [String: Any] {
        switch name {
        case "ping":
            return ["ok": true, "value": "pong"]
        case "account":
            if await currentSession() != nil { return ["ok": true, "value": "signed-in"] }
            // The launch file is what switches sign-in on in the store build.
            await statusRead?.value
            let offered = SignIn.offered(server: server != nil, on: status.on, storeBuild: storeBuild)
            return ["ok": true, "value": offered ? "signed-out" : "off"]
        case "sign-out":
            guard !signingIn else { return ["ok": false, "error": SignIn.Failure.busy.code] }
            // This device first, whatever the connection; hifth.app is told after the answer.
            let leaving = await currentSession()
            session = nil
            sessionStore?.clear()
            if let leaving, let server {
                lastSignOut = Task { await server.signOut(session: leaving.token) }
            }
            return ["ok": true, "value": "signed-out"]
        case "delete-account":
            guard !signingIn else { return ["ok": false, "error": SignIn.Failure.busy.code] }
            signingIn = true
            defer { signingIn = false }
            guard let leaving = await currentSession(), let server else {
                return ["ok": false, "error": "signed-out"]
            }
            do {
                let link = try await server.deleteAccount(session: leaving.token)
                // Only now, with hifth.app's yes: everything this device keeps for the account.
                session = nil
                sessionStore?.clear()
                inviteStore?.clear()
                return ["ok": true, "value": "deleted-\(link)"]
            } catch let failure as SignIn.Failure where failure == .refused("signed-out") {
                // hifth.app does not know this sign-in, so it cannot say whose account to
                // delete. The device is signed out; signing in again comes first.
                session = nil
                sessionStore?.clear()
                return ["ok": false, "error": "signed-out"]
            } catch let failure as SignIn.Failure {
                return ["ok": false, "error": failure.code]
            } catch {
                return ["ok": false, "error": SignIn.Failure.badReply.code]
            }
        case "invite-kept":
            return ["ok": true, "value": inviteStore?.load() == nil ? "no" : "yes"]
        case "forget-invite":
            inviteStore?.clear()
            return ["ok": true, "value": "forgotten"]
        case "sign-in":
            guard !signingIn else { return ["ok": false, "error": SignIn.Failure.busy.code] }
            signingIn = true
            defer { signingIn = false }
            // The launch check ends first, so it cannot drop the session this is about to save.
            await checkSessionOnce().value
            // A code just typed wins over the kept one. It is kept once hifth.app has taken
            // it, and the kept one is dropped only when it was the one sent and hifth.app says
            // it is no longer good: never for a mistyped code, no connection or any other failure.
            let typed = text?.trimmingCharacters(in: .whitespacesAndNewlines)
            let fresh = typed?.isEmpty == false ? typed : nil
            let invites = inviteStore
            let result = await (signIn ?? signInWithApple)(fresh ?? invites?.load()) {
                if let fresh { invites?.save(fresh) }
            }
            if fresh == nil, result == .failure(.inviteNeeded) { invites?.clear() }
            switch result {
            case .success(let session):
                self.session = session
                // A Keychain that refuses is not a failed sign-in: the reader is signed in
                // until the app closes.
                sessionStore?.save(session)
                return ["ok": true, "value": "signed-in"]
            case .failure(let failure):
                return ["ok": false, "error": failure.code]
            }
        case "signed-in":
            return ["ok": true, "value": await currentSession() == nil ? "signed-out" : "signed-in"]
        default:
            return ["ok": false, "error": "unknown-question"]
        }
    }

    /// The session in use right now. Waits for the launch check, so the page
    /// never hears a stale yes, and drops a session that has run out.
    private func currentSession() async -> SignIn.Session? {
        await checkSessionOnce().value
        if let session, !SignIn.usable(session, now: now()) {
            self.session = nil
            sessionStore?.clear()
        }
        return session
    }

    // MARK: - Signing in (sign-in step 8, Account/SignIn.swift)

    /// The session hifth.app gave. It is kept in the Keychain between launches
    /// (step 15) and never reaches the page, the log or a probe's answer; the
    /// page hears only "signed-in" or "signed-out".
    @ObservationIgnored private(set) var session: SignIn.Session?
    /// Where the session is kept between launches, and how Apple is asked
    /// whether the reader still allows Hifth. Both are nil in a build that
    /// names no sign-in server, so the laptop's tests and walks never touch the
    /// Keychain. The tests replace them with stand-ins.
    @ObservationIgnored var sessionStore: SessionStore? = SignIn.realStore(at: SignIn.address())
    @ObservationIgnored var credentialCheck: CredentialCheck? = SignIn.realCheck(at: SignIn.address())
    /// Where a tester's invite code is kept (step 18, Account/InviteStore.swift).
    /// Nil, like the two above, in a build that names no sign-in server.
    @ObservationIgnored var inviteStore: InviteStore? = SignIn.realInviteStore(at: SignIn.address())
    /// hifth.app's sign-in addresses for this build; nil when it names no server.
    @ObservationIgnored var server: SignIn.Server? = SignIn.address().map { SignIn.Server(base: $0) }
    /// Whether this is the store build, which offers sign-in only once the
    /// launch file switches it on. The tests set it.
    @ObservationIgnored var storeBuild = SignIn.storeBuild
    /// The word to hifth.app that this device signed out, kept so the tests
    /// can wait for it.
    @ObservationIgnored private(set) var lastSignOut: Task<Void, Never>?
    /// The clock, so the tests can move it.
    @ObservationIgnored var now: () -> Date = { Date() }
    /// The check at launch, kept so the page's questions and the tests can
    /// wait for it.
    @ObservationIgnored private(set) var sessionCheck: Task<Void, Never>?
    /// Where Apple's notice that the reader cut Hifth off arrives while the app
    /// is open (question 13). The tests give each app its own.
    @ObservationIgnored var notices: NotificationCenter = .default
    /// The check that notice starts, kept so the tests can wait for it.
    @ObservationIgnored private(set) var lastCutOffCheck: Task<Void, Never>?

    /// Once per launch, after the first page is up or at the page's first
    /// sign-in question, whichever comes first: read the saved session and ask
    /// Apple whether the reader has cut Hifth off (StaySignedIn.swift).
    @discardableResult
    private func checkSessionOnce() -> Task<Void, Never> {
        if let sessionCheck { return sessionCheck }
        let store = sessionStore
        let check = credentialCheck
        let moment = now()
        let task = Task { [weak self] in
            guard let store else { return }
            let (restored, cutOff) = await SignIn.launchCheck(from: store, check: check, now: moment)
            self?.session = restored
            if let cutOff { self?.tellSignedOut(cutOff) }
        }
        sessionCheck = task
        watchForCutOff()
        return task
    }

    /// Tells hifth.app that this device's sign-in has ended, without making the
    /// page wait for the answer: the device is signed out whatever it says.
    private func tellSignedOut(_ leaving: SignIn.Session) {
        guard let server else { return }
        lastSignOut = Task { await server.signOut(session: leaving.token) }
    }

    /// Apple posts a notice when the reader cuts Hifth off in their Apple
    /// settings while the app is open (question 13). Listened for once, and only
    /// in a build that signs in at all.
    @ObservationIgnored private var cutOffWatch: NSObjectProtocol?

    private func watchForCutOff() {
        guard cutOffWatch == nil, sessionStore != nil else { return }
        cutOffWatch = notices.addObserver(
            forName: ASAuthorizationAppleIDProvider.credentialRevokedNotification, object: nil, queue: nil
        ) { [weak self] _ in
            Task { @MainActor in self?.appleSaysCutOff() }
        }
    }

    /// The notice says nothing of whom it is about, so Apple is asked about the
    /// reader signed in here, as at launch. Only Apple's own "cut off" or "not
    /// known" drops the sign-in; no answer keeps it, so the notice can never sign
    /// out a reader who still allows Hifth.
    private func appleSaysCutOff() {
        lastCutOffCheck = Task { [weak self] in
            guard let self else { return }
            await self.checkSessionOnce().value
            guard let held = self.session, let check = self.credentialCheck else { return }
            switch await check.standing(of: held.appleUser) {
            case .allowed, .unknown:
                return
            case .revoked, .notFound:
                // A sign-in made while Apple was being asked is a new yes from the reader.
                guard self.session == held else { return }
                self.session = nil
                self.sessionStore?.clear()
                self.tellSignedOut(held)
            }
        }
    }
    /// A sign-in is open: a second ask is turned away rather than showing a
    /// second sheet.
    @ObservationIgnored private var signingIn = false
    /// The whole sign-in; nil means the real one with Apple's sheet. The tests
    /// replace it with a stand-in. It is handed the invite code to send, if
    /// any, and what to call once hifth.app has taken it.
    @ObservationIgnored var signIn: ((_ invite: String?, _ invited: () -> Void) async -> Result<SignIn.Session, SignIn.Failure>)?

    private func signInWithApple(invite: String?, invited: () -> Void) async -> Result<SignIn.Session, SignIn.Failure> {
        guard let server else { return .failure(.off) }
        guard webViewBuilt, let window = webView.window else { return .failure(.noWindow) }
        let sheet = AppleSheet(anchor: window)
        return await SignIn.run(server: server, invite: invite, invited: invited) {
            try await sheet.ask(nonce: $0)
        }
    }

    private func loaded() {
        #if os(iOS)
        // The viewport meta already forbids zoom in this build; pinning the zoom
        // scale is the belt to that brace. The web view's own touch handlers
        // are left switched on (docs/issues/ipad-crash-on-verse-touch.md).
        webView.scrollView.minimumZoomScale = 1
        webView.scrollView.maximumZoomScale = 1
        #endif
    }

    // The probe, the walk of steps, the picture and the forced look below are
    // for the laptop's tools. A plain Release build keeps them, since the
    // reviewer walk drives one; the build made for the store (STORE, set by
    // `make app-archive`) leaves them out, and its release check refuses an
    // archive that still has them (launch item 36).
    #if !STORE
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
        guard environment["HIFTH_PROBE"] == "1", !probeStarted else { return }
        probeStarted = true
        if let steps = environment["HIFTH_PROBE_STEPS"], !steps.isEmpty {
            walkSteps(steps)
            return
        }
        let delayMs = Int(environment["HIFTH_PROBE_DELAY_MS"] ?? "") ?? 0
        let extra = environment["HIFTH_PROBE_EVAL"] ?? ""
        Task {
            try? await Task.sleep(for: .milliseconds(delayMs))
            probe(extra)
        }
    }

    private func probe(_ extra: String) {
        let environment = ProcessInfo.processInfo.environment
        let path = environment["HIFTH_PROBE_PATH"]
        let shot = environment["HIFTH_PROBE_SHOT"] ?? ""
        webView.runPageScript(Self.probeScript, arguments: ["extra": extra]) { result in
            switch result {
            case .success(let value):
                print("probe \(value)")
                Task {
                    do {
                        // The picture before the answer: the sideways walk stops
                        // waiting once the answer is there, and the app with it.
                        if !shot.isEmpty {
                            let page = await Self.pageState(of: self.webView)
                            let (png, _) = await Self.snapshotPNG(of: self.webView, page: page.size)
                            try Self.keepProbePicture(png, at: shot)
                            print("probe picture written \(shot)")
                        }
                        try Self.keepProbeAnswer("\(value)", at: path)
                    } catch {
                        print("probe failed to keep its answer \(error)")
                        exit(1)
                    }
                    exit(0)
                }
            case .failure(let error):
                print("probe failed \(error)")
                exit(1)
            }
        }
    }

    /// On its side the app is started by a UI test (make app-probe SIDEWAYS=1),
    /// which cannot read what the app prints: with `HIFTH_PROBE_PATH` the
    /// answer is also written there, for the walk to read back. The app and
    /// the test work from different folders, so only an absolute path names
    /// the same file for both; anything else is refused.
    static func keepProbeAnswer(_ answer: String, at path: String?) throws {
        try keepProbeFile(Data(answer.utf8), at: path)
    }

    /// With `HIFTH_PROBE_SHOT` (make app-probe PROBE_SHOT=…) the page is also
    /// photographed as the question left it, since the app quits once it has
    /// answered. Same path rule as the answer; a snapshot that came back with
    /// no bytes is refused rather than kept as a file nobody can open.
    static func keepProbePicture(_ png: Data, at path: String?) throws {
        guard let path, !path.isEmpty else { return }
        guard !png.isEmpty else { throw ProbePictureEmpty() }
        try keepProbeFile(png, at: path)
    }

    private static func keepProbeFile(_ data: Data, at path: String?) throws {
        guard let path, !path.isEmpty else { return }
        guard path.hasPrefix("/") else { throw ProbePathNotAbsolute(path: path) }
        try data.write(to: URL(fileURLWithPath: path))
    }

    struct ProbePathNotAbsolute: Error {
        let path: String
    }

    struct ProbePictureEmpty: Error {}

    // MARK: - A walk of steps (make pitch-walk)

    /// With `HIFTH_PROBE_STEPS` naming a list of steps (an absolute path), the
    /// probe walks them all in one start of the app, instead of one start per
    /// step: for each, the page is reloaded at the step's passage, waits, is
    /// asked the step's question, and is photographed. Each answer and picture
    /// is written beside the list, as `<id>.json` and `<id>.png`, and the walk
    /// logs to `walk.log` there. A step that fails is written down and the walk
    /// goes on. Once every step is done the app writes a short summary to
    /// `HIFTH_PROBE_PATH`, which is what the sideways UI test waits for.
    struct ProbeStep: Decodable, Equatable {
        let id: String
        let route: String
        let delayMs: Int
        let eval: String

        private enum CodingKeys: String, CodingKey { case id, route, delayMs, eval }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            route = try c.decode(String.self, forKey: .route)
            delayMs = try c.decodeIfPresent(Int.self, forKey: .delayMs) ?? 2000
            eval = try c.decodeIfPresent(String.self, forKey: .eval) ?? ""
        }
    }

    /// A step's name becomes its files' names, so it must be a plain one, and
    /// no two steps may share it.
    struct ProbeStepNameNotPlain: Error {
        let id: String
    }

    static func probeSteps(at path: String) throws -> [ProbeStep] {
        guard path.hasPrefix("/") else { throw ProbePathNotAbsolute(path: path) }
        let steps = try JSONDecoder().decode([ProbeStep].self, from: Data(contentsOf: URL(fileURLWithPath: path)))
        var seen = Set<String>()
        for step in steps {
            let plain = !step.id.isEmpty && !step.id.hasPrefix(".") && !step.id.contains("/")
            guard plain, seen.insert(step.id).inserted else { throw ProbeStepNameNotPlain(id: step.id) }
        }
        return steps
    }

    static func probeStepFile(_ listPath: String, id: String, ext: String) -> String {
        let folder = (listPath as NSString).deletingLastPathComponent
        return (folder as NSString).appendingPathComponent("\(id).\(ext)")
    }

    /// One line of the walk's log: the time in UTC, the app's process, the
    /// event, then its fields in the order of their names.
    /// Reloads, then waits up to `wait` for the page to say it is ready; if it never
    /// does, reloads again, up to `tries` times. Answers which try worked, or nil.
    @MainActor
    static func reloadUntilReady(tries: Int, wait: Duration, poll: Duration,
                                 isReady: () -> Bool, reload: () -> Void) async -> Int? {
        for attempt in 1...max(1, tries) {
            reload()
            let deadline = ContinuousClock.now + wait
            while !isReady(), ContinuousClock.now < deadline {
                try? await Task.sleep(for: poll)
            }
            if isReady() { return attempt }
        }
        return nil
    }

    static func walkLogLine(_ event: String, _ fields: [String: String], at: Date, pid: Int32) -> String {
        let time = ISO8601DateFormatter().string(from: at)
        let rest = fields.keys.sorted().map { "\($0)=\(fields[$0]!)" }
        return ([time, "pid=\(pid)", "ev=\(event)"] + rest).joined(separator: " ")
    }

    private static func appendLog(_ line: String, to path: String) {
        let data = Data((line + "\n").utf8)
        if let handle = FileHandle(forWritingAtPath: path) {
            handle.seekToEndOfFile()
            handle.write(data)
            try? handle.close()
        } else {
            try? data.write(to: URL(fileURLWithPath: path))
        }
        print(line)
    }

    private func walkSteps(_ listPath: String) {
        let done = ProcessInfo.processInfo.environment["HIFTH_PROBE_PATH"]
        let logPath = Self.probeStepFile(listPath, id: "walk", ext: "log")
        let log = { (event: String, fields: [String: String]) in
            Self.appendLog(Self.walkLogLine(event, fields, at: Date(), pid: getpid()), to: logPath)
        }
        Task { @MainActor in
            let steps: [ProbeStep]
            do {
                steps = try Self.probeSteps(at: listPath)
            } catch {
                log("steps_unreadable", ["msg": "\"\(error)\""])
                try? Self.keepProbeAnswer("{\"error\":\"the list of steps could not be read\"}", at: done)
                exit(1)
            }
            log("walk_start", ["steps": "\(steps.count)"])
            var answered = 0
            var viewport: Any = NSNull()
            for step in steps {
                log("step_start", ["id": step.id])
                let before = readyCount
                // A reload, not only a new hash: each step starts on a fresh page,
                // as each browser test does, with nothing left open by the last.
                // A reload has once gone unanswered, so an unanswered one is tried again.
                let attempt = await Self.reloadUntilReady(tries: 2, wait: .seconds(20), poll: .milliseconds(100),
                                                          isReady: { self.readyCount > before }, reload: {
                    self.runScript("location.hash = route; location.reload();", ["route": step.route])
                })
                if let attempt, attempt > 1 { log("step_retried", ["id": step.id, "tries": "\(attempt)"]) }
                guard attempt != nil else {
                    log("step_timeout", ["id": step.id, "waited": "page_ready"])
                    try? Self.keepProbeAnswer("{\"error\":\"the page never said it was ready\"}", at: Self.probeStepFile(listPath, id: step.id, ext: "json"))
                    continue
                }
                try? await Task.sleep(for: .milliseconds(step.delayMs))
                log("eval_start", ["id": step.id])
                let text: String
                do {
                    let value = try await webView.runPageScript(Self.probeScript, arguments: ["extra": step.eval])
                    text = (value as? String) ?? "{}"
                } catch {
                    log("eval_failed", ["id": step.id, "msg": "\"\(error.localizedDescription)\""])
                    try? Self.keepProbeAnswer("{\"error\":\"the question failed in the page\"}", at: Self.probeStepFile(listPath, id: step.id, ext: "json"))
                    continue
                }
                log("eval_done", ["id": step.id])
                if let answer = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any], let seen = answer["viewport"] {
                    viewport = seen
                }
                let page = await Self.pageState(of: webView)
                let (png, _) = await Self.snapshotPNG(of: webView, page: page.size)
                do {
                    try Self.keepProbePicture(png, at: Self.probeStepFile(listPath, id: step.id, ext: "png"))
                    try Self.keepProbeAnswer(text, at: Self.probeStepFile(listPath, id: step.id, ext: "json"))
                    answered += 1
                    log("step_done", ["id": step.id])
                } catch {
                    log("step_unkept", ["id": step.id, "msg": "\"\(error)\""])
                }
            }
            log("walk_done", ["steps": "\(steps.count)", "answered": "\(answered)"])
            let summary: [String: Any] = ["steps": steps.count, "answered": answered, "viewport": viewport]
            let data = (try? JSONSerialization.data(withJSONObject: summary)) ?? Data("{}".utf8)
            do {
                try Self.keepProbeAnswer(String(decoding: data, as: UTF8.self), at: done)
            } catch {
                exit(1)
            }
            exit(0)
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
            #if os(macOS)
            if let wanted = WindowSize.asked(environment["HIFTH_WINDOW_SIZE"]) {
                await fitPage(to: wanted)
            }
            #endif
            try? await Task.sleep(for: .milliseconds(delayMs))
            // A page the system thinks nobody can see stops its fades at the
            // first frame, so its picture shows notes half slid in and chips
            // still blank. Refuse to keep a picture like that.
            let page = await Self.pageState(of: webView)
            #if os(macOS)
            if let wanted = WindowSize.asked(environment["HIFTH_WINDOW_SIZE"]), page.size != wanted {
                print("snapshot refused: the page is \(Int(page.size.width))x\(Int(page.size.height)) but \(Int(wanted.width))x\(Int(wanted.height)) was asked for")
                exit(1)
            }
            #endif
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
    #endif

    #if os(macOS)
    /// Resizes the window until the page inside it is `wanted` points, for the
    /// store's 16:10 Mac screenshots (WindowSize says why the window alone
    /// cannot be trusted). A few tries, since the page settles a frame or two
    /// after the window moves.
    private func fitPage(to wanted: CGSize) async {
        for _ in 0..<4 {
            let page = await Self.pageState(of: webView).size
            guard page != wanted, let window = webView.window else { return }
            let now = window.contentRect(forFrameRect: window.frame).size
            window.setContentSize(WindowSize.window(now, page: page, wanted: wanted))
            try? await Task.sleep(for: .milliseconds(300))
        }
    }

    /// `make app-shot` and `make app-probe` open the Mac app behind the windows
    /// already on screen, so the owner keeps their place. Behind other windows
    /// WebKit calls the page hidden and stops its fades at the first frame, and
    /// the picture shows notes half slid in. Only for those two jobs, and never
    /// in the store build, the web view is told to keep drawing anyway (the
    /// laptop's sandboxed Release copy needs it too, launch item ⑧). WebKit
    /// has no public switch for this; the private one is asked for by name and
    /// skipped if it is not there, so a WebKit without it fails the picture's
    /// own visibility check instead of crashing.
    private func keepDrawingWhileBehindIfAsked(_ webView: WKWebView) {
        #if !STORE
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
            webView.runPageScript("return [document.visibilityState, innerWidth, innerHeight]") { result in
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
    static func snapshotPNG(of webView: WKWebView, page: CGSize) async -> (Data, CGSize) {
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

    #if !STORE
    private func applyAppearanceOverride(_ webView: WKWebView) {
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
    #endif

    private static let missingBundlePage = """
    <!doctype html><meta charset="utf-8"><title>Hifth</title>
    <body style="font: 16px -apple-system, system-ui; padding: 2rem; color: #333">
    <h1>No web build in this app</h1>
    <p>Run <code>make app-web</code> (the pitch build) or <code>make app-web FLAVOUR=public</code>,
    then build the app again.</p>
    """
}

/// Where navigation may go: inside the bundle, out to the system browser, or,
/// for a file the page saves, into a download.
/// A page that opened a new window (`target="_blank"`) also goes out.
final class NavigationPolicy: NSObject, WKNavigationDelegate, WKUIDelegate {
    var onLoaded: () -> Void = {}
    /// Kept here: a download holds its delegate weakly.
    private let downloads = Downloads()

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction
    ) async -> WKNavigationActionPolicy {
        guard let url = navigationAction.request.url else { return .cancel }
        switch Self.decision(for: url, shouldPerformDownload: navigationAction.shouldPerformDownload) {
        case .allow: return .allow
        case .download: return .download
        case .external:
            Sharing.openExternally(url)
            return .cancel
        }
    }

    enum Decision: Equatable { case allow, download, external }

    /// A file the page saves (the bookmarks, a cropped picture) is a `blob:`
    /// address or a link marked to download; it is saved here, not sent to the
    /// system browser, which dropped it (docs/design/native-shell.md, item 31).
    nonisolated static func decision(for url: URL, shouldPerformDownload: Bool) -> Decision {
        if url.scheme == "blob" || shouldPerformDownload { return .download }
        if url.scheme == BundleFiles.scheme || url.scheme == "about" { return .allow }
        return .external
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = downloads
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = downloads
    }

    #if os(macOS)
    /// A page's choose-a-file button (loading bookmarks, adding commentary):
    /// without this the Mac web view opens nothing. The iPad shows its own.
    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo
    ) async -> [URL]? {
        guard let window = webView.window else { return nil }
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        let answer = await panel.beginSheetModal(for: window)
        return answer == .OK ? panel.urls : nil
    }
    #endif

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        onLoaded()
    }

    /// The system ended the process that draws the page (low memory, a fault
    /// inside WebKit). Left alone the view stays blank until the app is quit, so
    /// load the page again; the reader's notes and marks are in the page's own
    /// storage and come back with it (launch item 15). A var so a test can watch.
    var reloadAfterCrash: (WKWebView) -> Void = { $0.reload() }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        AppLog.problem("page_process_ended", message: "loading the page again")
        reloadAfterCrash(webView)
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
        guard opensInAnotherApp(url) else { return }
        openCallback(url)
    }

    /// Only web pages and mail leave for another app. Anything else a link
    /// points at (a file, a script, a phone number, another app's address) is
    /// dropped, so a page can never hand the reader to something unexpected.
    nonisolated static func opensInAnotherApp(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        return scheme == "http" || scheme == "https" || scheme == "mailto"
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
extension UIViewController {
    /// The controller a sheet can be presented from: the top of the stack.
    var presentedOrSelf: UIViewController {
        presentedViewController?.presentedOrSelf ?? self
    }
}
#endif
