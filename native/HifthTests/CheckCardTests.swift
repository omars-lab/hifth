import Foundation
import Testing
@testable import Hifth

/// The check card: `hifth://x-callback-url/check?id=…&title=…&step=…&see=…`
/// opens a small card of steps in a debug build, each answered with a tick or a
/// cross, and Done saves the answers in the app's folder for the laptop to copy
/// off. These pin how the link is read, what is refused, what is saved, and
/// what the caller hears back. The steps here are made up; a real card's steps
/// come from the manual-testing list on the laptop.
@Suite("Check card")
@MainActor
struct CheckCardTests {
    private func url(_ s: String) throws -> URL { try #require(URL(string: s)) }

    private func check(_ s: String) throws -> XCallback.Check? {
        guard case .request(let r)? = XCallback.parse(try url(s)), case .check(let c) = r.action else { return nil }
        return c
    }

    @Test("a check names its steps in order; each see belongs to the step before it")
    func parsesSteps() throws {
        let c = try #require(try check(
            "hifth://x-callback-url/check?id=screens&title=Two%20screenshots&step=Press%20both%20buttons&see=The%20screen%20flashes&step=Swipe%20from%20a%20corner"
        ))
        #expect(c.id == "screens")
        #expect(c.title == "Two screenshots")
        #expect(c.steps == [
            XCallback.CheckStep(action: "Press both buttons", see: "The screen flashes"),
            XCallback.CheckStep(action: "Swipe from a corner", see: nil),
        ])
    }

    @Test("an apostrophe, an ampersand and a plus sign in a step survive the link")
    func awkwardCharacters() throws {
        let c = try #require(try check("hifth://x-callback-url/check?id=a&step=Don%27t%20stop%20%26%20look%20%2B%20wait"))
        #expect(c.steps.first?.action == "Don't stop & look + wait")
    }

    @Test("with no id or title, the card still opens with plain defaults")
    func defaults() throws {
        let c = try #require(try check("hifth://x-callback-url/check?step=Look"))
        #expect(c.id == "check")
        #expect(c.title == "What to check")
    }

    @Test("an id is cut down to letters, digits and dashes, so it is a safe file name")
    func safeID() throws {
        let c = try #require(try check("hifth://x-callback-url/check?id=..%2F..%2FEvil%20Name&step=Look"))
        #expect(c.id == "evil-name")
    }

    @Test("a check with no step, too many, an empty one, or a see with no step is refused", arguments: [
        "id=a",
        "id=a&step=",
        "id=a&see=Something&step=Look",
        "id=a" + String(repeating: "&step=x", count: 13),
    ])
    func refused(_ q: String) throws {
        guard case .failure(let f, let callbacks)? = XCallback.parse(try url("hifth://x-callback-url/check?\(q)&x-error=a://e")) else {
            Issue.record("expected a failure for \(q)")
            return
        }
        #expect(f.code == "bad-check", Comment(rawValue: q))
        #expect(!f.message.isEmpty)
        #expect(callbacks.error?.absoluteString == "a://e")
    }

    @Test("twelve steps is the most a card takes")
    func twelveSteps() throws {
        let c = try check("hifth://x-callback-url/check?id=a" + String(repeating: "&step=x", count: 12))
        #expect(c?.steps.count == 12)
    }

    // MARK: - The card

    private func card(_ steps: Int = 2) -> CheckCard {
        CheckCard(
            check: XCallback.Check(
                id: "screens",
                title: "Two screenshots",
                steps: (1...steps).map { XCallback.CheckStep(action: "Step \($0)", see: $0 == 1 ? "Something" : nil) }
            ),
            callbacks: .none
        )
    }

    @Test("a card passes only when every step got a tick")
    func result() {
        let c = card()
        #expect(c.result == "fail", "nothing answered yet is not a pass")
        c.answers[0] = .pass
        #expect(c.result == "fail")
        c.answers[1] = .pass
        #expect(c.result == "pass")
        c.answers[1] = .fail
        #expect(c.result == "fail")
    }

    @Test("the saved answers carry the steps, each answer, the note, the page and the time")
    func record() throws {
        let c = card()
        c.answers[0] = .pass
        c.answers[1] = .fail
        c.note = "the second one did nothing"
        let at = Date(timeIntervalSince1970: 1_800_000_000)
        let r = c.record(route: "#/hafs-kfqc/p7", at: at)
        #expect(r.id == "screens")
        #expect(r.result == "fail")
        #expect(r.route == "/hafs-kfqc/p7")
        #expect(r.note == "the second one did nothing")
        #expect(r.at == "2027-01-15T08:00:00Z")
        #expect(r.steps.map(\.answer) == ["pass", "fail"])
        #expect(r.steps.first?.see == "Something")
        #expect(r.steps.last?.see == nil)
    }

    @Test("a step left alone is saved as not answered, not as a pass")
    func unanswered() {
        let r = card().record(route: "", at: Date(timeIntervalSince1970: 0))
        #expect(r.steps.map(\.answer) == ["not answered", "not answered"])
    }

    @Test("the answers are written as one file named by the check and the time")
    func store() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("checks-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: folder) }
        let r = card().record(route: "#/hafs-kfqc/p7", at: Date(timeIntervalSince1970: 1_800_000_000))
        let file = try CheckStore.save(r, in: folder)
        #expect(file.lastPathComponent == "screens-20270115-080000.json")
        let back = try JSONDecoder().decode(CheckRecord.self, from: Data(contentsOf: file))
        #expect(back == r)
    }

    @Test("Done answers the caller with the check's id and its result")
    func doneURL() throws {
        let callbacks = XCallback.Callbacks(success: try url("shortcuts://x-callback-url/run-shortcut?name=Log"), error: nil, cancel: nil)
        #expect(
            callbacks.checkDoneURL(id: "screens", result: "fail")?.absoluteString
                == "shortcuts://x-callback-url/run-shortcut?name=Log&id=screens&result=fail"
        )
    }

    // MARK: - The shell

    final class Opened { var urls: [URL] = [] }

    private func shell() -> (ShellModel, Opened, URL) {
        let opened = Opened()
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("checks-\(UUID().uuidString)")
        let model = ShellModel(launchRoute: nil, callbackTimeout: .milliseconds(200))
        model.openCallback = { opened.urls.append($0) }
        model.checksFolder = folder
        return (model, opened, folder)
    }

    @Test("a check link opens the card; Done saves it, answers, and closes it")
    func shellOpensAndSaves() throws {
        let (model, opened, folder) = shell()
        defer { try? FileManager.default.removeItem(at: folder) }
        model.receive(.ready)
        model.receive(.route("#/hafs-kfqc/p7"))
        model.open(try url("hifth://x-callback-url/check?id=screens&step=One&step=Two&x-success=a://done"))
        let c = try #require(model.checkCard)
        #expect(c.check.steps.count == 2)
        c.answers = [.pass, .pass]
        model.finishCheck()
        #expect(model.checkCard == nil)
        #expect(opened.urls.map(\.absoluteString) == ["a://done?id=screens&result=pass"])
        let files = try FileManager.default.contentsOfDirectory(atPath: folder.path)
        #expect(files.count == 1)
        #expect(files.first?.hasPrefix("screens-") == true)
    }

    @Test("a new card replaces the old one, and the old one's answers are saved first")
    func replaceKeepsAnswers() throws {
        let (model, _, folder) = shell()
        defer { try? FileManager.default.removeItem(at: folder) }
        model.receive(.ready)
        model.open(try url("hifth://x-callback-url/check?id=first&step=One"))
        model.checkCard?.answers = [.fail]
        model.open(try url("hifth://x-callback-url/check?id=second&step=Two"))
        #expect(model.checkCard?.check.id == "second")
        let files = try FileManager.default.contentsOfDirectory(atPath: folder.path)
        #expect(files.count == 1)
        #expect(files.first?.hasPrefix("first-") == true)
    }

    @Test("an old card nobody touched is not saved when a new one replaces it")
    func replaceUntouched() throws {
        let (model, _, folder) = shell()
        defer { try? FileManager.default.removeItem(at: folder) }
        model.open(try url("hifth://x-callback-url/check?id=first&step=One"))
        model.open(try url("hifth://x-callback-url/check?id=second&step=Two"))
        #expect(!FileManager.default.fileExists(atPath: folder.path))
    }

    @Test("closing a card without Done throws nothing away: what was answered is saved")
    func dismissSaves() throws {
        let (model, opened, folder) = shell()
        defer { try? FileManager.default.removeItem(at: folder) }
        model.open(try url("hifth://x-callback-url/check?id=first&step=One&x-success=a://done"))
        model.checkCard?.note = "half done"
        model.closeCheck()
        #expect(model.checkCard == nil)
        #expect(opened.urls.isEmpty, "closing is not finishing: the caller hears nothing")
        #expect(try FileManager.default.contentsOfDirectory(atPath: folder.path).count == 1)
    }
}
