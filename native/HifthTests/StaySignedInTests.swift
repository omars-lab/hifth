import AuthenticationServices
import Foundation
import Security
import Testing
@testable import Hifth

/// Staying signed in (sign-in step 15, docs/design/sign-in.md). The session is kept in the
/// Keychain, and at each launch the app asks Apple whether the reader still lets Hifth use their
/// Apple account. The Keychain and Apple's answer are stand-ins here; every session and user id
/// is made up, and nothing in this file touches the real Keychain or a real Apple account.
@Suite("Staying signed in")
@MainActor
struct StaySignedInTests {
    static let later = 1_900_000_000
    static let now = Date(timeIntervalSince1970: 1_800_000_000)
    static let saved = SignIn.Session(token: "made-up-session", expiresAt: later, appleUser: "made-up-apple-user")

    /// A Keychain that is only a variable.
    final class FakeStore: SessionStore {
        var kept: SignIn.Session?
        var loads = 0
        var saves = 0
        var clears = 0
        /// A Keychain that refuses to keep anything, as the everyday Mac build's may.
        var refusesToSave = false

        init(_ kept: SignIn.Session? = nil) { self.kept = kept }

        func load() -> SignIn.Session? {
            loads += 1
            return kept
        }

        func save(_ session: SignIn.Session) -> Bool {
            saves += 1
            if refusesToSave { return false }
            kept = session
            return true
        }

        func clear() {
            clears += 1
            kept = nil
        }
    }

    /// Apple's answer, played.
    final class FakeCheck: CredentialCheck {
        var answer: SignIn.Standing
        var asked: [String] = []
        init(_ answer: SignIn.Standing) { self.answer = answer }

        func standing(of appleUser: String) async -> SignIn.Standing {
            asked.append(appleUser)
            return answer
        }
    }

    // MARK: - What is kept

