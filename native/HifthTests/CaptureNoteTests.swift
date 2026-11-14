import Foundation
import Testing
@testable import Hifth

/// After a screenshot the app offers "Add a note" for a few seconds. These pin
/// what happens to what was typed: kept when the banner closes, kept when a
/// second screenshot replaces the banner, and nothing written for a blank one.
/// Every value here is made up.
@Suite("Walk capture: the note")
@MainActor
struct CaptureNoteTests {
    private func setUp() throws -> (ShellModel, URL, CaptureWhere) {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("walk-notes-\(UUID().uuidString)", isDirectory: true)
        let model = ShellModel(launchRoute: nil)
        model.captureStore = CaptureStore(folder: folder)
        let place = CaptureWhere(
            at: Date(timeIntervalSince1970: 1_800_000_000), trigger: "screenshot", route: "#/hafs-kfqc/p7", answer: nil,
            screen: .init(width: 1180, height: 820, scale: 2, orientation: "sideways"),
            build: .init(commit: "abc1234", flavour: "public")
        )
        return (model, folder, place)
    }

    private func note(in capture: URL) -> String? {
        try? String(contentsOf: capture.appendingPathComponent("note.txt"), encoding: .utf8)
    }

    @Test("closing the banner keeps what was typed")
    func closeKeeps() throws {
        let (model, folder, place) = try setUp()
        defer { try? FileManager.default.removeItem(at: folder) }
        let capture = try model.captureStore.begin(place: place, trail: Data())
        model.offerNote(for: capture)
        #expect(model.captureNote == capture)
        model.captureNoteText = "the drawer covered the verse"
        model.closeNote()
        #expect(model.captureNote == nil)
        #expect(model.captureNoteText == "")
        #expect(note(in: capture) == "the drawer covered the verse\n")
    }

    @Test("a second screenshot while the banner is up keeps the first note and offers a fresh one")
    func secondScreenshot() throws {
        let (model, folder, place) = try setUp()
        defer { try? FileManager.default.removeItem(at: folder) }
        let first = try model.captureStore.begin(place: place, trail: Data())
        model.offerNote(for: first)
        model.captureNoteText = "first"
        let second = try model.captureStore.begin(place: place, trail: Data())
        model.offerNote(for: second)
        #expect(note(in: first) == "first\n")
        #expect(model.captureNote == second)
        #expect(model.captureNoteText == "")
    }

    @Test("a banner closed with nothing typed leaves no note")
    func blank() throws {
        let (model, folder, place) = try setUp()
        defer { try? FileManager.default.removeItem(at: folder) }
        let capture = try model.captureStore.begin(place: place, trail: Data())
        model.offerNote(for: capture)
        model.captureNoteText = "  "
        model.closeNote()
        #expect(note(in: capture) == nil)
    }
}
