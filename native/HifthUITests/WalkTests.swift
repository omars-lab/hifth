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
        // The interface language to walk in, over any the app has picked;
        // empty keeps the app's own.
        let locale = env["WALK_LOCALE"] ?? ""
        let language = locale.isEmpty ? [] : ["-AppleLanguages", "(\(locale))", "--lang=\(locale)"]
        if sideways { XCUIDevice.shared.orientation = .landscapeLeft }
        defer { XCUIDevice.shared.orientation = .portrait }
        for (index, route) in routes.enumerated() {
            let app = XCUIApplication()
            app.launchArguments = ["--route=\(route)"] + language
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
            // A sideways walk that took upright pictures checked nothing, and
            // looked as if it had (2026-10-08: every "side-" picture was upright).
            if sideways {
                XCTAssertGreaterThan(shot.size.width, shot.size.height, "\(route): asked for sideways, got an upright picture")
            }
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

    /// The probe on the open book (make app-probe SIDEWAYS=1). The app may not
    /// turn itself on an iPad that can share its screen, so this test turns
    /// the simulator, starts the app with the probe's question, and waits for
    /// the answer the app keeps in PROBE_OUT before it quits. Skipped unless
    /// the make target names that file.
    func testProbeOnItsSide() throws {
        let env = ProcessInfo.processInfo.environment
        let out = env["PROBE_OUT"] ?? ""
        try XCTSkipIf(out.isEmpty, "no PROBE_OUT: run it with make app-probe TARGET=ipad SIDEWAYS=1")
        try? FileManager.default.removeItem(atPath: out)
        let locale = env["PROBE_LOCALE"] ?? ""
        XCUIDevice.shared.orientation = .landscapeLeft
        defer { XCUIDevice.shared.orientation = .portrait }
        let app = XCUIApplication()
        app.launchArguments = locale.isEmpty ? [] : ["-AppleLanguages", "(\(locale))", "--lang=\(locale)"]
        app.launchEnvironment = [
            "HIFTH_ROUTE": env["PROBE_ROUTE"] ?? "",
            "HIFTH_PROBE": "1",
            "HIFTH_PROBE_EVAL": env["PROBE_EVAL"] ?? "",
            "HIFTH_PROBE_DELAY_MS": env["PROBE_DELAY_MS"] ?? "2000",
            "HIFTH_PROBE_PATH": out,
        ]
        app.launch()
        let timeout = TimeInterval(env["PROBE_TIMEOUT_S"] ?? "") ?? 180
        let start = Date()
        while !FileManager.default.fileExists(atPath: out), Date().timeIntervalSince(start) < timeout {
            Thread.sleep(forTimeInterval: 0.5)
        }
        if !FileManager.default.fileExists(atPath: out) {
            let picture = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            picture.name = "probe-no-answer"
            picture.lifetime = .keepAlways
            add(picture)
        }
        let data = try XCTUnwrap(
            FileManager.default.contents(atPath: out),
            "the probe never answered in \(Int(timeout)) s; the app is \(app.state == .notRunning ? "gone" : "still running")")
        let answer = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        // An answer from an upright page checked nothing, and would look as if
        // it had: the simulator sometimes says it turned and stays upright.
        let viewport = try XCTUnwrap(answer["viewport"] as? [Double])
        XCTAssertGreaterThan(viewport[0], viewport[1], "asked for sideways, the page was \(viewport[0]) x \(viewport[1])")
    }
}
#endif