    @Test("Apple's user id comes back with the session, so the next launch has someone to ask Apple about")
    func userIdIsCarried() async throws {
        let fake = SignInTests.FakeServer()
        fake.answers = [(200, #"{"word":"made-up-word"}"#), (200, #"{"session":"made-up-session","expiresAt":1900000000}"#)]
        let server = SignIn.Server(base: SignInTests.base, send: fake.send)
        let result = await SignIn.run(server: server) { _ in
            SignIn.AppleAnswer(note: "made-up-note", code: nil, user: "made-up-apple-user")
        }
        #expect(try result.get() == Self.saved)
        // The user id stays on the device: the server reads it from Apple's note, not from us.
        #expect(fake.body(1).map { Set($0.keys) } == ["note", "word"])
    }

    @Test("a session survives being written down and read back")
    func roundTrip() throws {
        let data = try #require(KeychainSessionStore.encode(Self.saved))
        #expect(KeychainSessionStore.decode(data) == Self.saved)
        #expect(KeychainSessionStore.decode(Data("not a session".utf8)) == nil)
    }

    @Test("the Keychain item stays on this device: not synced to iCloud, not restored onto another device, readable once the device has been unlocked")
    func keychainItem() {
        let item = KeychainSessionStore.item()
        #expect(item[kSecClass as String] as? String == kSecClassGenericPassword as String)
        #expect(item[kSecAttrService as String] as? String == "app.hifth.session")
        #expect(item[kSecAttrSynchronizable as String] as? Bool == false)
        #expect(item[kSecUseDataProtectionKeychain as String] as? Bool == true)
        let written = KeychainSessionStore.item(holding: Data("x".utf8))
        #expect(written[kSecAttrAccessible as String] as? String == kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String)
        #expect(written[kSecValueData as String] as? Data == Data("x".utf8))
    }

    // MARK: - The check at launch

    @Test("nothing saved: signed out, and Apple is not asked")
    func nothingSaved() async {
        let store = FakeStore()
        let check = FakeCheck(.allowed)
        #expect(await SignIn.restore(from: store, check: check, now: Self.now) == nil)
        #expect(check.asked.isEmpty)
        #expect(store.clears == 0)
    }

    @Test("Apple says the reader still allows Hifth: the saved session is used")
    func allowed() async {
        let store = FakeStore(Self.saved)
        let check = FakeCheck(.allowed)
        #expect(await SignIn.restore(from: store, check: check, now: Self.now) == Self.saved)
        #expect(check.asked == ["made-up-apple-user"])
        #expect(store.kept == Self.saved)
    }

    @Test("the reader cut Hifth off in their Apple settings, or Apple does not know them: the saved session is dropped", arguments: [
        SignIn.Standing.revoked, SignIn.Standing.notFound,
    ])
    func cutOff(standing: SignIn.Standing) async {
        let store = FakeStore(Self.saved)
        #expect(await SignIn.restore(from: store, check: FakeCheck(standing), now: Self.now) == nil)
        #expect(store.kept == nil)
        #expect(store.clears == 1)
    }

    @Test("Apple could not say (no connection, an error): the session is kept, so a launch offline does not sign the reader out")
    func couldNotTell() async {
        let store = FakeStore(Self.saved)
        #expect(await SignIn.restore(from: store, check: FakeCheck(.unknown), now: Self.now) == Self.saved)
        #expect(store.clears == 0)
    }

    @Test("a session past its end is dropped without asking Apple")
    func expired() async {
        let old = SignIn.Session(token: "made-up-session", expiresAt: 1_700_000_000, appleUser: "made-up-apple-user")
        let store = FakeStore(old)
        let check = FakeCheck(.allowed)
        #expect(await SignIn.restore(from: store, check: check, now: Self.now) == nil)
        #expect(check.asked.isEmpty)
        #expect(store.kept == nil)
    }

    @Test("a saved session with no Apple user id cannot be checked, so it is dropped")
    func noUser() async {
        let store = FakeStore(SignIn.Session(token: "made-up-session", expiresAt: Self.later))
        let check = FakeCheck(.allowed)
        #expect(await SignIn.restore(from: store, check: check, now: Self.now) == nil)
        #expect(check.asked.isEmpty)
        #expect(store.kept == nil)
    }

    @Test("Apple's own words for where the reader stands, as ours")
    func appleWords() {
        #expect(SignIn.standing(for: .authorized) == .allowed)
        #expect(SignIn.standing(for: .revoked) == .revoked)
        #expect(SignIn.standing(for: .notFound) == .notFound)
        // The app moved to another developer team: not the reader's doing, so nothing is dropped.
        #expect(SignIn.standing(for: .transferred) == .unknown)
    }

    // MARK: - In the app

    final class Ran { var scripts: [(source: String, arguments: [String: Any])] = [] }

    private func model(store: FakeStore?, check: FakeCheck?) -> (ShellModel, Ran) {
        let ran = Ran()
        let model = ShellModel(launchRoute: nil)
        model.runScript = { ran.scripts.append(($0, $1)) }
        model.sessionStore = store
        model.credentialCheck = check
        model.now = { Self.now }
        return (model, ran)
    }

    private func answer(_ ran: Ran, _ id: String) -> [String: Any]? {
        ran.scripts.first { $0.arguments["id"] as? String == id }?.arguments["answer"] as? [String: Any]
    }

    private func leaks(_ ran: Ran) -> Bool {
        ran.scripts.contains { "\($0.source) \($0.arguments)".contains("made-up-session") || "\($0.source) \($0.arguments)".contains("made-up-apple-user") }
    }

    @Test("a sign-in that works is written to the Keychain")
    func signInIsSaved() async {
        let store = FakeStore()
        let (model, ran) = model(store: store, check: FakeCheck(.allowed))
        model.signIn = { _, _ in .success(Self.saved) }
        model.receive(.ask(id: "s-1", name: "sign-in"))
        await model.lastAsk?.value
        #expect(store.kept == Self.saved)
        #expect(answer(ran, "s-1")?["value"] as? String == "signed-in")
        #expect(!leaks(ran))
    }

    @Test("a Keychain that will not keep the session does not fail the sign-in: the reader is signed in until the app closes")
    func keychainRefuses() async {
        let store = FakeStore()
        store.refusesToSave = true
        let (model, ran) = model(store: store, check: FakeCheck(.allowed))
        model.signIn = { _, _ in .success(Self.saved) }
        model.receive(.ask(id: "s-1", name: "sign-in"))
        await model.lastAsk?.value
        #expect(store.saves == 1)
        #expect(answer(ran, "s-1")?["value"] as? String == "signed-in")
        #expect(model.session == Self.saved)
    }

    @Test("at launch the saved session is read once and checked with Apple, and the page hears nothing it did not ask for")
    func launchRestores() async {
        let store = FakeStore(Self.saved)
        let check = FakeCheck(.allowed)
        let (model, ran) = model(store: store, check: check)
        model.receive(.ready)
        model.receive(.ready)
        await model.sessionCheck?.value
        #expect(model.session == Self.saved)
        #expect(store.loads == 1)
        #expect(check.asked == ["made-up-apple-user"])
        #expect(!leaks(ran))
    }

    @Test("the page asking 'signed-in' after a relaunch hears only 'signed-in': never the session, never the Apple user id")
    func pageHearsSignedIn() async {
        let (model, ran) = model(store: FakeStore(Self.saved), check: FakeCheck(.allowed))
        // No "ready" first: the question waits for the launch check itself.
        model.receive(.ask(id: "q-1", name: "signed-in"))
        await model.lastAsk?.value
        let answer = answer(ran, "q-1")
        #expect(answer?["ok"] as? Bool == true)
        #expect(answer?["value"] as? String == "signed-in")
        #expect(answer?.count == 2)
        #expect(!leaks(ran))
    }

    @Test("after the reader cuts Hifth off in their Apple settings, the next launch answers 'signed-out' and the Keychain is empty")
    func pageHearsSignedOut() async {
        let store = FakeStore(Self.saved)
        let (model, ran) = model(store: store, check: FakeCheck(.revoked))
        model.receive(.ready)
        model.receive(.ask(id: "q-1", name: "signed-in"))
        await model.lastAsk?.value
        let answer = answer(ran, "q-1")
        #expect(answer?["ok"] as? Bool == true)
        #expect(answer?["value"] as? String == "signed-out")
        #expect(answer?.count == 2)
        #expect(model.session == nil)
        #expect(store.kept == nil)
    }

    @Test("a reader who never signed in hears 'signed-out'")
    func neverSignedIn() async {
        let (model, ran) = model(store: FakeStore(), check: FakeCheck(.allowed))
        model.receive(.ask(id: "q-1", name: "signed-in"))
        await model.lastAsk?.value
        #expect(answer(ran, "q-1")?["value"] as? String == "signed-out")
    }

    @Test("a session that runs out while the app is open is dropped the next time the page asks")
    func runsOutWhileOpen() async {
        let store = FakeStore(Self.saved)
        let (model, ran) = model(store: store, check: FakeCheck(.allowed))
        model.receive(.ask(id: "q-1", name: "signed-in"))
        await model.lastAsk?.value
        #expect(answer(ran, "q-1")?["value"] as? String == "signed-in")
        model.now = { Date(timeIntervalSince1970: TimeInterval(Self.later + 1)) }
        model.receive(.ask(id: "q-2", name: "signed-in"))
        await model.lastAsk?.value
        #expect(answer(ran, "q-2")?["value"] as? String == "signed-out")
        #expect(store.kept == nil)
    }

    @Test("a sign-in asked for while the launch check is still running is not undone by it")
    func signInWaitsForTheCheck() async {
        let fresh = SignIn.Session(token: "made-up-fresh", expiresAt: Self.later, appleUser: "made-up-apple-user")
        let store = FakeStore(Self.saved)
        let (model, _) = model(store: store, check: FakeCheck(.revoked))
        model.signIn = { _, _ in .success(fresh) }
        model.receive(.ready)
        model.receive(.ask(id: "s-1", name: "sign-in"))
        await model.lastAsk?.value
        await model.sessionCheck?.value
        #expect(model.session == fresh)
        #expect(store.kept == fresh)
    }

    #if !STORE
    @Test("a build that names no sign-in server keeps nothing and asks Apple nothing: the laptop's tests and walks never touch the real Keychain")
    func offMeansNoKeychain() {
        let model = ShellModel(launchRoute: nil)
        #expect((model.sessionStore == nil) == (SignIn.address() == nil))
        #expect((model.credentialCheck == nil) == (SignIn.address() == nil))
        #expect(SignIn.realStore(at: nil) == nil)
        #expect(SignIn.realCheck(at: nil) == nil)
    }
    #endif
}
