import Foundation
import Testing
@testable import Hifth

/// The tester's invite code in the app (sign-in step 18, docs/design/sign-in.md). While sign-in
/// is for invited testers, the page hands the app the code the tester typed; the app sends it
/// with the ask for a one-off word and keeps it on the device, so it is typed once. Every code
/// here is made up.
@Suite("The invite code in the app")
@MainActor
struct InviteTests {
    /// The Keychain's stand-in for the invite code: only a variable.
    final class FakeInvites: InviteStore {
        var kept: String?
        var saves = 0
        var clears = 0
        init(_ kept: String? = nil) { self.kept = kept }
        func load() -> String? { kept }
        func save(_ invite: String) -> Bool {
            saves += 1
            kept = invite
            return true
        }
        func clear() {
            clears += 1
            kept = nil
        }
    }

    final class Ran { var scripts: [(source: String, arguments: [String: Any])] = [] }
    /// What the stand-in sign-in was handed.
    final class Seen { var invites: [String?] = [] }

    static let session = SignIn.Session(token: "made-up-session", expiresAt: 1_900_000_000, appleUser: "made-up-apple-user")

    /// A model whose sign-in is played: `wordGiven` says whether the server handed out a word
    /// (so the code was accepted), and `result` is how the sign-in ended.
    private func model(
        invites: FakeInvites?,
        wordGiven: Bool,
        result: Result<SignIn.Session, SignIn.Failure>
    ) -> (ShellModel, Ran, Seen) {
        let ran = Ran()
        let seen = Seen()
        let model = ShellModel(launchRoute: nil)
        model.runScript = { ran.scripts.append(($0, $1)) }
        model.inviteStore = invites
        model.signIn = { invite, accepted in
            seen.invites.append(invite)
            if wordGiven { accepted() }
            return result
        }
        return (model, ran, seen)
    }

    private func answer(_ ran: Ran, _ id: String) -> [String: Any]? {
        ran.scripts.first { $0.arguments["id"] as? String == id }?.arguments["answer"] as? [String: Any]
    }

    @Test("a typed code goes to the sign-in, and is kept once the server has taken it")
    func typedCodeIsKept() async {
        let invites = FakeInvites()
        let (model, ran, seen) = model(invites: invites, wordGiven: true, result: .success(Self.session))
        model.receive(.ask(id: "i-1", name: "sign-in", text: "0a1b-2c3d-4e5f-6g7h"))
        await model.lastAsk?.value
        #expect(seen.invites == ["0a1b-2c3d-4e5f-6g7h"])
        #expect(invites.kept == "0a1b-2c3d-4e5f-6g7h")
        #expect(answer(ran, "i-1")?["value"] as? String == "signed-in")
        #expect(ran.scripts.allSatisfy { !"\($0.arguments)".contains("0a1b") })
    }

    @Test("the code is kept even when the tester then closes Apple's sheet, so it is typed once")
    func keptWhenTheSheetIsClosed() async {
        let invites = FakeInvites()
        let (model, _, _) = model(invites: invites, wordGiven: true, result: .failure(.cancelled))
        model.receive(.ask(id: "i-2", name: "sign-in", text: "0a1b-2c3d-4e5f-6g7h"))
        await model.lastAsk?.value
        #expect(invites.kept == "0a1b-2c3d-4e5f-6g7h")
    }

    @Test("a code the server turns down is not kept, and the page hears 'invite-needed'")
    func wrongCodeIsNotKept() async {
        let invites = FakeInvites()
        let (model, ran, _) = model(invites: invites, wordGiven: false, result: .failure(.inviteNeeded))
        model.receive(.ask(id: "i-3", name: "sign-in", text: "zzzz-zzzz-zzzz-zzzz"))
        await model.lastAsk?.value
        #expect(invites.kept == nil)
        #expect(invites.saves == 0)
        #expect(answer(ran, "i-3")?["error"] as? String == "invite-needed")
    }

    @Test("with nothing typed, the kept code is sent")
    func keptCodeIsSent() async {
        let invites = FakeInvites("0a1b-2c3d-4e5f-6g7h")
        let (model, _, seen) = model(invites: invites, wordGiven: true, result: .success(Self.session))
        model.receive(.ask(id: "i-4", name: "sign-in"))
        await model.lastAsk?.value
        #expect(seen.invites == ["0a1b-2c3d-4e5f-6g7h"])
        #expect(invites.saves == 0)
    }

