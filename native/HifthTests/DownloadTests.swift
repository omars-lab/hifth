import Foundation
import Testing
@testable import Hifth

/// A file the page saves (the bookmarks, a cropped picture) arrives as a
/// download of a `blob:` address. Sent to the system browser it was dropped,
/// so nothing was ever saved in the apps (docs/design/native-shell.md, item 31).
@Suite("Downloads")
@MainActor
struct DownloadTests {
    @Test("a file the page saves is downloaded, not sent to the browser")
    func blobIsDownloaded() {
        let blob = URL(string: "blob:hifth-app://app/3f2a")!
        #expect(NavigationPolicy.decision(for: blob, shouldPerformDownload: true) == .download)
        #expect(NavigationPolicy.decision(for: blob, shouldPerformDownload: false) == .download)
    }

    @Test("a link marked to download from the bundle is downloaded")
    func bundleDownload() {
        let file = URL(string: "hifth-app://app/assets/x.json")!
        #expect(NavigationPolicy.decision(for: file, shouldPerformDownload: true) == .download)
        #expect(NavigationPolicy.decision(for: file, shouldPerformDownload: false) == .allow)
    }

    @Test("the web still goes out to the browser")
    func webGoesOut() {
        let web = URL(string: "https://example.com/")!
        #expect(NavigationPolicy.decision(for: web, shouldPerformDownload: false) == .external)
        #expect(NavigationPolicy.decision(for: URL(string: "about:blank")!, shouldPerformDownload: false) == .allow)
    }

    @Test("the save window offers the page's own name, kept to its last part")
    func offeredName() {
        #expect(Downloads.safeName("hifth-bookmarks.json") == "hifth-bookmarks.json")
        #expect(Downloads.safeName("../x.json") == "x.json")
        #expect(Downloads.safeName("") == "download")
        #expect(Downloads.safeName("..") == "download")
    }

    @Test("a file saved on the iPad is written first under a name not yet taken")
    func freeName() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let first = Downloads.freeDestination(in: folder, suggested: "hifth-bookmarks.json")
        #expect(first.lastPathComponent == "hifth-bookmarks.json")
        try Data().write(to: first)
        #expect(Downloads.freeDestination(in: folder, suggested: "hifth-bookmarks.json").lastPathComponent == "hifth-bookmarks 2.json")
        #expect(Downloads.freeDestination(in: folder, suggested: "").lastPathComponent == "download")
        #expect(Downloads.freeDestination(in: folder, suggested: "../x.json").lastPathComponent == "x.json")
    }
}
