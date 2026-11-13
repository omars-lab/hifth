#if DEBUG
import Foundation
#if os(iOS)
import ReplayKit
#endif

/// What happened to a walk capture's five seconds before, as `where.json`
/// says it. Pure, so the Mac tests pin it; the recorder that produces it only
/// runs on a real iPad.
nonisolated enum ClipVideo: Equatable {
    /// `before.mp4` is in the capture's folder.
    case kept
    /// Launched with `HIFTH_WALK_VIDEO=off`, for when the iPad gets warm.
    case off
    /// The simulator has no screen recorder to buffer with.
    case simulator
    /// The Mac app: Apple's keep-the-last-seconds recorder is iPhone and iPad only.
    case notOnThisDevice
    /// The reader said no when iOS asked to record the screen.
    case refused
    /// Screen recording is turned off on this iPad (Screen Time).
    case blocked
    /// Another app, the screen changing size, or the iPad sleeping stopped it.
    case interrupted
    /// The recorder was not running when the screenshot was taken.
    case notRecording
    /// Any other of Apple's errors, by its code.
    case failed(Int)

    /// `nil` when the app should record; otherwise why it does not.
    static func wanted(environment: [String: String], simulator: Bool) -> ClipVideo? {
        if simulator { return .simulator }
        let value = (environment["HIFTH_WALK_VIDEO"] ?? "").lowercased()
        return value == "off" || value == "0" ? .off : nil
    }

    /// Sorts what Apple's recorder answered. The codes are `RPRecordingErrorCode`
    /// (ReplayKit's RPError.h); only that domain's codes mean what they say.
    static func outcome(of error: Error?) -> ClipVideo {
        guard let error else { return .kept }
        let ns = error as NSError
        guard ns.domain == "com.apple.ReplayKit.RPRecordingErrorDomain" else { return .failed(ns.code) }
        switch ns.code {
        case -5801: return .refused
        case -5802: return .blocked
        // Interrupted by another app, by multitasking resizing the app, by the
        // power button.
        case -5806, -5807, -5809: return .interrupted
        default: return .failed(ns.code)
        }
    }

    /// Worth starting the recorder again. A refusal is respected until the app
    /// is launched again: asking straight back would be nagging.
    var tryAgain: Bool { self == .interrupted }

    /// The word written in `where.json`; the laptop's page says it in full.
    var word: String {
        switch self {
        case .kept: "kept"
        case .off: "off"
        case .simulator: "simulator"
        case .notOnThisDevice: "not-on-this-device"
        case .refused: "refused"
        case .blocked: "blocked"
        case .interrupted: "interrupted"
        case .notRecording: "not-recording"
        case .failed(let code): "failed \(code)"
        }
    }
}

#if os(iOS)
/// Apple's keep-the-last-few-seconds recorder (`startClipBuffering`), kept
/// running while the app is in front, with no microphone. A screenshot saves
/// the last five seconds into the capture's folder. Apple replaces this API
/// with a ScreenCaptureKit one in iOS 27; this build is debug only, so that can
/// wait until the iPad runs 27.
@MainActor
final class ClipRecorder {
    static let seconds: TimeInterval = 5
    /// Times an interrupted start is tried again before waiting for the app to
    /// come back to the front.
    private let mostTries = 3

    /// Why it does not record at all, from the launch; `nil` when it does.
    private let notWanted: ClipVideo?
    private var buffering = false
    private var starting = false
    /// The last thing that stopped it, said in `where.json` when a screenshot
    /// finds it not running.
    private var problem: ClipVideo?

    init(environment: [String: String] = ProcessInfo.processInfo.environment) {
        #if targetEnvironment(simulator)
        notWanted = ClipVideo.wanted(environment: environment, simulator: true)
        #else
        notWanted = ClipVideo.wanted(environment: environment, simulator: false)
        #endif
    }

    /// Start buffering, when the app comes to the front. iOS asks the reader
    /// the first time; a refusal or a Screen Time block is not asked again
    /// this launch.
    func start(attempt: Int = 1) {
        guard notWanted == nil, !buffering, !starting else { return }
        if problem == .refused || problem == .blocked { return }
        starting = true
        let recorder = RPScreenRecorder.shared()
        recorder.isMicrophoneEnabled = false
        recorder.startClipBuffering { [weak self] error in
            let outcome = ClipVideo.outcome(of: error)
            Task { @MainActor in
                guard let self else { return }
                self.starting = false
                if outcome == .kept {
                    self.buffering = true
                    self.problem = nil
                    print("walk capture: keeping the last \(Int(Self.seconds)) seconds")
                    return
                }
                self.problem = outcome
                print("walk capture: the recorder did not start (\(outcome.word))")
                if outcome.tryAgain, attempt < self.mostTries {
                    try? await Task.sleep(for: .seconds(2))
                    self.start(attempt: attempt + 1)
                }
            }
        }
    }

    /// Stop buffering, when the app goes to the back; iOS would stop it anyway.
    func stop() {
        guard buffering else { return }
        buffering = false
        RPScreenRecorder.shared().stopClipBuffering { error in
            if let error { print("walk capture: the recorder did not stop cleanly \(error)") }
        }
    }

    /// Save the last five seconds as `before.mp4` in `capture`.
    func export(into capture: URL) async -> ClipVideo {
        if let notWanted { return notWanted }
        guard buffering else { return problem ?? .notRecording }
        let file = capture.appendingPathComponent("before.mp4")
        let outcome: ClipVideo = await withCheckedContinuation { continuation in
            RPScreenRecorder.shared().exportClip(to: file, duration: Self.seconds) { error in
                continuation.resume(returning: ClipVideo.outcome(of: error))
            }
        }
        if outcome != .kept {
            print("walk capture: the five seconds before were not saved (\(outcome.word))")
            if outcome.tryAgain {
                buffering = false
                problem = outcome
                start()
            }
        }
        return outcome
    }
}
#endif
#endif
