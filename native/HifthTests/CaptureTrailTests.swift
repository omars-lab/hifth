import Foundation
import Testing
@testable import Hifth

/// The trail: the last ten seconds of touches, Pencil strokes and page moves,
/// kept in memory and written beside a capture as `trail.jsonl`, one line per
/// event, so a fault seen once can be followed back to what led to it.
@Suite("Walk capture: the last ten seconds")
struct CaptureTrailTests {
    private func at(_ seconds: Double) -> Date { Date(timeIntervalSince1970: 1_800_000_000 + seconds) }

    @Test("it keeps exactly the last ten seconds before the capture")
    func lastTenSeconds() {
        var trail = CaptureTrail(window: 10)
        trail.add(.route("#/hafs-kfqc/p1"), at: at(0))
        trail.add(.touch(phase: "began", x: 10, y: 20), at: at(4.9))
        trail.add(.touch(phase: "ended", x: 12, y: 21), at: at(5))
        trail.add(.route("#/hafs-kfqc/p2"), at: at(14))
        let kept = trail.events(before: at(15))
        #expect(kept.map(\.kind) == ["touch", "route"], "4.9 s is over ten seconds before 15; 5 s is exactly ten")
        #expect(kept.first?.phase == "ended")
    }

    @Test("nothing after the capture gets in, even if it was added before the trail was read")
    func nothingAfter() {
        var trail = CaptureTrail(window: 10)
        trail.add(.route("#/a"), at: at(1))
        trail.add(.route("#/b"), at: at(3))
        #expect(trail.events(before: at(2)).map(\.route) == ["/a"])
    }

    @Test("it forgets what is older than its window, so it never grows past it")
    func forgets() {
        var trail = CaptureTrail(window: 10)
        for s in 0..<1_000 { trail.add(.touch(phase: "moved", x: 0, y: 0), at: at(Double(s) * 0.1)) }
        #expect(trail.count <= 102, "about ten seconds of events at ten a second, not a thousand")
    }

    @Test("each line says what happened, when, and how long before the capture")
    func lines() throws {
        var trail = CaptureTrail(window: 10)
        trail.add(.pencil(phase: "began", x: 100.5, y: 200, force: 0.5), at: at(8.25))
        trail.add(.route("#/hafs-kfqc/p7"), at: at(9))
        let text = String(decoding: trail.jsonl(before: at(10)), as: UTF8.self)
        let lines = text.split(separator: "\n").map(String.init)
        #expect(lines.count == 2)
        let first = try #require(try JSONSerialization.jsonObject(with: Data(lines[0].utf8)) as? [String: Any])
        #expect(first["kind"] as? String == "pencil")
        #expect(first["phase"] as? String == "began")
        #expect(first["x"] as? Double == 100.5)
        #expect(first["force"] as? Double == 0.5)
        #expect(first["at"] as? String == "2027-01-15T08:00:08.250Z")
        #expect(first["before"] as? Double == 1.75, "seconds before the capture")
        let second = try #require(try JSONSerialization.jsonObject(with: Data(lines[1].utf8)) as? [String: Any])
        #expect(second["route"] as? String == "/hafs-kfqc/p7")
        #expect(second["x"] == nil, "a page move has no place on the screen")
    }

    @Test("an empty trail writes an empty file, not a broken one")
    func empty() {
        #expect(CaptureTrail(window: 10).jsonl(before: at(0)).isEmpty)
    }
}
