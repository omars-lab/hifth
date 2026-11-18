import CoreGraphics
import Testing
@testable import Hifth

/// The Mac window first opens wide enough for the two-page spread. The store's
/// Mac screenshots must be 16:10, so `make app-store-shots` asks for a window
/// of its own size by naming it in HIFTH_WINDOW_SIZE (docs/design/app-store-launch.md,
/// item 31). Anything it cannot read, or too small for the spread, keeps the usual size.
@Suite("The Mac window opens at the size it is asked for")
struct WindowSizeTests {
    @Test("with nothing asked, it opens at the usual size")
    func usual() {
        #expect(WindowSize.from(nil) == WindowSize.standard)
        #expect(WindowSize.from("") == WindowSize.standard)
    }

    @Test("a width and height written as 1280x800 open at exactly that")
    func asked() {
        #expect(WindowSize.from("1280x800") == CGSize(width: 1280, height: 800))
        #expect(WindowSize.from("1440x900") == CGSize(width: 1440, height: 900))
    }

    @Test("a size it cannot read keeps the usual one")
    func unreadable() {
        for value in ["wide", "1280", "1280x", "x800", "1280x800x2", "-1280x800"] {
            #expect(WindowSize.from(value) == WindowSize.standard, "\(value)")
        }
    }

    @Test("a size too small for the two-page spread keeps the usual one")
    func tooSmall() {
        #expect(WindowSize.from("800x600") == WindowSize.standard)
        #expect(WindowSize.from("1023x800") == WindowSize.standard)
        #expect(WindowSize.from("1024x739") == WindowSize.standard)
        #expect(WindowSize.from("1024x740") == CGSize(width: 1024, height: 740))
    }

    @Test("only a size it can use counts as asked for")
    func askedOrNot() {
        #expect(WindowSize.asked(nil) == nil)
        #expect(WindowSize.asked("wide") == nil)
        #expect(WindowSize.asked("800x600") == nil)
        #expect(WindowSize.asked("1280x800") == CGSize(width: 1280, height: 800))
    }

    // The Mac remembers the window's last size and SwiftUI then ignores the
    // size it opens at, and the page sits under the title bar, so the page is
    // never simply the size asked for. A 1280x800 ask once gave a 1280x828 page
    // (2026-11-17). The window is grown or shrunk by what the page is off by.
    @Test("the window is resized by what the page is off by")
    func fit() {
        let window = CGSize(width: 1280, height: 860)
        let page = CGSize(width: 1280, height: 828)
        let wanted = CGSize(width: 1280, height: 800)
        #expect(WindowSize.window(window, page: page, wanted: wanted) == CGSize(width: 1280, height: 832))
        #expect(WindowSize.window(window, page: wanted, wanted: wanted) == window)
        #expect(WindowSize.window(CGSize(width: 1100, height: 900), page: CGSize(width: 1100, height: 868), wanted: wanted)
                == CGSize(width: 1280, height: 832))
    }
}
