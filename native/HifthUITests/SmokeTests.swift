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
    /// Sideways, the two pages fill the height between the bars. They once
    /// drew as a sliver 28 points wide in the middle of an empty desk, in the
    /// app only: the iPad's own WebKit could not size a page from its height
    /// the way the browsers do (found walking the pitch, 2026-10-08).
    func testLandscapeOpensTheBookFullSize() {
        XCUIDevice.shared.orientation = .landscapeLeft
        defer { XCUIDevice.shared.orientation = .portrait }
        let app = launch(route: "/hafs-kfqc/p45")
        waitForRoute("#/hafs-kfqc/p45", in: app)
        sleep(3)
        // The web view alone, drawn upright: a whole-screen capture of a turned
        // simulator comes back as a portrait frame with the picture shifted.
        let shot = app.webViews.firstMatch.screenshot().image
        let upright = UIGraphicsImageRenderer(size: shot.size).image { _ in shot.draw(at: .zero) }
        let picture = XCTAttachment(image: upright)
        picture.name = "page-45-landscape"
        picture.lifetime = .keepAlways
        add(picture)
        let book = Self.bookShareAcrossTheMiddle(of: upright)
        XCTAssertGreaterThan(book, 0.4, "the two pages cover \(Int(book * 100))% of the screen's width")
    }

    /// The share of the screen's middle row that is not desk. The desk is a
    /// warm tan, red well above blue; the page's paper and its ink are not.
    private static func bookShareAcrossTheMiddle(of image: UIImage) -> Double {
        guard let cg = image.cgImage else { return 0 }
        let width = cg.width, height = cg.height
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(
                data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return false }
            context.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard drawn else { return 0 }
        let row = height / 2
        var desk = 0, counted = 0
        for x in 0..<width {
            let i = (row * width + x) * 4
            let red = Int(pixels[i]), green = Int(pixels[i + 1]), blue = Int(pixels[i + 2])
            if red + green + blue < 30 { continue }  // no picture here at all
            counted += 1
            if (140...225).contains(red), red - blue > 40 { desk += 1 }
        }
        return counted == 0 ? 0 : 1 - Double(desk) / Double(counted)
    }
    #endif
}
