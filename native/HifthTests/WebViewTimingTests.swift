import Testing
@testable import Hifth

/// The web view is built when the screen first asks for it, not when the app
/// makes its model. The model is made before iPadOS has finished starting the
/// app; a web view built that early, with its touch handlers and the Pencil
/// listener already attached, closed the app on the first touch of a verse on
/// iPadOS 18.5 ("Invalid parameter not satisfying: targetNode",
/// docs/issues/ipad-crash-on-verse-touch.md).
@Suite("The web view waits for the screen")
@MainActor
struct WebViewTimingTests {
    @Test("making the model builds no web view")
    func modelAloneBuildsNothing() {
        let model = ShellModel(launchRoute: nil)
        #expect(!model.webViewBuilt)
    }

    @Test("the screen's first request builds it, once")
    func firstRequestBuildsOnce() {
        let model = ShellModel(launchRoute: nil)
        let first = model.webView
        let second = model.webView
        #expect(model.webViewBuilt)
        #expect(first === second)
    }
}
