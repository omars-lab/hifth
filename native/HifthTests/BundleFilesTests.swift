import Foundation
import Testing
@testable import Hifth

/// The scheme handler serves the copied web build from inside the app bundle.
/// Two things must hold or the app boots to a blank stage: a request never
/// reaches outside the folder, and a module script is served as JavaScript.
@Suite("BundleFiles")
struct BundleFilesTests {
    @Test("the root and a trailing slash serve index.html")
    func index() {
        #expect(BundleFiles.relativePath(forRequestPath: "") == "index.html")
        #expect(BundleFiles.relativePath(forRequestPath: "/") == "index.html")
        #expect(BundleFiles.relativePath(forRequestPath: "/index.html") == "index.html")
        #expect(BundleFiles.relativePath(forRequestPath: "/assets/adj/") == "assets/adj/index.html")
    }

    @Test("paths are canonical and never leave the folder")
    func canonical() {
        #expect(BundleFiles.relativePath(forRequestPath: "/assets/./adj/p001.svg") == "assets/adj/p001.svg")
        #expect(BundleFiles.relativePath(forRequestPath: "/assets/x/../adj/p001.svg") == "assets/adj/p001.svg")
        #expect(BundleFiles.relativePath(forRequestPath: "/../etc/passwd") == nil)
        #expect(BundleFiles.relativePath(forRequestPath: "/assets/../../etc/passwd") == nil)
        #expect(BundleFiles.relativePath(forRequestPath: "/%2e%2e/etc/passwd") == nil)
    }

    @Test("content types the app depends on")
    func mime() {
        #expect(BundleFiles.contentType(forExtension: "js") == "text/javascript; charset=utf-8")
        #expect(BundleFiles.contentType(forExtension: "mjs") == "text/javascript; charset=utf-8")
        #expect(BundleFiles.contentType(forExtension: "html") == "text/html; charset=utf-8")
        #expect(BundleFiles.contentType(forExtension: "css") == "text/css; charset=utf-8")
        #expect(BundleFiles.contentType(forExtension: "json") == "application/json; charset=utf-8")
        #expect(BundleFiles.contentType(forExtension: "svg") == "image/svg+xml; charset=utf-8")
        #expect(BundleFiles.contentType(forExtension: "woff2") == "font/woff2")
        #expect(BundleFiles.contentType(forExtension: "PNG") == "image/png")
        #expect(BundleFiles.contentType(forExtension: "webmanifest") == "application/manifest+json")
        #expect(BundleFiles.contentType(forExtension: "xyz") == "application/octet-stream")
    }

    @Test("a real folder: 200 with bytes, 404 for a missing file, 403 outside")
    func replies() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("hifth-bundle-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        try Data("<html></html>".utf8).write(to: root.appendingPathComponent("index.html"))

        let ok = BundleFiles.reply(for: try #require(URL(string: "hifth-app://app/index.html")), root: root)
        #expect(ok.status == 200)
        #expect(ok.contentType == "text/html; charset=utf-8")
        #expect(ok.data.count == 13)

        let slash = BundleFiles.reply(for: try #require(URL(string: "hifth-app://app/")), root: root)
        #expect(slash.status == 200)

        let missing = BundleFiles.reply(for: try #require(URL(string: "hifth-app://app/nope.js")), root: root)
        #expect(missing.status == 404)

        let escape = BundleFiles.reply(for: try #require(URL(string: "hifth-app://app/../index.html")), root: root)
        #expect(escape.status == 403)
    }
}
