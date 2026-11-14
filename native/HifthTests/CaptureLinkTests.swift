import Foundation
import Testing
@testable import Hifth

/// The two links a script on the laptop sends to a build from the laptop:
/// `capture?name=…` keeps a walk capture as if a screenshot had been taken, and
/// `current-to-file` writes where the app is to a file the laptop copies off.
/// A release build refuses both, by name, the way it refuses a check card.
@Suite("Capture links")
@MainActor
struct CaptureLinkTests {
    private func url(_ s: String) throws -> URL { try #require(URL(string: s)) }

    private func action(_ s: String) throws -> XCallback.Action? {
        guard case .request(let r)? = XCallback.parse(try url(s)) else { return nil }
        return r.action
    }

    // MARK: - Reading the link

    @Test("a capture link names its capture; the name is cut down to a safe word")
    func captureName() throws {
        #expect(try action("hifth://x-callback-url/capture?name=Note%20tool") == .capture(name: "note-tool"))
        #expect(try action("hifth://x-callback-url/capture?name=..%2F..%2Fevil") == .capture(name: "evil"))
        #expect(try action("hifth://x-callback-url/capture") == .capture(name: "capture"))
    }

    @Test("current-to-file takes no parameters")
    func currentToFile() throws {
        #expect(try action("hifth://x-callback-url/current-to-file?x-success=a://ok") == .currentToFile)
        #expect(try action("hifth://x-callback-url/Current-To-File/") == .currentToFile)
    }

    // MARK: - Which build does them

    @Test("a release build refuses the laptop's links by name, and does the reader's", arguments: [
        ("hifth://x-callback-url/capture?name=a", "not-in-this-build"),
        ("hifth://x-callback-url/current-to-file", "not-in-this-build"),
        ("hifth://x-callback-url/check?step=Look", "not-in-this-build"),
        ("hifth://x-callback-url/open?page=7", nil),
        ("hifth://x-callback-url/current", nil),
    ])
    func releaseRefuses(_ raw: String, _ code: String?) throws {
        let a = try #require(try action(raw))
        #expect(XCallback.refusal(for: a, laptopBuild: false)?.code == code, Comment(rawValue: raw))
        #expect(XCallback.refusal(for: a, laptopBuild: true) == nil, Comment(rawValue: raw))
        if let failure = XCallback.refusal(for: a, laptopBuild: false) {
            #expect(failure.message.contains("installed from the laptop"))
        }
    }

    @Test("the build these tests run in is a build from the laptop")
    func testsRunInALaptopBuild() {
        #expect(ShellModel.laptopBuild)
    }

    // MARK: - The shell

    final class Seen {
        var opened: [URL] = []
        var captured: [String] = []
        var routeAtCapture: [String] = []
    }

    private func shell(captureReturns: URL? = URL(fileURLWithPath: "/x/walk-captures/20270115-080000")) -> (ShellModel, Seen, URL) {
        let seen = Seen()
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("captures-\(UUID().uuidString)")
        let model = ShellModel(launchRoute: nil, callbackTimeout: .milliseconds(200))
        model.openCallback = { seen.opened.append($0) }
        model.captureStore = CaptureStore(folder: folder)
        model.captureSettle = .zero
        model.captureByLink = { [weak model] name in
            seen.captured.append(name)
            seen.routeAtCapture.append(model?.currentHash ?? "")
            return captureReturns
        }
        return (model, seen, folder)
    }

    /// Lets the shell's own tasks run.
    private func settle() async throws {
        for _ in 0..<20 { await Task.yield() }
        try await Task.sleep(for: .milliseconds(20))
    }

    @Test("a capture link keeps a capture and answers with its folder and the place")
    func captureAnswers() async throws {
        let (model, seen, _) = shell()
        model.receive(.ready)
        model.receive(.route("#/hafs-kfqc/p7"))
        model.open(try url("hifth://x-callback-url/capture?name=note-tool&x-success=a://ok&x-error=a://no"))
        try await settle()
        #expect(seen.captured == ["note-tool"])
        #expect(seen.opened.map(\.absoluteString) == [
            "a://ok?capture=20270115-080000&route=/hafs-kfqc/p7&url=https://blog.bytesofpurpose.com/hifth/%23/hafs-kfqc/p7"
        ])
    }

    @Test("a capture link sent as the app starts waits for the page, then keeps it")
    func captureWaitsForThePage() async throws {
        let (model, seen, _) = shell()
        model.open(try url("hifth://x-callback-url/capture?name=cold&x-success=a://ok"))
        try await settle()
        #expect(seen.captured.isEmpty)
        model.receive(.ready)
        try await settle()
        #expect(seen.captured.isEmpty)
        model.receive(.route("#/hafs-kfqc/p1"))
        try await settle()
        #expect(seen.captured == ["cold"])
        #expect(seen.routeAtCapture == ["#/hafs-kfqc/p1"])
    }

    @Test("a capture sent just after an open waits for that page, not the one before")
    func captureWaitsForTheOpen() async throws {
        let (model, seen, _) = shell()
        model.receive(.ready)
        model.receive(.route("#/hafs-kfqc/p1"))
        model.open(try url("hifth://x-callback-url/open?page=45"))
        model.open(try url("hifth://x-callback-url/capture?name=after-open"))
        try await settle()
        #expect(seen.captured.isEmpty)
        model.receive(.route("#/hafs-kfqc/p45"))
        try await settle()
        #expect(seen.captured == ["after-open"])
        #expect(seen.routeAtCapture == ["#/hafs-kfqc/p45"])
    }

    @Test("an open the page never shows does not hold a capture back for ever")
    func captureAfterAnOpenThatNeverShows() async throws {
        let (model, seen, _) = shell()
        model.receive(.ready)
        model.receive(.route("#/hafs-kfqc/p1"))
        model.open(try url("hifth://x-callback-url/open?page=9999"))
        model.open(try url("hifth://x-callback-url/capture?name=late&x-success=a://ok"))
        try await Task.sleep(for: .milliseconds(500))
        #expect(seen.captured == ["late"])
    }

    @Test("a capture that could not be kept is an error, not silence")
    func captureFails() async throws {
        let (model, seen, _) = shell(captureReturns: nil)
        model.receive(.ready)
        model.receive(.route("#/hafs-kfqc/p7"))
        model.open(try url("hifth://x-callback-url/capture?name=a&x-success=a://ok&x-error=a://no"))
        try await settle()
        #expect(seen.opened.map(\.absoluteString) == [
            "a://no?errorCode=capture-not-kept&errorMessage=the%20app%20could%20not%20keep%20a%20capture"
        ])
    }

    @Test("current-to-file writes where the app is beside the captures, and answers like current")
    func currentToFileWrites() async throws {
        let (model, seen, folder) = shell()
        defer { try? FileManager.default.removeItem(at: folder) }
        model.receive(.ready)
        model.receive(.route("#/hafs-kfqc/2:255"))
        model.open(try url("hifth://x-callback-url/current-to-file?x-success=a://ok"))
        try await settle()
        let data = try Data(contentsOf: folder.appendingPathComponent("current.json"))
        let object = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(object["route"] as? String == "/hafs-kfqc/2:255")
        #expect(object["url"] as? String == "https://blog.bytesofpurpose.com/hifth/#/hafs-kfqc/2:255")
        #expect((object["at"] as? String)?.hasSuffix("Z") == true)
        #expect(seen.opened.map(\.absoluteString) == [
            "a://ok?route=/hafs-kfqc/2:255&url=https://blog.bytesofpurpose.com/hifth/%23/hafs-kfqc/2:255"
        ])
    }

    @Test("current-to-file sent as the app starts waits for the first page")
    func currentToFileWaits() async throws {
        let (model, _, folder) = shell()
        defer { try? FileManager.default.removeItem(at: folder) }
        let file = folder.appendingPathComponent("current.json")
        model.open(try url("hifth://x-callback-url/current-to-file"))
        try await settle()
        #expect(!FileManager.default.fileExists(atPath: file.path))
        model.receive(.ready)
        model.receive(.route("#/hafs-kfqc/p3"))
        try await settle()
        #expect(FileManager.default.fileExists(atPath: file.path))
    }

    @Test("a capture by link raises no note banner and closes none the reader is typing in")
    func captureLeavesTheNoteAlone() async throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("captures-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: folder) }
        let model = ShellModel(launchRoute: nil, callbackTimeout: .milliseconds(200))
        model.captureStore = CaptureStore(folder: folder)
        let typing = folder.appendingPathComponent("20270115-070000", isDirectory: true)
        model.offerNote(for: typing)
        model.captureNoteText = "half a thought"
        #expect(ShellModel.offersNote(trigger: "link") == false)
        #expect(ShellModel.offersNote(trigger: "screenshot") == true)
        #expect(model.captureNote == typing)
        #expect(model.captureNoteText == "half a thought")
    }
}
