import XCTest

#if os(iOS)
/// Not a check: the camera for walking the app by eye. Opens each route the
/// walker names, upright or sideways, and keeps one picture of each. Skipped
/// unless `make app-walk` names the routes, so `make app-test` never runs it.
final class WalkTests: XCTestCase {
    func testWalkTheRoutes() throws {
        let env = ProcessInfo.processInfo.environment
        let routes = (env["WALK_ROUTES"] ?? "").split(separator: " ").map(String.init)
        try XCTSkipIf(routes.isEmpty, "no WALK_ROUTES: run it with make app-walk ROUTES=…")
        let sideways = env["WALK_SIDEWAYS"] == "1"
        let settle = UInt32(env["WALK_SETTLE"] ?? "") ?? 3
        if sideways { XCUIDevice.shared.orientation = .landscapeLeft }
        defer { XCUIDevice.shared.orientation = .portrait }
        for (index, route) in routes.enumerated() {
            let app = XCUIApplication()
            app.launchArguments = ["--route=\(route)"]
            app.launch()
            // The mirror shows the hash the page settled on, which may be
            // fuller than the route asked for; any hash at all means it is up.
            let label = app.staticTexts["hifth.route"]
            expectation(for: NSPredicate(format: "label BEGINSWITH '#/'"), evaluatedWith: label)
            waitForExpectations(timeout: 20)
            sleep(settle)
            // The web view alone, drawn upright: a whole-screen capture of a
            // turned simulator comes back as a portrait frame, shifted.
            let shot = app.webViews.firstMatch.screenshot().image
            let picture = XCTAttachment(image: UIGraphicsImageRenderer(size: shot.size).image { _ in shot.draw(at: .zero) })
            // `/hafs-kfqc/2:255?open=commentary` → `side-1-hafs-kfqc_2-255_open-commentary`,
            // the same spelling `make app-shot` gives its files.
            let spelled = route.drop { $0 == "/" }.map { c -> String in
                switch c { case "/", "?", "&": return "_"; case ":", "=": return "-"; default: return String(c) }
            }.joined()
            picture.name = "\(sideways ? "side" : "upright")-\(index + 1)-\(spelled)"
            picture.lifetime = .keepAlways
            add(picture)
            app.terminate()
        }
    }
}
#endif
