import XCTest

#if os(iOS)
/// Apple's own accessibility check, the one Xcode's Accessibility Inspector runs, over the
/// screens a reader sees first: a page, and a page with a verse chosen. It reports what a
/// VoiceOver reader or a reader with larger text would trip on, such as a button with no name,
/// text too faint against its background, or a target too small to touch. It is the part of the
/// screen-reader walk (launch item ⑯) a machine can do; listening with VoiceOver stays on the
/// by-hand list. Each finding is kept as a note on the run, so a failure says what and where.
final class AccessibilityAuditTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = true
    }

    private func open(_ route: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--route=\(route)"]
        app.launch()
        let label = app.staticTexts["hifth.route"]
        expectation(for: NSPredicate(format: "label == %@", "#\(route)"), evaluatedWith: label)
        waitForExpectations(timeout: 20)
        return app
    }

    /// Each kind on its own: run all at once, the check gives up on a full page before it
    /// reports anything ("Audit failed to complete in time", 2026-11-19).
    private static let kinds: [(String, XCUIAccessibilityAuditType)] = [
        ("contrast", .contrast),
        ("element detection", .elementDetection),
        ("hit region", .hitRegion),
        ("sufficient element description", .sufficientElementDescription),
        ("dynamic type", .dynamicType),
        ("text clipped", .textClipped),
        ("trait", .trait),
    ]

    /// "Too small to touch" on plain text or a picture with no action is not a fault: nothing
    /// there is meant to be touched. On page 7 (2026-11-19) that was the zoom level, the count of
    /// pages on the device, the hint to tap a verse, and the thin strip marking where the reader
    /// left off, which is a named picture with no tap of its own. Anything a reader can tap is
    /// a button, and a button that is too small still fails.
    ///
    /// Judged by the kind this run asked for, not the issue's own `auditType`: checked
    /// against that field, every such finding was failed anyway (2026-11-19). Each line
    /// prints the field's raw value, so the next reader can see what it holds.
    private static func notATouchTarget(kind: XCUIAccessibilityAuditType, elementType: XCUIElement.ElementType?) -> Bool {
        guard kind == .hitRegion, let elementType else { return false }
        return elementType == .staticText || elementType == .image
    }

    private func audit(_ app: XCUIApplication, named name: String) throws {
        for (kind, type) in Self.kinds {
            let started = Date()
            do {
                try app.performAccessibilityAudit(for: type) { issue in
                    let elementType = issue.element?.elementType
                    let what = issue.element.map { "type \($0.elementType.rawValue) '\($0.label)' id '\($0.identifier)' value '\($0.value ?? "")' \($0.frame)" } ?? "no element"
                    let line = "\(name) · \(kind) · \(issue.compactDescription) · \(issue.detailedDescription) · \(what) · issue kind \(issue.auditType.rawValue)"
                    if Self.notATouchTarget(kind: type, elementType: elementType) {
                        print("ev=a11y_noted \(line)")
                        return true
                    }
                    print("ev=a11y_finding \(line)")
                    let note = XCTAttachment(string: line)
                    note.name = "\(name) \(kind) finding"
                    note.lifetime = .keepAlways
                    self.add(note)
                    return false
                }
                print("ev=a11y_kind_done screen=\"\(name)\" kind=\"\(kind)\" seconds=\(Int(Date().timeIntervalSince(started)))")
            } catch {
                print("ev=a11y_kind_error screen=\"\(name)\" kind=\"\(kind)\" seconds=\(Int(Date().timeIntervalSince(started))) msg=\"\(error.localizedDescription)\"")
                XCTFail("\(name): the \(kind) check did not finish: \(error.localizedDescription)")
            }
        }
    }

    func testAPageHasNothingAppleWouldFlag() throws {
        let app = open("/hafs-kfqc/p7")
        try audit(app, named: "page 7")
    }

    func testAChosenVerseHasNothingAppleWouldFlag() throws {
        let app = open("/hafs-kfqc/2:255")
        // The address is set before the verse's tools have opened; check the screen a reader
        // gets, with the tools up, not the moment before (2026-11-19).
        let bookmark = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Bookmark this page at")).firstMatch
        XCTAssertTrue(bookmark.waitForExistence(timeout: 20), "the verse's tools never opened")
        try audit(app, named: "verse 2:255")
    }
}
#endif
