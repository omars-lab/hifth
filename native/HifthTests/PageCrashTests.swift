import Testing
import WebKit
@testable import Hifth

/// When the system ends the process that draws the page (low memory, a crash
/// inside WebKit), the web view is left blank and stays blank until the app is
/// quit. Launch item 15: the shell loads the page again by itself.
@Suite("Page crash")
@MainActor
struct PageCrashTests {
    @Test("the page is loaded again when the process drawing it ends")
    func reloadsAfterCrash() {
        let policy = NavigationPolicy()
        var reloaded: [WKWebView] = []
        policy.reloadAfterCrash = { reloaded.append($0) }
        let view = WKWebView(frame: .zero)

        policy.webViewWebContentProcessDidTerminate(view)

        #expect(reloaded.count == 1)
        #expect(reloaded.first === view)
    }
}
