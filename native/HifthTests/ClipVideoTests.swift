import Foundation
import Testing
@testable import Hifth

/// Walk capture's five seconds before: Apple's recorder keeps the last few
/// seconds of the screen, and a screenshot saves them as `before.mp4`. The
/// recorder itself only runs on a real iPad, so these pin what the app decides
/// around it: when it records at all, which of Apple's errors are worth trying
/// again, and what `where.json` says about the video.
@Suite("Walk capture: the five seconds before")
struct ClipVideoTests {
    @Test("it records unless switched off, and never on the simulator")
    func whenItRecords() {
        #expect(ClipVideo.wanted(environment: [:], simulator: false) == nil)
        #expect(ClipVideo.wanted(environment: ["HIFTH_WALK_VIDEO": "on"], simulator: false) == nil)
        #expect(ClipVideo.wanted(environment: ["HIFTH_WALK_VIDEO": "off"], simulator: false) == .off)
        #expect(ClipVideo.wanted(environment: ["HIFTH_WALK_VIDEO": "OFF"], simulator: false) == .off)
        #expect(ClipVideo.wanted(environment: ["HIFTH_WALK_VIDEO": "0"], simulator: false) == .off)
        #expect(ClipVideo.wanted(environment: [:], simulator: true) == .simulator)
    }

    @Test("Apple's errors are sorted into refused, blocked, interrupted and other")
    func sortsErrors() {
        func error(_ code: Int) -> NSError { NSError(domain: "com.apple.ReplayKit.RPRecordingErrorDomain", code: code) }
        #expect(ClipVideo.outcome(of: nil) == .kept)
        #expect(ClipVideo.outcome(of: error(-5801)) == .refused)
        #expect(ClipVideo.outcome(of: error(-5802)) == .blocked)
        #expect(ClipVideo.outcome(of: error(-5806)) == .interrupted)
        #expect(ClipVideo.outcome(of: error(-5807)) == .interrupted)
        #expect(ClipVideo.outcome(of: error(-5809)) == .interrupted)
        #expect(ClipVideo.outcome(of: error(-5804)) == .failed(-5804))
        #expect(ClipVideo.outcome(of: NSError(domain: "somewhere-else", code: -5801)) == .failed(-5801),
                "only Apple's recorder's own codes mean refused")
    }

    @Test("only an interruption is tried again; a refusal is respected until the next launch")
    func whatIsTriedAgain() {
        #expect(ClipVideo.interrupted.tryAgain)
        #expect(!ClipVideo.refused.tryAgain)
        #expect(!ClipVideo.blocked.tryAgain)
        #expect(!ClipVideo.failed(-5804).tryAgain)
        #expect(!ClipVideo.off.tryAgain)
    }

    @Test("where.json says what happened to the video, in one short word each")
    func wordsInWhere() {
        #expect(ClipVideo.kept.word == "kept")
        #expect(ClipVideo.off.word == "off")
        #expect(ClipVideo.simulator.word == "simulator")
        #expect(ClipVideo.notOnThisDevice.word == "not-on-this-device")
        #expect(ClipVideo.refused.word == "refused")
        #expect(ClipVideo.blocked.word == "blocked")
        #expect(ClipVideo.interrupted.word == "interrupted")
        #expect(ClipVideo.notRecording.word == "not-recording")
        #expect(ClipVideo.failed(-5804).word == "failed -5804")
    }

    @Test("where.json carries the video's word, and null until the video is settled")
    func videoInWhere() throws {
        func json(_ video: ClipVideo?) throws -> [String: Any] {
            let place = CaptureWhere(
                at: Date(timeIntervalSince1970: 1_800_000_000), trigger: "screenshot", route: "#/hafs-kfqc/p7",
                answer: nil, screen: .init(width: 1180, height: 820, scale: 2, orientation: "sideways"),
                build: .init(commit: "abc1234", flavour: "public"), video: video
            )
            return try #require(try JSONSerialization.jsonObject(with: place.json()) as? [String: Any])
        }
        #expect(try json(nil)["video"] is NSNull)
        #expect(try json(.refused)["video"] as? String == "refused")
        #expect(try json(.kept)["video"] as? String == "kept")
    }
}
