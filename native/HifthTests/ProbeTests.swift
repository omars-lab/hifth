import Foundation
import Testing
import WebKit
@testable import Hifth

/// The probe is how a fault only the app shows gets measured from inside it
/// (make app-probe EVAL=…). Its extra question is run in a real web view here.
@Suite("The app probe answers the extra question")
@MainActor
struct ProbeTests {
    private func ask(_ extra: String) async throws -> [String: Any] {
        let webView = WKWebView()
        let value = try await webView.callAsyncJavaScript(
            ShellModel.probeScript, arguments: ["extra": extra], in: nil, contentWorld: .page)
        let text = try #require(value as? String)
        return try #require(try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
    }

    @Test("a question answered at once")
    func answeredAtOnce() async throws {
        #expect(try await ask("6 * 7")["eval"] as? Int == 42)
    }

    // A tap in the page redraws a moment later, so a question that taps and
    // then counts has to wait; the probe printed `{}` for its answer (2026-10-09).
    @Test("a question that waits before it answers")
    func answeredLater() async throws {
        let late = "new Promise(done => setTimeout(() => done(42), 50))"
        #expect(try await ask(late)["eval"] as? Int == 42)
    }

    @Test("a question that fails says why")
    func failureSaysWhy() async throws {
        let late = "Promise.reject(new Error(\"no dialog\"))"
        #expect(try await ask(late)["eval"] as? String == "Error: no dialog")
    }

    // On its side the app is started by a UI test, which cannot read what the
    // app prints, so the answer is also kept in a file the walk reads back.
    @Test("the answer is kept in the file asked for")
    func keptInAFile() throws {
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("probe-\(UUID().uuidString).json").path
        try ShellModel.keepProbeAnswer("{\"eval\":42}", at: path)
        #expect(try String(contentsOfFile: path, encoding: .utf8) == "{\"eval\":42}")
        try FileManager.default.removeItem(atPath: path)
    }

    @Test("with no file asked for, nothing is written")
    func noFileNoWrite() throws {
        try ShellModel.keepProbeAnswer("{}", at: nil)
        try ShellModel.keepProbeAnswer("{}", at: "")
    }

    // The app and the test that starts it work from different folders, so a
    // relative path names two different files and the answer is never found.
    @Test("a path that is not absolute is refused, not written somewhere else")
    func relativePathRefused() throws {
        // From a folder where the relative write would succeed, so the refusal
        // is what stops it, not a missing folder.
        let files = FileManager.default
        let here = files.currentDirectoryPath
        let tmp = files.temporaryDirectory.path
        files.changeCurrentDirectoryPath(tmp)
        defer { files.changeCurrentDirectoryPath(here) }
        let name = "probe-\(UUID().uuidString).json"
        #expect(throws: (any Error).self) {
            try ShellModel.keepProbeAnswer("{}", at: name)
        }
        let strayed = (tmp as NSString).appendingPathComponent(name)
        #expect(!files.fileExists(atPath: strayed))
        try? files.removeItem(atPath: strayed)
    }

    // make app-probe PROBE_SHOT=… keeps a picture of the page as the question
    // left it: the app quits once it answers, so a picture taken after is of
    // the home screen.
    @Test("the picture is kept in the file asked for")
    func pictureKept() throws {
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("probe-\(UUID().uuidString).png").path
        try ShellModel.keepProbePicture(Data([0x89, 0x50, 0x4E, 0x47]), at: path)
        #expect(FileManager.default.contents(atPath: path) == Data([0x89, 0x50, 0x4E, 0x47]))
        try FileManager.default.removeItem(atPath: path)
    }

    @Test("a picture path that is not absolute is refused")
    func relativePicturePathRefused() {
        #expect(throws: ShellModel.ProbePathNotAbsolute.self) {
            try ShellModel.keepProbePicture(Data([1]), at: "probe-\(UUID().uuidString).png")
        }
    }

    // A snapshot that failed hands back no bytes; an empty file where the
    // picture should be would read as a picture nobody could open.
    @Test("an empty picture is refused, not written")
    func emptyPictureRefused() {
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("probe-\(UUID().uuidString).png").path
        #expect(throws: ShellModel.ProbePictureEmpty.self) {
            try ShellModel.keepProbePicture(Data(), at: path)
        }
        #expect(!FileManager.default.fileExists(atPath: path))
    }
}
