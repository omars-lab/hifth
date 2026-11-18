import AuthenticationServices
import Foundation
import Testing
@testable import Hifth

/// Signing in from the app (sign-in step 8, docs/design/sign-in.md). The app asks hifth.app for a
/// one-off word, shows Apple's sheet with a scrambled copy of it, and hands Apple's note and the
/// word back to hifth.app for a session. Apple's sheet and the network are stand-ins here; every
/// word, note and session is made up.
@Suite("Signing in from the app")
@MainActor
struct SignInTests {
    static let base = URL(string: "https://sign-in.example.test")!

    /// What the stand-in server saw, and what it answers.
    final class FakeServer {
        var requests: [URLRequest] = []
        var answers: [(status: Int, body: String)] = []
        var offline = false

        func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
            requests.append(request)
            if offline { throw URLError(.notConnectedToInternet) }
            let (status, body) = answers.isEmpty ? (500, "") : answers.removeFirst()
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
            return (Data(body.utf8), response)
        }

        func body(_ index: Int) -> [String: Any]? {
            guard index < requests.count, let data = requests[index].httpBody else { return nil }
            return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        }
    }

    private func server(_ fake: FakeServer) -> SignIn.Server {
        SignIn.Server(base: Self.base, send: fake.send)
    }

    // MARK: - The scrambled word

    @Test("the word is scrambled the way the server checks it: lowercase hex SHA-256, the same value the server's own test pins")
    func scramble() {
        #expect(SignIn.scramble("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        #expect(SignIn.scramble("made-up-word").count == 64)
        #expect(SignIn.scramble("made-up-word") == SignIn.scramble("made-up-word").lowercased())
    }

    // MARK: - Asking hifth.app

    @Test("the word comes from a POST to the word address, with no cookies and nothing about the reader")
    func wordRequest() async throws {
        let fake = FakeServer()
        fake.answers = [(200, #"{"word":"made-up-word"}"#)]
        let word = try await server(fake).word()
        #expect(word == "made-up-word")
        let request = try #require(fake.requests.first)
        #expect(request.httpMethod == "POST")
        #expect(request.url?.absoluteString == "https://sign-in.example.test/api/sign-in/word")
        #expect(request.httpShouldHandleCookies == false)
        #expect(request.value(forHTTPHeaderField: "Authorization") == nil)
    }

    @Test("the note and the word go to the sign-in address as JSON, and nothing else does")
    func signInRequest() async throws {
        let fake = FakeServer()
        fake.answers = [(200, #"{"session":"made-up-session","expiresAt":1900000000}"#)]
        let session = try await server(fake).signIn(note: "made-up-note", word: "made-up-word")
        #expect(session == SignIn.Session(token: "made-up-session", expiresAt: 1_900_000_000))
        let request = try #require(fake.requests.first)
        #expect(request.httpMethod == "POST")
        #expect(request.url?.absoluteString == "https://sign-in.example.test/api/sign-in")
        #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
        #expect(request.httpShouldHandleCookies == false)
        let body = try #require(fake.body(0))
        #expect(Set(body.keys) == ["note", "word"])
        #expect(body["note"] as? String == "made-up-note")
        #expect(body["word"] as? String == "made-up-word")
    }

    @Test("each answer the server can give becomes its own plain reason", arguments: [
        (404, #"{"reason":"not-found"}"#, "sign-in-off"),
        (503, #"{"reason":"not-set-up"}"#, "not-set-up"),
        (400, #"{"reason":"bad-request"}"#, "bad-request"),
        (413, #"{"reason":"too-big"}"#, "too-big"),
        (401, #"{"reason":"word-mismatch"}"#, "refused:word-mismatch"),
        (401, #"{"reason":"word-unknown"}"#, "refused:word-unknown"),
        (401, #"{"reason":"<script>"}"#, "refused:script"),
        (401, "not json", "refused"),
        (500, "", "server-error"),
        (200, #"{"session":""}"#, "bad-reply"),
        (200, "<html>", "bad-reply"),
    ])
    func serverAnswers(status: Int, body: String, reason: String) async {
        let fake = FakeServer()
        fake.answers = [(status, body)]
        await #expect(throws: SignIn.Failure(reason)) {
            _ = try await server(fake).signIn(note: "made-up-note", word: "made-up-word")
        }
    }

    @Test("no connection is its own reason, not a refusal")
    func offline() async {
        let fake = FakeServer()
        fake.offline = true
        await #expect(throws: SignIn.Failure.offline) { _ = try await server(fake).word() }
    }

    @Test("a word that is empty or far too long is not a word")
    func badWord() async {
        for body in [#"{"word":""}"#, #"{"word":"\#(String(repeating: "a", count: 300))"}"#, #"{"words":"x"}"#] {
            let fake = FakeServer()
            fake.answers = [(200, body)]
            await #expect(throws: SignIn.Failure.badReply) { _ = try await server(fake).word() }
        }
    }

    // MARK: - The whole sign-in

    @Test("the word is asked for first and Apple is handed its scrambled copy, then the note and the plain word go back")
    func wholeSignIn() async throws {
        let fake = FakeServer()
        fake.answers = [(200, #"{"word":"made-up-word"}"#), (200, #"{"session":"made-up-session","expiresAt":1900000000}"#)]
        var appleGot: String?
        let result = await SignIn.run(server: server(fake)) { nonce in
            appleGot = nonce
            return SignIn.AppleAnswer(note: "made-up-note", code: "made-up-code", user: "made-up-apple-user")
        }
        #expect(appleGot == SignIn.scramble("made-up-word"))
        #expect(try result.get() == SignIn.Session(token: "made-up-session", expiresAt: 1_900_000_000, appleUser: "made-up-apple-user"))
        #expect(fake.body(1)?["word"] as? String == "made-up-word")
        #expect(fake.body(1)?["note"] as? String == "made-up-note")
    }

    @Test("when sign-in is switched off on the server, Apple's sheet never shows")
    func offMeansNoSheet() async {
        let fake = FakeServer()
        fake.answers = [(404, #"{"reason":"not-found"}"#)]
        var sheetShown = false
        let result = await SignIn.run(server: server(fake)) { _ in
            sheetShown = true
            return SignIn.AppleAnswer(note: "made-up-note", code: nil, user: "made-up-apple-user")
        }
        #expect(sheetShown == false)
        #expect(result == .failure(SignIn.Failure("sign-in-off")))
        #expect(fake.requests.count == 1)
    }

    @Test("closing Apple's sheet ends the sign-in, and nothing more is sent")
    func cancelled() async {
        let fake = FakeServer()
        fake.answers = [(200, #"{"word":"made-up-word"}"#)]
        let result = await SignIn.run(server: server(fake)) { _ in throw SignIn.Failure.cancelled }
        #expect(result == .failure(.cancelled))
        #expect(fake.requests.count == 1)
    }

    @Test("Apple's own errors: closing the sheet is 'cancelled', anything else is 'not-available'")
    func appleErrors() {
        #expect(SignIn.failure(for: ASAuthorizationError(.canceled)) == .cancelled)
        #expect(SignIn.failure(for: ASAuthorizationError(.unknown)) == .notAvailable)
        #expect(SignIn.failure(for: ASAuthorizationError(.failed)) == .notAvailable)
        #expect(SignIn.failure(for: URLError(.timedOut)) == .notAvailable)
    }

    @Test("Apple is asked for no name and no email: the server keeps neither")
    func noScopes() {
        let request = SignIn.appleRequest(nonce: SignIn.scramble("made-up-word"))
        #expect(request.requestedScopes?.isEmpty ?? true)
        #expect(request.nonce == SignIn.scramble("made-up-word"))
    }

    // MARK: - Where the app finds hifth.app

    #if !STORE
    @Test("off the store build, the app calls a sign-in server only when a launch setting names one")
    func address() {
        #expect(SignIn.address([:]) == nil)
        #expect(SignIn.address(["HIFTH_SIGN_IN_URL": "http://127.0.0.1:8788"])?.absoluteString == "http://127.0.0.1:8788")
    }
    #endif

    // MARK: - The page's question

    final class Ran { var scripts: [(source: String, arguments: [String: Any])] = [] }

    private func model(_ signIn: @escaping () async -> Result<SignIn.Session, SignIn.Failure>) -> (ShellModel, Ran) {
        let ran = Ran()
        let model = ShellModel(launchRoute: nil)
        model.runScript = { ran.scripts.append(($0, $1)) }
        model.signIn = signIn
        return (model, ran)
    }

    private func answer(_ ran: Ran, _ id: String) -> [String: Any]? {
        ran.scripts.first { $0.arguments["id"] as? String == id }?.arguments["answer"] as? [String: Any]
    }

    @Test("the page asking 'sign-in' hears only 'signed-in'; the session stays in the app")
    func pageHearsSignedIn() async {
        let (model, ran) = model { .success(SignIn.Session(token: "made-up-session", expiresAt: 1_900_000_000)) }
        model.receive(.ask(id: "s-1", name: "sign-in"))
        await model.lastAsk?.value
        let answer = answer(ran, "s-1")
        #expect(answer?["ok"] as? Bool == true)
        #expect(answer?["value"] as? String == "signed-in")
        #expect(answer?.count == 2)
        #expect(ran.scripts.allSatisfy { !"\($0.arguments)".contains("made-up-session") })
        #expect(model.session?.token == "made-up-session")
    }

    @Test("a sign-in that fails tells the page why, in a word it can act on")
    func pageHearsWhy() async {
        let (model, ran) = model { .failure(.cancelled) }
        model.receive(.ask(id: "s-2", name: "sign-in"))
        await model.lastAsk?.value
        let answer = answer(ran, "s-2")
        #expect(answer?["ok"] as? Bool == false)
        #expect(answer?["error"] as? String == "cancelled")
        #expect(model.session == nil)
    }

    @Test("a second 'sign-in' while one is open gets 'busy' at once, and the first still gets its answer")
    func secondAskIsBusy() async {
        var release: CheckedContinuation<Void, Never>?
        var started = 0
        let (model, ran) = model {
            started += 1
            await withCheckedContinuation { release = $0 }
            return .success(SignIn.Session(token: "made-up-session", expiresAt: 1_900_000_000))
        }
        model.receive(.ask(id: "first", name: "sign-in"))
        let first = model.lastAsk
        while release == nil { await Task.yield() }
        model.receive(.ask(id: "second", name: "sign-in"))
        await model.lastAsk?.value
        #expect(answer(ran, "second")?["error"] as? String == "busy")
        #expect(started == 1)
        release?.resume()
        await first?.value
        #expect(answer(ran, "first")?["value"] as? String == "signed-in")
    }
}
