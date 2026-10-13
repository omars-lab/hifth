import CoreGraphics
import Foundation
import Testing
@testable import Hifth

/// The Apple Pencil's double-tap and squeeze (docs/PLAN.md, 96). The iPad app
/// hears them; the page decides what they mean. The model hands each one on as
/// one line of JavaScript with the gesture as its argument, so these replace
/// the web view with a collector and read what would have reached the page.
/// Platform-neutral on purpose: the iOS-only part only names the gesture.
@Suite("Shell hands the pencil's gestures to the page")
@MainActor
struct PencilTests {
    final class Ran { var scripts: [(String, [String: Any])] = [] }

    private func model() -> (ShellModel, Ran) {
        let ran = Ran()
        let model = ShellModel(launchRoute: nil)
        model.runScript = { source, arguments in ran.scripts.append((source, arguments)) }
        return (model, ran)
    }

    private func gesture(_ ran: Ran, _ index: Int) -> [String: Any] {
        ran.scripts[index].1["e"] as? [String: Any] ?? [:]
    }

    @Test("each gesture runs the page's own pencil, with the reader's setting")
    func handsOnTheGesture() {
        let (model, ran) = model()
        model.receive(.ready)
        model.pencil(.doubleTap, preference: "eraser", tip: nil)
        model.pencil(.squeeze, preference: "palette", tip: CGPoint(x: 300, y: 200.5))
        #expect(ran.scripts.count == 2)
        #expect(ran.scripts.allSatisfy { $0.0 == ShellModel.pencilScript })
        #expect(ShellModel.pencilScript.contains("__HIFTH_PAGE__"))
        #expect(gesture(ran, 0)["kind"] as? String == "doubleTap")
        #expect(gesture(ran, 0)["pref"] as? String == "eraser")
        #expect(gesture(ran, 1)["kind"] as? String == "squeeze")
        #expect(gesture(ran, 1)["pref"] as? String == "palette")
        #expect(gesture(ran, 1)["x"] as? Double == 300)
        #expect(gesture(ran, 1)["y"] as? Double == 200.5)
    }

    @Test("with the tip away from the screen, no spot is sent, so the page picks one")
    func noTipNoSpot() {
        let (model, ran) = model()
        model.receive(.ready)
        model.pencil(.doubleTap, preference: "previous", tip: nil)
        #expect(gesture(ran, 0)["x"] == nil)
        #expect(gesture(ran, 0)["y"] == nil)
    }

    @Test("before the page is ready a gesture is dropped, not queued")
    func dropsBeforeReady() {
        let (model, ran) = model()
        model.pencil(.squeeze, preference: "palette", tip: nil)
        #expect(ran.scripts.isEmpty)
        model.receive(.ready)
        #expect(ran.scripts.isEmpty)
    }
}
