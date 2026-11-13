#if DEBUG
import Foundation
import WebKit
#if os(iOS)
import UIKit
#endif

/// Taking a walk capture: when the reader takes a screenshot (the two buttons,
/// or the Pencil's corner swipe), the app keeps its own picture of the page,
/// the last ten seconds of what they did and where they were, then offers a
/// note. Only in a build from the laptop; `make walk-pull` copies them off.
///
/// iOS does not hand the system screenshot to the app, so the picture is the
/// app's own, of the page only: the note banner and other native pieces are
/// not in it.
extension ShellModel {
    /// Start listening, once, when the page first says it is ready. Never
    /// earlier: building the web view while iPadOS is still starting the app
    /// is what closed it on iPadOS 18.5.
    func startWalkCaptureOnce() {
        guard !walkCaptureStarted else { return }
        walkCaptureStarted = true
        #if os(iOS)
        walkCaptureObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.userDidTakeScreenshotNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                Task { await self.captureWalk(trigger: "screenshot") }
            }
        }
        if webViewBuilt, let window = webView.window {
            let recorder = TouchTrailRecorder { [weak self] happening in self?.noteOnTrail(happening) }
            window.addGestureRecognizer(recorder)
            touchTrailRecorder = recorder
        } else {
            print("walk capture: no window yet, so touches are not on the trail")
        }
        startClipRecorder()
        #endif
        captureAtLaunchIfAsked()
    }

    #if os(iOS)
    /// Keep the last few seconds while the app is in front. iOS stops any
    /// recording when the app goes to the back, so it is stopped there and
    /// started again on the way back.
    private func startClipRecorder() {
        let recorder = ClipRecorder()
        clipRecorder = recorder
        recorder.start()
        let center = NotificationCenter.default
        clipObservers = [
            center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
                MainActor.assumeIsolated { recorder.start() }
            },
            center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { _ in
                MainActor.assumeIsolated { recorder.stop() }
            },
        ]
    }
    #endif

    /// Save the five seconds before into `capture`, or say why not.
    private func keepClip(in capture: URL) async -> ClipVideo {
        #if os(iOS)
        guard let clipRecorder else { return .notRecording }
        return await clipRecorder.export(into: capture)
        #else
        return .notOnThisDevice
        #endif
    }

    /// One capture. Returns its folder, or `nil` when nothing could be kept.
    @discardableResult
    func captureWalk(trigger: String) async -> URL? {
        guard webViewBuilt else { return nil }
        // Everything up to `begin` happens with no waiting, so the trail ends
        // at the screenshot and a page that never answers still leaves a capture.
        let now = Date()
        let trail = captureTrail.jsonl(before: now)
        let route = currentHash
        let screen = Self.captureScreen(of: webView)
        let build = BundleFiles.root.map(CaptureWhere.Build.read(from:)) ?? CaptureWhere.Build(commit: "unknown", flavour: "unknown")
        let store = captureStore
        let capture: URL
        do {
            capture = try store.begin(
                place: CaptureWhere(at: now, trigger: trigger, route: route, answer: nil, screen: screen, build: build),
                trail: trail
            )
        } catch {
            print("walk capture not kept \(error)")
            return nil
        }
        offerNote(for: capture)
        // Asked for first, before the picture: every moment waited here is a
        // moment after the screenshot that the five seconds no longer cover.
        async let clip = keepClip(in: capture)

        let (png, _) = await Self.snapshotPNG(of: webView, page: webView.bounds.size)
        do {
            if try !store.keepPicture(png, in: capture) { print("walk capture: the picture came back empty") }
        } catch {
            print("walk capture picture not kept \(error)")
        }

        // Written again once the page and the video are settled, whatever
        // they said, so where.json always says what happened to the video.
        let answer = await askPageWhere(route: route)
        let video = await clip
        let place = CaptureWhere(at: now, trigger: trigger, route: route, answer: answer, screen: screen, build: build, video: video)
        do {
            try store.write(place.json(), named: "where.json", in: capture)
        } catch {
            print("walk capture where.json not updated \(error)")
        }
        print("walk capture kept \(capture.lastPathComponent)")
        return capture
    }

    /// The page's answer, or `nil` if it does not come within the time allowed.
    private func askPageWhere(route: String) async -> CaptureWhere.PageAnswer? {
        let once = AnswerOnce()
        return await withCheckedContinuation { continuation in
            once.continuation = continuation
            webView.runPageScript(CapturePage.script, arguments: CapturePage.arguments(route: route)) { result in
                once.resume((try? result.get() as? String).flatMap(CaptureWhere.PageAnswer.init(json:)))
            }
            Task {
                try? await Task.sleep(for: CapturePage.timeout)
                once.resume(nil)
            }
        }
    }

    private static func captureScreen(of webView: WKWebView) -> CaptureWhere.Screen {
        let size = webView.bounds.size
        #if os(iOS)
        let scale = Double(webView.traitCollection.displayScale)
        #else
        let scale = Double(webView.window?.backingScaleFactor ?? 1)
        #endif
        return .init(
            width: Double(size.width), height: Double(size.height), scale: scale,
            orientation: size.width > size.height ? "sideways" : "upright"
        )
    }

    /// With `HIFTH_WALK_CAPTURE_AT_START` set to a folder, take one capture
    /// there once the page has settled, as if a screenshot had been taken. How
    /// the simulator test proves a capture is whole without pressing buttons.
    private func captureAtLaunchIfAsked() {
        let environment = ProcessInfo.processInfo.environment
        guard let path = environment["HIFTH_WALK_CAPTURE_AT_START"], !path.isEmpty else { return }
        captureStore = CaptureStore(folder: URL(fileURLWithPath: path, isDirectory: true))
        let delayMs = Int(environment["HIFTH_SNAPSHOT_DELAY_MS"] ?? "") ?? 1500
        Task {
            try? await Task.sleep(for: .milliseconds(delayMs))
            await captureWalk(trigger: "launch")
        }
    }
}

