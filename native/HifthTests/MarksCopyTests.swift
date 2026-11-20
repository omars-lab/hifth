import Foundation
import Testing
@testable import Hifth

/// The copy of a reader's marks kept on hifth.app (sign-in step 21c, docs/design/sign-in.md).
/// The app is only the go-between: it carries the page's marks file to hifth.app and back with
/// the session in the Authorization line, and never reads inside it. Every session, address and
/// mark here is made up.
@Suite("The copy of a reader's marks on hifth.app")
@MainActor
struct MarksCopyTests {
    typealias FakeStore = StaySignedInTests.FakeStore

    static let session = SignIn.Session(token: "made-up-session", expiresAt: 1_900_000_000, appleUser: "made-up-apple-user")
    static let now = Date(timeIntervalSince1970: 1_800_000_000)
    static let base = URL(string: "https://sign-in.example")!
    static let file = #"{"kind":"hifth.bookmarks","version":1,"savedAt":5,"bookmarks":[]}"#

    /// hifth.app, played: it answers every call the same way and writes down what it was sent.
    final class FakeServer {
        var status = 200
        var body = "{}"
        var offline = false
        var asked: [(method: String, path: String, authorization: String?, body: String)] = []

        func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
            asked.append((
                request.httpMethod ?? "",
                request.url!.path,
                request.value(forHTTPHeaderField: "Authorization"),
                request.httpBody.map { String(decoding: $0, as: UTF8.self) } ?? ""
            ))
            if offline { throw URLError(.notConnectedToInternet) }
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
            return (Data(body.utf8), response)
        }
    }

    final class Ran { var scripts: [(source: String, arguments: [String: Any])] = [] }

    private func model(
        store: FakeStore = FakeStore(MarksCopyTests.session),
        server: FakeServer? = FakeServer(),
        storeBuild: Bool = false,
        on: String = #"{"format": 1}"#
    ) -> (ShellModel, Ran) {
        let ran = Ran()
        let model = ShellModel(launchRoute: nil)
        model.runScript = { ran.scripts.append(($0, $1)) }
        model.sessionStore = store
        model.credentialCheck = StaySignedInTests.FakeCheck(.allowed)
        model.server = server.map { SignIn.Server(base: Self.base, send: $0.send) }
        model.now = { Self.now }
        model.storeBuild = storeBuild
        model.loadStatus = { Data(on.utf8) }
        model.receive(.ready)
        return (model, ran)
    }

    private func ask(_ model: ShellModel, _ ran: Ran, _ name: String, text: String? = nil) async -> [String: Any]? {
        let id = "q-\(ran.scripts.count)-\(name)"
        model.receive(.ask(id: id, name: name, text: text))
        await model.lastAsk?.value
        return ran.scripts.first { $0.arguments["id"] as? String == id }?.arguments["answer"] as? [String: Any]
    }

    private func leaks(_ ran: Ran) -> Bool {
        ran.scripts.contains {
            let all = "\($0.source) \($0.arguments)"
            return all.contains("made-up-session") || all.contains("made-up-apple-user")
        }
    }

    // MARK: - Is the copy offered?

    @Test("the launch file may switch the copy on by its own name")
    func launchFileNamesIt() throws {
        let file = try #require(AppStatus.parse(Data(#"{"format": 1, "on": ["sign-in", "marks-copy"]}"#.utf8)))
        #expect(file.on == [.signIn, .marksCopy])
    }

    @Test("the store build offers the copy only when the launch file names both sign-in and the copy")
    func offered() {
        #expect(SignIn.copyOffered(server: true, on: [.signIn, .marksCopy], storeBuild: true))
        #expect(!SignIn.copyOffered(server: true, on: [.signIn], storeBuild: true))
        #expect(!SignIn.copyOffered(server: true, on: [.marksCopy], storeBuild: true))
        #expect(SignIn.copyOffered(server: true, on: [], storeBuild: false))
        #expect(!SignIn.copyOffered(server: false, on: [.signIn, .marksCopy], storeBuild: false))
    }

    @Test("in a store build whose launch file does not name the copy, every copy question says 'off' and hifth.app is not asked")
    func offInStore() async {
        let server = FakeServer()
        let (model, ran) = model(server: server, storeBuild: true, on: #"{"format": 1, "on": ["sign-in"]}"#)
        #expect(await ask(model, ran, "marks-fetch")?["error"] as? String == "off")
        #expect(await ask(model, ran, "marks-keep", text: Self.file)?["error"] as? String == "off")
        #expect(server.asked.isEmpty)
    }

    @Test("a reader can take their copy back even after the copy is switched off again")
    func dropWhenOff() async {
        let server = FakeServer()
        server.status = 204
        server.body = ""
        let (model, ran) = model(server: server, storeBuild: true, on: #"{"format": 1}"#)
        #expect(await ask(model, ran, "marks-drop")?["value"] as? String == "dropped")
        #expect(server.asked.first?.method == "DELETE")
    }

    @Test("a reader who is not signed in hears 'signed-out', and hifth.app is not asked")
    func signedOut() async {
        let server = FakeServer()
        let (model, ran) = model(store: FakeStore(), server: server)
        #expect(await ask(model, ran, "marks-fetch")?["error"] as? String == "signed-out")
        #expect(server.asked.isEmpty)
    }

    // MARK: - Fetching

    @Test("fetching asks GET /api/marks with the session in the Authorization line, and hands the page hifth.app's reply as it came")
    func fetch() async throws {
        let server = FakeServer()
        server.body = #"{"marks":\#(Self.file),"number":3,"savedAt":7}"#
        let (model, ran) = model(server: server)
        let answer = await ask(model, ran, "marks-fetch")
        #expect(answer?["ok"] as? Bool == true)
        #expect(answer?["value"] as? String == server.body)
        #expect(server.asked.count == 1)
        #expect(server.asked.first?.method == "GET")
        #expect(server.asked.first?.path == "/api/marks")
        #expect(server.asked.first?.authorization == "Bearer made-up-session")
        #expect(!leaks(ran))
    }

    @Test("a reader with no copy yet hears 'no-copy', not that sign-in is off")
    func fetchNone() async {
        let server = FakeServer()
        server.status = 404
        server.body = #"{"reason":"no-copy"}"#
        let (model, ran) = model(server: server)
        #expect(await ask(model, ran, "marks-fetch")?["error"] as? String == "no-copy")
    }

    @Test("hifth.app's own 404 for sign-in switched off is still 'sign-in-off'")
    func fetchClosed() async {
        let server = FakeServer()
        server.status = 404
        server.body = #"{"reason":"not-found"}"#
        let (model, ran) = model(server: server)
        #expect(await ask(model, ran, "marks-fetch")?["error"] as? String == "sign-in-off")
    }

    @Test("a copy larger than hifth.app keeps is refused as a bad reply, not handed to the page")
    func fetchTooBig() async {
        let server = FakeServer()
        server.body = #"{"marks":""# + String(repeating: "x", count: 1_700_000) + #"","number":1,"savedAt":1}"#
        let (model, ran) = model(server: server)
        #expect(await ask(model, ran, "marks-fetch")?["error"] as? String == "bad-reply")
    }

    @Test("a session hifth.app no longer knows signs this device out")
    func fetchRefused() async {
        let store = FakeStore(Self.session)
        let server = FakeServer()
        server.status = 401
        server.body = #"{"reason":"signed-out"}"#
        let (model, ran) = model(store: store, server: server)
        #expect(await ask(model, ran, "marks-fetch")?["error"] as? String == "signed-out")
        #expect(store.kept == nil)
        #expect(await ask(model, ran, "signed-in")?["value"] as? String == "signed-out")
    }

    @Test("with no connection the page hears 'offline'")
    func fetchOffline() async {
        let server = FakeServer()
        server.offline = true
        let (model, ran) = model(server: server)
        #expect(await ask(model, ran, "marks-fetch")?["error"] as? String == "offline")
    }

    // MARK: - Keeping

    @Test("keeping sends the page's text as the body of PUT /api/marks, untouched, and hands back hifth.app's reply")
    func keep() async throws {
        let server = FakeServer()
        server.body = #"{"number":4,"savedAt":9}"#
        let (model, ran) = model(server: server)
        let sent = #"{"marks":\#(Self.file),"after":3}"#
        let answer = await ask(model, ran, "marks-keep", text: sent)
        #expect(answer?["value"] as? String == server.body)
        #expect(server.asked.first?.method == "PUT")
        #expect(server.asked.first?.path == "/api/marks")
        #expect(server.asked.first?.authorization == "Bearer made-up-session")
        #expect(server.asked.first?.body == sent)
        #expect(!leaks(ran))
    }

    @Test("a newer copy on hifth.app is 'newer-copy', so the page fetches and merges before trying again")
    func keepNewer() async {
        let server = FakeServer()
        server.status = 409
        server.body = #"{"reason":"newer-copy","number":5}"#
        let (model, ran) = model(server: server)
        #expect(await ask(model, ran, "marks-keep", text: Self.file)?["error"] as? String == "newer-copy")
    }

    @Test("keeping with nothing to keep asks hifth.app nothing")
    func keepEmpty() async {
        let server = FakeServer()
        let (model, ran) = model(server: server)
        #expect(await ask(model, ran, "marks-keep")?["error"] as? String == "bad-request")
        #expect(server.asked.isEmpty)
    }

    // MARK: - Dropping

    @Test("taking the copy back asks DELETE /api/marks, and the reader stays signed in")
    func drop() async {
        let store = FakeStore(Self.session)
        let server = FakeServer()
        server.status = 204
        server.body = ""
        let (model, ran) = model(store: store, server: server)
        #expect(await ask(model, ran, "marks-drop")?["value"] as? String == "dropped")
        #expect(server.asked.first?.method == "DELETE")
        #expect(server.asked.first?.path == "/api/marks")
        #expect(store.kept != nil)
    }

    // MARK: - The bridge

    @Test("the marks the page keeps reach the app whole; every other question's text is still cut at 200 letters")
    func bridgeCarriesTheFile() throws {
        let long = String(repeating: "a", count: 500_000)
        let keep = try #require(BridgeMessage(body: ["type": "ask", "id": "1", "name": "marks-keep", "text": long]))
        #expect(keep == .ask(id: "1", name: "marks-keep", text: long))
        let other = try #require(BridgeMessage(body: ["type": "ask", "id": "2", "name": "sign-in", "text": long]))
        #expect(other == .ask(id: "2", name: "sign-in", text: String(repeating: "a", count: 200)))
    }

    @Test("the bridge keeps no more of a giant marks file than it takes to tell it is too big")
    func bridgeCutsTheGiant() throws {
        let giant = String(repeating: "a", count: SignIn.mostMarksBytes + 10)
        let keep = try #require(BridgeMessage(body: ["type": "ask", "id": "1", "name": "marks-keep", "text": giant]))
        guard case .ask(_, _, let text) = keep else { Issue.record("not a question"); return }
        #expect(text?.count == SignIn.mostMarksBytes + 1)
    }

    @Test("a marks file larger than hifth.app keeps is 'too-big', and hifth.app is not asked")
    func keepTooBig() async {
        let server = FakeServer()
        let (model, ran) = model(server: server)
        let giant = String(repeating: "a", count: SignIn.mostMarksBytes + 1)
        #expect(await ask(model, ran, "marks-keep", text: giant)?["error"] as? String == "too-big")
        // Counted in bytes, as hifth.app counts: Arabic letters take two each.
        let arabic = String(repeating: "\u{0628}", count: SignIn.mostMarksBytes / 2 + 1)
        #expect(await ask(model, ran, "marks-keep", text: arabic)?["error"] as? String == "too-big")
        #expect(server.asked.isEmpty)
    }
}
