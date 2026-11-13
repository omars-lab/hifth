import Foundation
import Testing
import WebKit
@testable import Hifth

/// What a walk capture asks the page: the page number, the verse, what is open
/// and the settings, by number and name only. The page can hold the book's
/// words (the pitch build does), so this asks a real web view a made-up page
/// and checks none of its words come back. Every word here is made up.
@Suite("Walk capture: what the page says about itself")
@MainActor
struct CapturePageTests {
    private static let page = """
    <div data-page="7" style="width:100px;height:100px">made-up page words</div>
    <div data-page="6" style="display:none">hidden page words</div>
    <div data-page="pens" style="width:10px;height:10px"></div>
    <div data-tool="highlighter" style="width:10px;height:10px"></div>
    <div role="dialog" aria-label="made-up dialog label" data-jump-picker="" data-side="a long value with spaces">made-up note words</div>
    <button aria-expanded="true" data-phone-bar="b">made-up button words</button>
    <button aria-expanded="false" data-closed="">closed</button>
    <div data-panel="jump" aria-label="made-up panel label">made-up panel words</div>
    <div data-panel="a long name with spaces"></div>
    """

    private func ask(route: String, storage: [String: String]) async throws -> (CaptureWhere.PageAnswer, String) {
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 400, height: 400))
        _ = try await webView.runPageScript("document.body.innerHTML = html; return 1", arguments: ["html": Self.page])
        let value = try await webView.runPageScript(CapturePage.script, arguments: CapturePage.arguments(route: route, storage: storage))
        let text = try #require(value as? String)
        return (try #require(CaptureWhere.PageAnswer(json: text)), text)
    }

    @Test("it names the page on screen and the verse in the address, and nothing the page says")
    func pageAndVerse() async throws {
        let (answer, text) = try await ask(route: "#/hafs-kfqc/2:255?w=3-7", storage: [:])
        #expect(answer.page == 7, "the numbered page on screen, not a hidden one or a panel called pens")
        #expect(answer.verse == "2:255")
        #expect(!text.contains("made-up"), "no label, title or text of the page comes back")
        #expect(!text.contains("hidden"))
    }

    @Test("with no page on screen, the page comes from the address")
    func pageFromAddress() async throws {
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 400, height: 400))
        let value = try await webView.runPageScript(CapturePage.script, arguments: CapturePage.arguments(route: "#/hafs-kfqc/p12", storage: [:]))
        let text = try #require(value as? String)
        let answer = try #require(CaptureWhere.PageAnswer(json: text))
        #expect(answer.page == 12)
        #expect(answer.verse == nil)
    }

    @Test("what is open is named by its markers, a value only when it is a plain word")
    func open() async throws {
        let (answer, _) = try await ask(route: "#/hafs-kfqc/p7", storage: [:])
        #expect(answer.open.contains("tool=highlighter"))
        #expect(answer.open.contains("dialog:jump-picker,side"), "the long value with spaces is left out")
        #expect(answer.open.contains("expanded:phone-bar=b"))
        #expect(!answer.open.contains { $0.contains("closed") })
    }

    @Test("a panel says its own name, and the count of pages on screen is kept")
    func panelAndPages() async throws {
        let (answer, _) = try await ask(route: "#/hafs-kfqc/p7", storage: [:])
        #expect(answer.open.contains("panel=jump"))
        #expect(answer.open.filter { $0.hasPrefix("panel=") } == ["panel=jump"], "a name that is not a plain word is left out")
        #expect(answer.open.contains("pages=1"), "one numbered page on screen; the hidden one and the pens do not count")
    }

    @Test("settings are the app's own short choices; anything longer, or not the app's, is left out")
    func settings() async throws {
        let (answer, text) = try await ask(route: "#/hafs-kfqc/p7", storage: [
            "hifth.lang.v1": "en",
            "hifth.turn.style.v1": "curl",
            "hifth.bookmarks.v1": "[1,2]",
            "hifth.note.leave.v1": "made-up words with spaces",
            "someone-else": "x",
        ])
        #expect(answer.settings == ["hifth.lang.v1": "en", "hifth.turn.style.v1": "curl"])
        #expect(!text.contains("made-up"))
    }
}
