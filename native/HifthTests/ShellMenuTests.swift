import Foundation
import Testing
@testable import Hifth

/// The Mac's Page menu reaches the page through the model, which runs one
/// line of JavaScript against the function the page exposed. The web view is
/// replaced here by a collector, so the tests see the line and its argument.
@Suite("Shell turns the page for the menu")
@MainActor
struct ShellMenuTests {
    final class Ran { var scripts: [(String, [String: Any])] = [] }

    private func model() -> (ShellModel, Ran) {
        let ran = Ran()
        let model = ShellModel(launchRoute: nil)
        model.runScript = { source, arguments in ran.scripts.append((source, arguments)) }
        return (model, ran)
    }

    @Test("next and previous page call the page's own turn, by name")
    func stepsThePage() {
        let (model, ran) = model()
        model.receive(.ready)
        model.stepPage(1)
        model.stepPage(-1)
        #expect(ran.scripts.count == 2)
        #expect(ran.scripts.allSatisfy { $0.0 == ShellModel.stepPageScript })
        #expect(ran.scripts.map { $0.1["step"] as? Int } == [1, -1])
        #expect(ShellModel.stepPageScript.contains("__HIFTH_PAGE__"))
    }

    @Test("before the page is ready a menu press is dropped, not queued")
    func dropsBeforeReady() {
        let (model, ran) = model()
        model.stepPage(1)
        #expect(ran.scripts.isEmpty)
        model.receive(.ready)
        #expect(ran.scripts.isEmpty)
    }

    @Test("a route shown later goes through the same runner")
    func showUsesTheRunner() {
        let (model, ran) = model()
        model.receive(.ready)
        model.show("#/hafs-kfqc/p45")
        #expect(ran.scripts.count == 1)
        #expect(ran.scripts.first?.1["route"] as? String == "#/hafs-kfqc/p45")
    }
}
