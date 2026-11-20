import Foundation
import Testing
@testable import Hifth

/// The page asking the app a question and waiting for the answer (sign-in
/// step 7). The page's side is `askApp` in `apps/web/src/native-bridge.ts`;
/// here the page is played through `receive`, and what the app runs in the
/// page is collected instead of reaching a web view.
@Suite("The page asks, the app answers")
@MainActor
struct AskTests {
    final class Ran { var scripts: [(source: String, arguments: [String: Any])] = [] }

    private func model() -> (ShellModel, Ran) {
        let ran = Ran()
        let model = ShellModel(launchRoute: nil)
        model.runScript = { ran.scripts.append(($0, $1)) }
        return (model, ran)
    }

    @Test("a question is answered once, through the page's answer door, with its id bound, never written into the script")
    func answersOnce() async {
        let (model, ran) = model()
        model.receive(.ask(id: "q-7", name: "ping"))
        await model.lastAsk?.value
        #expect(ran.scripts.count == 1)
        let script = ran.scripts.first
        #expect(script?.source == ShellModel.answerScript)
        #expect(script?.source.contains("q-7") == false)
        #expect(script?.arguments["id"] as? String == "q-7")
        let answer = script?.arguments["answer"] as? [String: Any]
        #expect(answer?["ok"] as? Bool == true)
        #expect(answer?["value"] as? String == "pong")
    }

    @Test("a question the app does not know gets a no, not silence, so the page never waits forever")
    func unknownQuestion() async {
        let (model, ran) = model()
        model.receive(.ask(id: "q-8", name: "open-the-pod-bay-doors"))
        await model.lastAsk?.value
        let answer = ran.scripts.first?.arguments["answer"] as? [String: Any]
        #expect(answer?["ok"] as? Bool == false)
        #expect(answer?["error"] as? String == "unknown-question")
        #expect(ran.scripts.first?.arguments["id"] as? String == "q-8")
    }

    @Test("two questions get two answers, each with its own id")
    func twoQuestions() async {
        let (model, ran) = model()
        model.receive(.ask(id: "a", name: "ping"))
        await model.lastAsk?.value
        model.receive(.ask(id: "b", name: "ping"))
        await model.lastAsk?.value
        #expect(ran.scripts.compactMap { $0.arguments["id"] as? String } == ["a", "b"])
    }

    @Test("the answer door is the page's own, called by name")
    func answerScript() {
        #expect(ShellModel.answerScript == "window.__HIFTH_ANSWER__?.(id, answer);")
    }
}
