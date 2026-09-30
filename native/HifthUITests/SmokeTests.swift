import XCTest

/// Launches the real app at a route and waits for the shell's own mirror of
/// it. In-page behaviour is Playwright's job (the `ipad` project); these only
/// prove the shell boots, takes a route, and shows what it was asked to.
final class SmokeTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    private func launch(route: String, appearance: String? = nil) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--route=\(route)"]
        if let appearance { app.launchEnvironment["HIFTH_APPEARANCE"] = appearance }
        app.launch()
        return app
    }

    private func waitForRoute(_ hash: String, in app: XCUIApplication, timeout: TimeInterval = 20) {
        let label = app.staticTexts["hifth.route"]
        let shown = NSPredicate(format: "label == %@", hash)
        expectation(for: shown, evaluatedWith: label)
        waitForExpectations(timeout: timeout)
    }

    private func attach(_ app: XCUIApplication, named name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    #if os(macOS)
    /// The Page menu's shortcuts reach the page through the shell, not as
    /// keys the page would ignore. Runs under `make app-test-mac-ui`, which
    /// needs Accessibility permission to press keys.
    func testPageMenuTurnsThePage() {
        let app = launch(route: "/hafs-kfqc/p45")
        waitForRoute("#/hafs-kfqc/p45", in: app)
        app.typeKey(.leftArrow, modifierFlags: .command)
        waitForRoute("#/hafs-kfqc/p47", in: app)
        app.menuBars.menuItems["Previous Page"].click()
        waitForRoute("#/hafs-kfqc/p45", in: app)
    }
    #endif

    func testOpensAtAVerse() {
        let app = launch(route: "/hafs-kfqc/2:255")
        waitForRoute("#/hafs-kfqc/2:255", in: app)
        attach(app, named: "verse-2-255")
    }

    /// The desk colour is part of the route (`?field=dark`), not the system
    /// setting; the appearance variable only colours the native chrome.
    func testOpensAtAPageOnTheDarkDesk() {
        let app = launch(route: "/hafs-kfqc/p45?field=dark", appearance: "dark")
        waitForRoute("#/hafs-kfqc/p45?field=dark", in: app)
        attach(app, named: "page-45-dark")
    }

    #if os(iOS)
    func testLandscapeStillShowsTheRoute() {
        XCUIDevice.shared.orientation = .landscapeLeft
        defer { XCUIDevice.shared.orientation = .portrait }
        let app = launch(route: "/hafs-kfqc/p45")
        waitForRoute("#/hafs-kfqc/p45", in: app)
        attach(app, named: "page-45-landscape")
    }
    #endif
}