    @Test("a kept code the server no longer takes is dropped, so the tester is asked for a new one")
    func staleCodeIsDropped() async {
        let invites = FakeInvites("0a1b-2c3d-4e5f-6g7h")
        let (model, _, _) = model(invites: invites, wordGiven: false, result: .failure(.inviteNeeded))
        model.receive(.ask(id: "i-5", name: "sign-in"))
        await model.lastAsk?.value
        #expect(invites.kept == nil)
    }

    @Test("no connection, a busy server or any other failure leaves the kept code alone", arguments: [
        SignIn.Failure.offline, SignIn.Failure.tooMany, SignIn.Failure("server-error"), SignIn.Failure.off,
    ])
    func otherFailuresKeepTheCode(failure: SignIn.Failure) async {
        let invites = FakeInvites("0a1b-2c3d-4e5f-6g7h")
        let (model, _, _) = model(invites: invites, wordGiven: false, result: .failure(failure))
        model.receive(.ask(id: "i-6", name: "sign-in"))
        await model.lastAsk?.value
        #expect(invites.kept == "0a1b-2c3d-4e5f-6g7h")
        #expect(invites.clears == 0)
    }

    @Test("with no code typed and none kept, the sign-in is asked with none")
    func noCode() async {
        let (model, _, seen) = model(invites: FakeInvites(), wordGiven: true, result: .success(Self.session))
        model.receive(.ask(id: "i-7", name: "sign-in", text: "   "))
        await model.lastAsk?.value
        #expect(seen.invites == [nil])
    }

    @Test("a build with nowhere to keep the code still sends a typed one")
    func nowhereToKeepIt() async {
        let (model, ran, seen) = model(invites: nil, wordGiven: true, result: .success(Self.session))
        model.receive(.ask(id: "i-8", name: "sign-in", text: "0a1b-2c3d-4e5f-6g7h"))
        await model.lastAsk?.value
        #expect(seen.invites == ["0a1b-2c3d-4e5f-6g7h"])
        #expect(answer(ran, "i-8")?["value"] as? String == "signed-in")
    }

    @Test("a dropped session leaves the invite code where it is")
    func signedOutKeepsTheCode() async {
        let invites = FakeInvites("0a1b-2c3d-4e5f-6g7h")
        let (model, ran, _) = model(invites: invites, wordGiven: true, result: .success(Self.session))
        model.sessionStore = StaySignedInTests.FakeStore(SignIn.Session(token: "made-up-session", expiresAt: 1, appleUser: "made-up-apple-user"))
        model.receive(.ask(id: "i-9", name: "signed-in"))
        await model.lastAsk?.value
        #expect(answer(ran, "i-9")?["value"] as? String == "signed-out")
        #expect(invites.kept == "0a1b-2c3d-4e5f-6g7h")
        #expect(invites.clears == 0)
    }

    @Test("a build that names no sign-in server has no Keychain item for the code")
    func noServerNoKeychain() {
        #expect(SignIn.realInviteStore(at: nil) == nil)
        #expect(SignIn.realInviteStore(at: URL(string: "https://sign-in.example.test")) != nil)
    }

    @Test("the code's Keychain item is its own, apart from the session's, and stays on this device")
    func keychainItem() {
        let item = KeychainInviteStore.item()
        #expect(item[kSecAttrService as String] as? String != KeychainSessionStore.service)
        #expect(item[kSecAttrSynchronizable as String] as? Bool == false)
        #expect(item[kSecUseDataProtectionKeychain as String] as? Bool == true)
        let written = KeychainInviteStore.item(holding: Data("made-up".utf8))
        #expect(written[kSecAttrAccessible as String] as? String == kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String)
    }

    @Test("the sign-in says the code was taken as soon as the word comes back, before Apple's sheet")
    func acceptedBeforeTheSheet() async {
        let fake = SignInTests.FakeServer()
        fake.answers = [(200, #"{"word":"made-up-word"}"#)]
        var order: [String] = []
        let server = SignIn.Server(base: SignInTests.base, send: fake.send)
        _ = await SignIn.run(server: server, invite: "0a1b-2c3d-4e5f-6g7h", invited: { order.append("taken") }) { _ in
            order.append("sheet")
            throw SignIn.Failure.cancelled
        }
        #expect(order == ["taken", "sheet"])
    }

    @Test("a refused code is never said to be taken")
    func refusedIsNotAccepted() async {
        let fake = SignInTests.FakeServer()
        fake.answers = [(403, #"{"reason":"invite-needed"}"#)]
        var taken = false
        let server = SignIn.Server(base: SignInTests.base, send: fake.send)
        _ = await SignIn.run(server: server, invite: "zzzz", invited: { taken = true }) { _ in
            SignIn.AppleAnswer(note: "made-up-note", code: nil, user: "made-up-apple-user")
        }
        #expect(!taken)
    }
}