/// Hands the page's answer back once: whichever comes first, the answer or
/// the time running out.
private final class AnswerOnce {
    var continuation: CheckedContinuation<CaptureWhere.PageAnswer?, Never>?

    func resume(_ answer: CaptureWhere.PageAnswer?) {
        continuation?.resume(returning: answer)
        continuation = nil
    }
}

#if os(iOS)
/// Watches every touch in the window for the trail, and never takes one: it
/// never moves past "possible", so it can never win a touch, delay one, or
/// cancel one the page is using.
final class TouchTrailRecorder: UIGestureRecognizer, UIGestureRecognizerDelegate {
    private let record: (CaptureTrail.Happening) -> Void
    private var lastMoved = Date.distantPast
    /// Moves are kept at most this often, so a long stroke stays a short list.
    private let moveEvery: TimeInterval = 0.05

    init(record: @escaping (CaptureTrail.Happening) -> Void) {
        self.record = record
        super.init(target: nil, action: nil)
        cancelsTouchesInView = false
        delaysTouchesBegan = false
        delaysTouchesEnded = false
        delegate = self
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) { keep(touches, "began") }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        let now = Date()
        guard now.timeIntervalSince(lastMoved) >= moveEvery else { return }
        lastMoved = now
        keep(touches, "moved")
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) { keep(touches, "ended") }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) { keep(touches, "cancelled") }

    private func keep(_ touches: Set<UITouch>, _ phase: String) {
        for touch in touches {
            let point = touch.location(in: view)
            let x = (Double(point.x) * 10).rounded() / 10
            let y = (Double(point.y) * 10).rounded() / 10
            if touch.type == .pencil {
                record(.pencil(phase: phase, x: x, y: y, force: (Double(touch.force) * 100).rounded() / 100))
            } else {
                record(.touch(phase: phase, x: x, y: y))
            }
        }
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        true
    }
}
#endif
#endif
