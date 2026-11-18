import CoreGraphics
import Foundation

/// The size of the Mac window, and of the page inside it.
///
/// Usually the window opens wide enough for the two-page spread on first
/// launch: the web app's desktop layout begins at 1024×740. `make
/// app-store-shots` names a page size of its own in HIFTH_WINDOW_SIZE, as
/// `1280x800`, because the store's Mac screenshots must be 16:10
/// (docs/design/app-store-launch.md, item 31). The picture is of the page,
/// so it is the page, not the window, that must come out at that size.
enum WindowSize {
    static let standard = CGSize(width: 1280, height: 860)
    /// The smallest window the two-page spread is drawn in.
    static let smallest = CGSize(width: 1024, height: 740)

    /// The size this launch opens at. The store build reads no launch setting
    /// (launch item 36), so it always opens at the usual size.
    static var atLaunch: CGSize {
        #if !STORE
        return from(ProcessInfo.processInfo.environment["HIFTH_WINDOW_SIZE"])
        #else
        return standard
        #endif
    }

    /// The size written as `WIDTHxHEIGHT`, or the usual one when there is
    /// none, it cannot be read, or it is too small for the spread.
    static func from(_ value: String?) -> CGSize {
        asked(value) ?? standard
    }

    /// The size written as `WIDTHxHEIGHT`, or nil when there is none, it
    /// cannot be read, or it is too small for the spread.
    static func asked(_ value: String?) -> CGSize? {
        guard let value, !value.isEmpty else { return nil }
        let parts = value.split(separator: "x", omittingEmptySubsequences: false)
        guard parts.count == 2,
              parts.allSatisfy({ !$0.isEmpty && $0.allSatisfy(\.isASCIIDigit) }),
              let width = Int(parts[0]), let height = Int(parts[1]),
              width >= Int(smallest.width), height >= Int(smallest.height)
        else { return nil }
        return CGSize(width: width, height: height)
    }

    /// The window size that makes the page `wanted`, from the window's size
    /// now and the page's size measured inside it. The Mac remembers the
    /// window's last size, which SwiftUI then opens at instead of the one it
    /// is given, and the page runs under the title bar, so the page is never
    /// simply the size asked for: the window is grown or shrunk by what the
    /// page is off by.
    static func window(_ window: CGSize, page: CGSize, wanted: CGSize) -> CGSize {
        CGSize(width: window.width + wanted.width - page.width,
               height: window.height + wanted.height - page.height)
    }
}

private extension Character {
    var isASCIIDigit: Bool { isASCII && isNumber }
}
