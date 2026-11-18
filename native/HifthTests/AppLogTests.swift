import Foundation
import Testing
@testable import Hifth

/// Launch item 19: the shell writes to the system's own log instead of bare
/// prints, and every line says which version and which build it came from, so
/// a line from a reader's device (in a crash report, or read off a test iPad)
/// can be matched to the code that wrote it.
@Suite("The app's own log")
struct AppLogTests {
    let build = AppLog.Build(version: "0.1.0 (7)", commit: "abc1234")

    @Test("a line starts with the event, then the version and the build")
    func lineShape() {
        let line = AppLog.line("launch", ["platform": "ios"], build: build)
        #expect(line == "ev=launch version=0.1.0_(7) commit=abc1234 platform=ios")
    }

    @Test("a message goes last, quoted, so a line stays one line that can be searched")
    func message() {
        let line = AppLog.line("sound_setup_failed", message: "the \"session\" said no\nsecond line", build: build)
        #expect(line == "ev=sound_setup_failed version=0.1.0_(7) commit=abc1234 msg=\"the 'session' said no second line\"")
    }

    @Test("the other fields come in name order, with no spaces in a value")
    func fieldOrder() {
        let line = AppLog.line("sound", ["mode": "Spoken Audio", "category": "Playback"], build: build)
        #expect(line.hasSuffix("category=Playback mode=Spoken_Audio"))
    }

    @Test("the build is read from the stamp the copy step leaves beside the web files")
    func readsBuild() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("applog-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        try "def5678\n".write(to: folder.appendingPathComponent(".hifth-web-commit"), atomically: true, encoding: .utf8)

        let read = AppLog.Build.read(info: ["CFBundleShortVersionString": "0.2.0", "CFBundleVersion": "3"], webRoot: folder)
        #expect(read.version == "0.2.0 (3)")
        #expect(read.commit == "def5678")
    }

    @Test("a build with no stamp and no version says so, rather than leaving the fields out")
    func unknownBuild() {
        let read = AppLog.Build.read(info: [:], webRoot: nil)
        #expect(AppLog.line("launch", build: read) == "ev=launch version=unknown commit=unknown")
    }
}
