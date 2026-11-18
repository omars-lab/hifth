import Testing
@testable import Hifth

/// A store picture must show the app as a new reader sees it. On 2026-11-17 the
/// Mac pictures showed a red "Left off" ribbon: the screenshot run had opened the
/// laptop's own saved reading place, bookmarks and notes. A run that takes a
/// picture keeps its page data in a throwaway store, so it neither shows the
/// reader's data nor writes over it.
@Suite("A screenshot run never reads or writes the reader's saved data")
struct ScreenshotDataTests {
    @Test("a run asked for a picture uses a throwaway store")
    func picture() {
        #expect(ScreenshotData.throwaway(["HIFTH_SNAPSHOT_PATH": "/tmp/shot.png"]))
    }

    @Test("an ordinary launch keeps the reader's saved data")
    func ordinary() {
        #expect(!ScreenshotData.throwaway([:]))
        #expect(!ScreenshotData.throwaway(["HIFTH_SNAPSHOT_PATH": ""]))
        #expect(!ScreenshotData.throwaway(["HIFTH_ROUTE": "#/p/7"]))
    }
}
