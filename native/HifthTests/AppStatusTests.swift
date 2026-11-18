import Foundation
import Testing
@testable import Hifth

/// The file the app reads at launch (launch item ㉑): what this build makes of it, and that
/// every way it can go wrong leaves the app as it was. The files here are made up; the real
/// one is apps/landing/app-status.json, which the site's own tests read.
@Suite("The status file read at launch")
@MainActor
struct AppStatusTests {
    private func file(_ text: String) -> Data { Data(text.utf8) }

    private let full = """
    {"format": 1,
     "lowest": {"ios": "0.2.0", "macos": "0.1.5"},
     "notice": {"id": "made-up-1", "en": "A made-up notice.", "ar": "اشعار للتجربة", "upTo": "0.3.0"},
     "off": ["pencil", "a-part-from-later"]}
    """

    @Test("reads the lowest versions, the notice and the parts switched off")
    func reads() throws {
        let status = try #require(AppStatus.parse(file(full)))
        #expect(status.lowest == ["ios": "0.2.0", "macos": "0.1.5"])
        #expect(status.notice == .init(id: "made-up-1", english: "A made-up notice.", arabic: "اشعار للتجربة", upTo: "0.3.0"))
        // A name this build does not know is ignored, not an error.
        #expect(status.off == [.pencil])
    }

    @Test("anything that is not a format-1 status file is no file at all")
    func refusesOthers() {
        for text in [
            "", "<!doctype html><title>Not found</title>", "[]", "null", "{}",
            #"{"format": 2, "lowest": {"ios": "9.0.0"}}"#,
            #"{"format": "1"}"#,
        ] {
            #expect(AppStatus.parse(file(text)) == nil, "\(text)")
        }
    }

    @Test("a part it cannot read is dropped and the rest still counts")
    func dropsBadParts() throws {
        let status = try #require(AppStatus.parse(file("""
        {"format": 1, "lowest": {"ios": "one", "macos": "0.1.0"},
         "notice": {"id": "x", "en": "", "ar": "a"}, "off": "pencil"}
        """)))
        #expect(status.lowest == ["macos": "0.1.0"])
        #expect(status.notice == nil)
        #expect(status.off.isEmpty)
    }

    @Test("a version below the lowest asks the reader to update; equal or above does not")
    func tooOld() throws {
        let status = try #require(AppStatus.parse(file(full)))
        #expect(status.verdict(platform: "ios", version: "0.1.9", dismissed: []).tooOld)
        #expect(!status.verdict(platform: "ios", version: "0.2.0", dismissed: []).tooOld)
        #expect(!status.verdict(platform: "ios", version: "0.10.0", dismissed: []).tooOld)
        #expect(!status.verdict(platform: "macos", version: "0.1.5", dismissed: []).tooOld)
        // A platform the file does not name, or a version this build cannot read, is left alone.
        #expect(!status.verdict(platform: "visionos", version: "0.0.1", dismissed: []).tooOld)
        #expect(!status.verdict(platform: "ios", version: "", dismissed: []).tooOld)
    }

    @Test("the notice reaches versions up to its last one, and not once the reader closed it")
    func notice() throws {
        let status = try #require(AppStatus.parse(file(full)))
        #expect(status.verdict(platform: "ios", version: "0.3.0", dismissed: []).notice?.id == "made-up-1")
        #expect(status.verdict(platform: "ios", version: "0.3.1", dismissed: []).notice == nil)
        #expect(status.verdict(platform: "ios", version: "0.2.0", dismissed: ["made-up-1"]).notice == nil)
    }

    @Test("versions compare as numbers, part by part")
    func versions() throws {
        let v = { (s: String) in try #require(AppStatus.Version(s)) }
        #expect(try v("0.9.0") < v("0.10.0"))
        #expect(try v("1.0") == v("1.0.0"))
        #expect(try !(v("1.0.1") < v("1.0.1")))
        for bad in ["", "1..0", "v1", "1.0-beta", "-1.0", "1.2.3.4.5", "١.٠"] {
            #expect(AppStatus.Version(bad) == nil, "\(bad)")
        }
    }

    @Test("a closed notice stays closed")
    func remembersClosed() throws {
        let defaults = try #require(UserDefaults(suiteName: "hifth.status.test.\(UUID())"))
        #expect(AppStatus.dismissed(in: defaults).isEmpty)
        AppStatus.dismiss("made-up-1", in: defaults)
        #expect(AppStatus.dismissed(in: defaults) == ["made-up-1"])
    }

    @Test("the laptop's builds ask nobody unless a test names a file")
    func launchAddress() {
        #expect(AppStatus.launchAddress([:]) == nil)
        #expect(AppStatus.launchAddress(["HIFTH_STATUS_URL": "file:///tmp/made-up.json"])?.isFileURL == true)
    }

    // MARK: - In the shell

    final class Loads { var count = 0 }

    private func model(_ data: Data?, loads: Loads = Loads()) throws -> ShellModel {
        let model = ShellModel(launchRoute: nil)
        model.statusDefaults = try #require(UserDefaults(suiteName: "hifth.status.test.\(UUID())"))
        model.appVersion = "0.1.0"
        model.loadStatus = { loads.count += 1; return data }
        return model
    }

    @Test("the shell reads the file once, after the page is ready, and shows what it says")
    func shellReadsOnce() async throws {
        let loads = Loads()
        let model = try model(file(full), loads: loads)
        #expect(loads.count == 0)
        model.receive(.ready)
        model.receive(.ready)
        await model.statusRead?.value
        #expect(loads.count == 1)
        #expect(model.status.tooOld)
        #expect(model.status.notice?.id == "made-up-1")
        #expect(model.status.off == [.pencil])
    }

    @Test("no file, or a page that is not the file, leaves the shell as it was")
    func shellCarriesOn() async throws {
        for data in [nil, file("<html>Not found</html>")] {
            let model = try model(data)
            model.receive(.ready)
            await model.statusRead?.value
            #expect(model.status == AppStatus.Verdict())
        }
    }

    @Test("closing the notice keeps it closed on the next launch")
    func closeNotice() async throws {
        let model = try model(file(full))
        model.receive(.ready)
        await model.statusRead?.value
        model.closeNotice()
        #expect(model.status.notice == nil)

        let next = ShellModel(launchRoute: nil)
        next.statusDefaults = model.statusDefaults
        next.appVersion = "0.1.0"
        next.loadStatus = { self.file(full) }
        next.receive(.ready)
        await next.statusRead?.value
        #expect(next.status.notice == nil)
        #expect(next.status.tooOld)
    }

    @Test("with links switched off, a link from another app turns no page")
    func linksOff() async throws {
        let model = try model(file(#"{"format": 1, "off": ["links"]}"#))
        model.receive(.ready)
        await model.statusRead?.value
        var scripts: [String] = []
        model.runScript = { source, _ in scripts.append(source) }
        model.open(try #require(URL(string: "hifth://hafs-kfqc/2:255")))
        #expect(scripts.isEmpty)
    }
}
