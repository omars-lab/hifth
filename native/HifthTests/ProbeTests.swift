import Foundation
import Testing
import WebKit
@testable import Hifth

/// The probe is how a fault only the app shows gets measured from inside it
/// (make app-probe EVAL=…). Its extra question is run in a real web view here.
@Suite("The app probe answers the extra question")
@MainActor
struct ProbeTests {
    private func ask(_ extra: String) async throws -> [String: Any] {
        let webView = WKWebView()
        let value = try await webView.callAsyncJavaScript(
            ShellModel.probeScript, arguments: ["extra": extra], in: nil, contentWorld: .page)
        let text = try #require(value as? String)
        return try #require(try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
    }

    @Test("a question answered at once")
    func answeredAtOnce() async throws {
        #expect(try await ask("6 * 7")["eval"] as? Int == 42)
    }

    // A tap in the page redraws a moment later, so a question that taps and
    // then counts has to wait; the probe printed `{}` for its answer (2026-10-09).
    @Test("a question that waits before it answers")
    func answeredLater() async throws {
        let late = "new Promise(done => setTimeout(() => done(42), 50))"
        #expect(try await ask(late)["eval"] as? Int == 42)
    }

    @Test("a question that fails says why")
    func failureSaysWhy() async throws {
        let late = "Promise.reject(new Error(\"no dialog\"))"
        #expect(try await ask(late)["eval"] as? String == "Error: no dialog")
    }
}
