import Foundation
import Testing
@testable import Hifth

/// Walk capture: in a build from the laptop, a screenshot on the iPad keeps a
/// folder of its own in the app's `Documents/walk-captures/`: the picture,
/// where the reader was, the last ten seconds of what they did, and a note.
/// These pin the folders (named by time, the oldest dropped past a limit) and
/// the record of where the reader was. Every value here is made up.
@Suite("Walk capture: the folders and where you were")
struct CaptureStoreTests {
    private func temporary() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("walk-captures-\(UUID().uuidString)", isDirectory: true)
    }

    private func names(_ folder: URL) throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: folder.path).sorted()
    }

    /// 2027-01-15T08:00:00Z, and `seconds` after it.
    private func at(_ seconds: Double = 0) -> Date { Date(timeIntervalSince1970: 1_800_000_000 + seconds) }

    @Test("a capture's folder is named by the time it was taken, in UTC")
    func namedByTime() throws {
        let folder = temporary()
        defer { try? FileManager.default.removeItem(at: folder) }
        let capture = try CaptureStore(folder: folder).newCapture(at: at())
        #expect(capture.lastPathComponent == "20270115-080000")
        #expect(FileManager.default.fileExists(atPath: capture.path))
    }

    @Test("two captures in the same second get their own folders")
    func sameSecond() throws {
        let folder = temporary()
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = CaptureStore(folder: folder)
        let first = try store.newCapture(at: at())
        let second = try store.newCapture(at: at(0.4))
        let third = try store.newCapture(at: at(0.9))
        #expect([first, second, third].map(\.lastPathComponent) == ["20270115-080000", "20270115-080000-2", "20270115-080000-3"])
    }

    @Test("past the most captures it keeps, the oldest go first")
    func dropsOldestByCount() throws {
        let folder = temporary()
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = CaptureStore(folder: folder, mostCaptures: 3, mostBytes: 1_000_000)
        for s in 0..<5 { _ = try store.newCapture(at: at(Double(s))) }
        let dropped = try store.trim()
        #expect(dropped == ["20270115-080000", "20270115-080001"])
        #expect(try names(folder) == ["20270115-080002", "20270115-080003", "20270115-080004"])
    }

    @Test("past the most bytes it keeps, the oldest go first")
    func dropsOldestBySize() throws {
        let folder = temporary()
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = CaptureStore(folder: folder, mostCaptures: 100, mostBytes: 2_500)
        for s in 0..<4 {
            let capture = try store.newCapture(at: at(Double(s)))
            try store.write(Data(count: 1_000), named: "picture.png", in: capture)
        }
        try store.trim()
        #expect(try names(folder) == ["20270115-080002", "20270115-080003"])
    }

    @Test("oldest means the earliest time in the name, not the file's date, and -10 comes after -9")
    func oldestByName() throws {
        let folder = temporary()
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = CaptureStore(folder: folder, mostCaptures: 2, mostBytes: 1_000_000)
        // Made in the wrong order: the file dates say the later one is older.
        _ = try store.newCapture(at: at(5))
        _ = try store.newCapture(at: at(0))
        for name in ["20270115-080000-9", "20270115-080000-10"] {
            try FileManager.default.createDirectory(at: folder.appendingPathComponent(name), withIntermediateDirectories: true)
        }
        try store.trim()
        #expect(try names(folder) == ["20270115-080000-10", "20270115-080005"])
    }

    @Test("a capture still being written is never dropped, even when it is the oldest")
    func keepsTheOneInHand() throws {
        let folder = temporary()
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = CaptureStore(folder: folder, mostCaptures: 1, mostBytes: 1_000_000)
        let open = try store.newCapture(at: at(0))
        _ = try store.newCapture(at: at(1))
        try store.trim(keeping: [open.lastPathComponent])
        #expect(try names(folder) == ["20270115-080000"])
    }

    @Test("anything in the folder that is not a capture is left alone")
    func leavesOtherFiles() throws {
        let folder = temporary()
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = CaptureStore(folder: folder, mostCaptures: 1, mostBytes: 1_000_000)
        _ = try store.newCapture(at: at(0))
        _ = try store.newCapture(at: at(1))
        try Data("x".utf8).write(to: folder.appendingPathComponent(".DS_Store"))
        try store.trim()
        #expect(try names(folder) == [".DS_Store", "20270115-080001"])
    }

    @Test("where you were is written with every field, even the ones the page could not say")
    func whereHasEveryField() throws {
        let place = CaptureWhere(
            at: at(),
            trigger: "screenshot",
            route: "#/hafs-kfqc/p7",
            page: nil,
            verse: nil,
            open: [],
            settings: [:],
            screen: .init(width: 1180, height: 820, scale: 2, orientation: "sideways"),
            build: .init(commit: "abc1234", flavour: "public"),
            pageAnswered: false
        )
        let json = try #require(try JSONSerialization.jsonObject(with: place.json()) as? [String: Any])
        #expect(Set(json.keys) == ["at", "trigger", "route", "page", "verse", "open", "settings", "screen", "build", "pageAnswered"])
        #expect(json["at"] as? String == "2027-01-15T08:00:00Z")
        #expect(json["route"] as? String == "/hafs-kfqc/p7", "written as callers write it, without the #")
        #expect(json["page"] is NSNull)
        #expect(json["verse"] is NSNull)
        let screen = try #require(json["screen"] as? [String: Any])
        #expect(screen["orientation"] as? String == "sideways")
        let build = try #require(json["build"] as? [String: Any])
        #expect(build["commit"] as? String == "abc1234")
    }

    @Test("what the page says about itself is read into where you were")
    func readsThePage() throws {
        let answer = """
        {"page":7,"verse":"2:255","open":["drawer","same-roots"],"settings":{"hifth.drawer-tools":"drawer","hifth.theme":"dark"}}
        """
        let page = try #require(CaptureWhere.PageAnswer(json: answer))
        #expect(page.page == 7)
        #expect(page.verse == "2:255")
        #expect(page.open == ["drawer", "same-roots"])
        #expect(page.settings["hifth.theme"] == "dark")
        #expect(CaptureWhere.PageAnswer(json: "not json") == nil)
        #expect(CaptureWhere.PageAnswer(json: "{}") == CaptureWhere.PageAnswer(page: nil, verse: nil, open: [], settings: [:]))
    }

    private func place(answered: Bool, at date: Date) -> CaptureWhere {
        CaptureWhere(
            at: date, trigger: "screenshot", route: "#/hafs-kfqc/p7",
            answer: answered ? .init(page: 7, verse: nil, open: ["drawer"], settings: [:]) : nil,
            screen: .init(width: 1180, height: 820, scale: 2, orientation: "sideways"),
            build: .init(commit: "abc1234", flavour: "public")
        )
    }

    @Test("a capture is kept straight away with its trail, even before the page answers")
    func beginsWithoutThePage() throws {
        let folder = temporary()
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = CaptureStore(folder: folder)
        let capture = try store.begin(place: place(answered: false, at: at()), trail: Data("{\"kind\":\"touch\"}\n".utf8))
        let json = try #require(try JSONSerialization.jsonObject(with: Data(contentsOf: capture.appendingPathComponent("where.json"))) as? [String: Any])
        #expect(json["pageAnswered"] as? Bool == false)
        #expect(try String(contentsOf: capture.appendingPathComponent("trail.jsonl"), encoding: .utf8) == "{\"kind\":\"touch\"}\n")
        // The page answers later: where.json is written again, now with the page.
        try store.write(place(answered: true, at: at()).json(), named: "where.json", in: capture)
        let again = try #require(try JSONSerialization.jsonObject(with: Data(contentsOf: capture.appendingPathComponent("where.json"))) as? [String: Any])
        #expect(again["page"] as? Int == 7)
    }

    @Test("starting a capture drops the oldest past the limit, never the new one")
    func beginTrims() throws {
        let folder = temporary()
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = CaptureStore(folder: folder, mostCaptures: 2, mostBytes: 1_000_000)
        for s in 1...3 { _ = try store.begin(place: place(answered: false, at: at(Double(s))), trail: Data()) }
        // Made at the earliest time, so by name it is the oldest of all.
        let newest = try store.begin(place: place(answered: false, at: at(0)), trail: Data())
        #expect(try names(folder).contains(newest.lastPathComponent))
        #expect(try names(folder).count == 2)
    }

    @Test("a picture that came back empty is not kept as a file nobody can open")
    func emptyPicture() throws {
        let folder = temporary()
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = CaptureStore(folder: folder)
        let capture = try store.begin(place: place(answered: false, at: at()), trail: Data())
        #expect(try store.keepPicture(Data(), in: capture) == false)
        #expect(!FileManager.default.fileExists(atPath: capture.appendingPathComponent("picture.png").path))
        #expect(try store.keepPicture(Data([0x89, 0x50]), in: capture) == true)
        #expect(FileManager.default.fileExists(atPath: capture.appendingPathComponent("picture.png").path))
    }

    @Test("a note is kept beside its capture; a blank one is not, and a capture already dropped is not made again")
    func notes() throws {
        let folder = temporary()
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = CaptureStore(folder: folder)
        let capture = try store.begin(place: place(answered: false, at: at()), trail: Data())
        #expect(try store.keepNote("  \n", in: capture) == false)
        #expect(!FileManager.default.fileExists(atPath: capture.appendingPathComponent("note.txt").path))
        #expect(try store.keepNote("the bar jumped", in: capture) == true)
        #expect(try String(contentsOf: capture.appendingPathComponent("note.txt"), encoding: .utf8) == "the bar jumped\n")
        try FileManager.default.removeItem(at: capture)
        #expect(try store.keepNote("too late", in: capture) == false)
        #expect(!FileManager.default.fileExists(atPath: capture.path))
    }

    @Test("the build's commit and flavour are read from the files the web build leaves beside it")
    func readsTheBuild() throws {
        let folder = temporary()
        defer { try? FileManager.default.removeItem(at: folder) }
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        #expect(CaptureWhere.Build.read(from: folder) == .init(commit: "unknown", flavour: "unknown"))
        try Data("pitch\n".utf8).write(to: folder.appendingPathComponent(".hifth-web-flavour"))
        try Data("abc1234\n".utf8).write(to: folder.appendingPathComponent(".hifth-web-commit"))
        #expect(CaptureWhere.Build.read(from: folder) == .init(commit: "abc1234", flavour: "pitch"))
    }
}
