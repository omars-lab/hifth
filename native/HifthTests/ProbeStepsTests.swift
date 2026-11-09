import Foundation
import Testing
@testable import Hifth

/// The pitch walk hands the app a list of steps when it starts (make pitch-walk),
/// so one start of the app, turned on its side once, walks every step instead of
/// one start per step. These are the parts of that list the app reads and writes.
@Suite("The app walks a list of steps")
struct ProbeStepsTests {
    private func file(_ text: String) throws -> String {
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("steps-\(UUID().uuidString).json").path
        try Data(text.utf8).write(to: URL(fileURLWithPath: path))
        return path
    }

    @Test("reads each step's passage, wait and question, in order")
    func readsTheSteps() throws {
        let path = try file(#"[{"id":"s01","route":"/hafs-kfqc/p42","delayMs":500,"eval":"1"},{"id":"s03","route":"/hafs-kfqc/2:255","eval":"2"}]"#)
        defer { try? FileManager.default.removeItem(atPath: path) }
        let steps = try ShellModel.probeSteps(at: path)
        #expect(steps.map(\.id) == ["s01", "s03"])
        #expect(steps[0].route == "/hafs-kfqc/p42")
        #expect(steps[0].delayMs == 500)
        // A step that names no wait gets the same two seconds a single probe does.
        #expect(steps[1].delayMs == 2000)
        #expect(steps[1].eval == "2")
    }

    // The app and the walk that reads its answers start in different folders.
    @Test("a list named by a path that is not absolute is refused")
    func relativeListRefused() {
        #expect(throws: ShellModel.ProbePathNotAbsolute.self) {
            try ShellModel.probeSteps(at: "steps.json")
        }
    }

    // A step's name becomes its file's name; one that climbs out of the folder
    // would write the answer somewhere the walk never looks.
    @Test("a step whose name is not a plain file name is refused")
    func badNamesRefused() throws {
        for bad in ["", "../s01", "a/b", ".hidden"] {
            let path = try file(#"[{"id":"\#(bad)","route":"/x","eval":"1"}]"#)
            defer { try? FileManager.default.removeItem(atPath: path) }
            #expect(throws: ShellModel.ProbeStepNameNotPlain.self) {
                try ShellModel.probeSteps(at: path)
            }
        }
    }

    @Test("two steps with one name are refused, so one answer does not overwrite the other")
    func repeatedNameRefused() throws {
        let path = try file(#"[{"id":"s01","route":"/x","eval":"1"},{"id":"s01","route":"/y","eval":"2"}]"#)
        defer { try? FileManager.default.removeItem(atPath: path) }
        #expect(throws: ShellModel.ProbeStepNameNotPlain.self) {
            try ShellModel.probeSteps(at: path)
        }
    }

    @Test("each step's answer and picture sit beside the list")
    func filesBesideTheList() {
        #expect(ShellModel.probeStepFile("/tmp/walk/steps.json", id: "s03", ext: "json") == "/tmp/walk/s03.json")
        #expect(ShellModel.probeStepFile("/tmp/walk/steps.json", id: "s03", ext: "png") == "/tmp/walk/s03.png")
    }

    // The walk is watched by reading its log (ev= lines), not by guessing.
    @Test("a log line carries the time, the app's process and the event")
    func logLine() {
        let at = Date(timeIntervalSince1970: 1_762_682_400) // 2025-11-09 10:00:00 UTC
        let line = ShellModel.walkLogLine("step_done", ["id": "s03", "ok": "yes"], at: at, pid: 42)
        #expect(line == "2025-11-09T10:00:00Z pid=42 ev=step_done id=s03 ok=yes")
    }

    // A reload once went unanswered on the iPad simulator (step 13, 2026-11-09):
    // the page never said it was ready, though the same step passed the run before.
    // A second reload is cheaper than failing a step that is not broken.
    @Test("a reload the page never answers is tried again")
    @MainActor func unansweredReloadIsRetried() async {
        var reloads = 0
        var ready = false
        let attempt = await ShellModel.reloadUntilReady(tries: 2, wait: .milliseconds(50), poll: .milliseconds(5),
                                                        isReady: { ready }, reload: {
            reloads += 1
            if reloads == 2 { ready = true } // the first reload is lost
        })
        #expect(attempt == 2)
        #expect(reloads == 2)
    }

    @Test("a page that never answers gives up after the last try")
    @MainActor func neverReadyGivesUp() async {
        var reloads = 0
        let attempt = await ShellModel.reloadUntilReady(tries: 2, wait: .milliseconds(20), poll: .milliseconds(5),
                                                        isReady: { false }, reload: { reloads += 1 })
        #expect(attempt == nil)
        #expect(reloads == 2)
    }
}
