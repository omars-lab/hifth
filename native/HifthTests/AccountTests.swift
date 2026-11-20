import Foundation
import Testing
@testable import Hifth

/// What the page's account section asks the app (sign-in steps 14 and 16,
/// docs/design/sign-in.md): whether sign-in is offered at all, signing out, deleting the
/// account, and the kept invite code. Every session, code and address here is made up.
@Suite("The account questions the page asks")
@MainActor
struct AccountTests {
    typealias FakeStore = StaySignedInTests.FakeStore
    typealias FakeInvites = InviteTests.FakeInvites

    static let session = SignIn.Session(token: "made-up-session", expiresAt: 1_900_000_000, appleUser: "made-up-apple-user")
    static let now = Date(timeIntervalSince1970: 1_800_000_000)
    static let base = URL(string: "https://sign-in.example")!

    /// hifth.app, played: it answers every call the same way and writes down what it was sent.
    final class FakeServer {
        var status = 200
        var body = "{}"
        var offline = false
        var asked: [(path: String, authorization: String?)] = []

        func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
            asked.append((request.url!.path, request.value(forHTTPHeaderField: "Authorization")))
            if offline { throw URLError(.notConnectedToInternet) }
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
            return (Data(body.utf8), response)
        }
    }

    final class Ran { var scripts: [(source: String, arguments: [String: Any])] = [] }

    private func model(
        store: FakeStore? = FakeStore(AccountTests.session),
        invites: FakeInvites? = nil,
        server: FakeServer? = FakeServer()
    ) -> (ShellModel, Ran) {
        let ran = Ran()
        let model = ShellModel(launchRoute: nil)
        model.runScript = { ran.scripts.append(($0, $1)) }
        model.sessionStore = store
        model.credentialCheck = StaySignedInTests.FakeCheck(.allowed)
        model.inviteStore = invites
        model.server = server.map { SignIn.Server(base: Self.base, send: $0.send) }
        model.now = { Self.now }
        return (model, ran)
    }

    private func ask(_ model: ShellModel, _ ran: Ran, _ name: String) async -> [String: Any]? {
        let id = "q-\(ran.scripts.count)-\(name)"
        model.receive(.ask(id: id, name: name))
        await model.lastAsk?.value
        return ran.scripts.first { $0.arguments["id"] as? String == id }?.arguments["answer"] as? [String: Any]
    }

    private func leaks(_ ran: Ran) -> Bool {
        ran.scripts.contains {
            let all = "\($0.source) \($0.arguments)"
            return all.contains("made-up-session") || all.contains("made-up-apple-user") || all.contains("MADE-UP-CODE")
        }
    }

    // MARK: - Is sign-in offered?

    @Test("the launch file may switch sign-in on, and a name from a later build is ignored")
    func launchFileOffers() throws {
        let file = try #require(AppStatus.parse(Data(#"{"format": 1, "on": ["sign-in", "a-part-from-later"]}"#.utf8)))
        #expect(file.on == [.signIn])
        #expect(file.verdict(platform: "ios", version: "0.1.0", dismissed: []).on == [.signIn])
        let plain = try #require(AppStatus.parse(Data(#"{"format": 1, "on": "sign-in"}"#.utf8)))
        #expect(plain.on.isEmpty)
    }

    @Test("the store build offers sign-in only when the launch file says so; a laptop trial that names a server always does")
    func offered() {
        #expect(SignIn.offered(server: true, on: [.signIn], storeBuild: true))
        #expect(!SignIn.offered(server: true, on: [], storeBuild: true))
        #expect(SignIn.offered(server: true, on: [], storeBuild: false))
        #expect(!SignIn.offered(server: false, on: [.signIn], storeBuild: false))
        #expect(!SignIn.offered(server: false, on: [.signIn], storeBuild: true))
    }

    @Test("'account' says 'off' in a store build until the launch file switches sign-in on")
    func accountOff() async throws {
        let (model, ran) = model(store: FakeStore())
        model.storeBuild = true
        model.loadStatus = { Data(#"{"format": 1}"#.utf8) }
        model.receive(.ready)
        #expect(await ask(model, ran, "account")?["value"] as? String == "off")
    }

    @Test("'account' waits for the launch file, and says 'signed-out' once it switches sign-in on")
    func accountOn() async throws {
        let (model, ran) = model(store: FakeStore())
        model.storeBuild = true
        model.loadStatus = { Data(#"{"format": 1, "on": ["sign-in"]}"#.utf8) }
        model.receive(.ready)
        #expect(await ask(model, ran, "account")?["value"] as? String == "signed-out")
    }

    @Test("a signed-in reader hears 'signed-in' even with sign-in switched off, so they can still sign out or delete")
    func accountSignedIn() async throws {
        let (model, ran) = model()
        model.storeBuild = true
        model.loadStatus = { nil }
        model.receive(.ready)
        #expect(await ask(model, ran, "account")?["value"] as? String == "signed-in")
        #expect(!leaks(ran))
    }

    @Test("a build that names no server says 'off'")
    func accountNoServer() async {
        let (model, ran) = model(store: nil, server: nil)
        #expect(await ask(model, ran, "account")?["value"] as? String == "off")
    }

    // MARK: - Signing out

    @Test("signing out empties the device's sign-in and tells hifth.app, with the session in the Authorization line")
    func signOut() async throws {
        let store = FakeStore(Self.session)
        let server = FakeServer()
        server.status = 204
        server.body = ""
        let (model, ran) = model(store: store, server: server)
        let answer = await ask(model, ran, "sign-out")
        await model.lastSignOut?.value
        #expect(answer?["value"] as? String == "signed-out")
        #expect(store.kept == nil)
        #expect(server.asked.count == 1)
        #expect(server.asked.first?.path == "/api/sign-out")
        #expect(server.asked.first?.authorization == "Bearer made-up-session")
        #expect(await ask(model, ran, "signed-in")?["value"] as? String == "signed-out")
        #expect(!leaks(ran))
    }

    @Test("signing out with no connection still signs this device out")
    func signOutOffline() async {
        let store = FakeStore(Self.session)
        let server = FakeServer()
        server.offline = true
        let (model, ran) = model(store: store, server: server)
        #expect(await ask(model, ran, "sign-out")?["value"] as? String == "signed-out")
        await model.lastSignOut?.value
        #expect(store.kept == nil)
    }

    @Test("signing out keeps the invite code, so the tester does not type it again")
    func signOutKeepsInvite() async {
        let invites = FakeInvites("MADE-UP-CODE")
        let (model, ran) = model(invites: invites)
        _ = await ask(model, ran, "sign-out")
        #expect(invites.kept == "MADE-UP-CODE")
    }

    @Test("signing out when nobody is signed in asks hifth.app nothing")
    func signOutWhenOut() async {
        let server = FakeServer()
        let (model, ran) = model(store: FakeStore(), server: server)
        #expect(await ask(model, ran, "sign-out")?["value"] as? String == "signed-out")
        await model.lastSignOut?.value
        #expect(server.asked.isEmpty)
    }

    // MARK: - Deleting the account

    @Test("deleting the account asks hifth.app, then empties the device: the sign-in and the invite code", arguments: [
        ("cut", "deleted-cut"), ("left", "deleted-left"), ("something-new", "deleted-left"),
    ])
    func delete(link: String, heard: String) async {
        let store = FakeStore(Self.session)
        let invites = FakeInvites("MADE-UP-CODE")
        let server = FakeServer()
        server.body = #"{"deleted": true, "appleLink": "\#(link)"}"#
        let (model, ran) = model(store: store, invites: invites, server: server)
        #expect(await ask(model, ran, "delete-account")?["value"] as? String == heard)
        #expect(server.asked.first?.path == "/api/sign-in/delete-account")
        #expect(server.asked.first?.authorization == "Bearer made-up-session")
        #expect(store.kept == nil)
        #expect(invites.kept == nil)
        #expect(await ask(model, ran, "signed-in")?["value"] as? String == "signed-out")
        #expect(!leaks(ran))
    }

    @Test("with no connection nothing is deleted and nothing on the device is touched")
    func deleteOffline() async {
        let store = FakeStore(Self.session)
        let invites = FakeInvites("MADE-UP-CODE")
        let server = FakeServer()
        server.offline = true
        let (model, ran) = model(store: store, invites: invites, server: server)
        let answer = await ask(model, ran, "delete-account")
        #expect(answer?["ok"] as? Bool == false)
        #expect(answer?["error"] as? String == "offline")
        #expect(store.kept == Self.session)
        #expect(invites.kept == "MADE-UP-CODE")
    }

    @Test("a server that fails, or answers without saying 'deleted', leaves the device signed in", arguments: [
        (500, "{}"), (200, "{}"), (200, #"{"deleted": false}"#), (404, "{}"),
    ])
    func deleteFails(status: Int, body: String) async {
        let store = FakeStore(Self.session)
        let server = FakeServer()
        server.status = status
        server.body = body
        let (model, ran) = model(store: store, server: server)
        #expect(await ask(model, ran, "delete-account")?["ok"] as? Bool == false)
        #expect(store.kept == Self.session)
    }

    @Test("hifth.app no longer knows this sign-in: the device is signed out and the page is told to sign in again first")
    func deleteUnknownSession() async {
        let store = FakeStore(Self.session)
        let server = FakeServer()
        server.status = 401
        server.body = #"{"reason": "signed-out"}"#
        let (model, ran) = model(store: store, server: server)
        let answer = await ask(model, ran, "delete-account")
        #expect(answer?["error"] as? String == "signed-out")
        #expect(store.kept == nil)
    }

    @Test("nobody signed in: 'delete-account' says 'signed-out' and asks hifth.app nothing")
    func deleteWhenOut() async {
        let server = FakeServer()
        let (model, ran) = model(store: FakeStore(), server: server)
        #expect(await ask(model, ran, "delete-account")?["error"] as? String == "signed-out")
        #expect(server.asked.isEmpty)
    }

    // MARK: - The kept invite code (sign-in ⑱)

    @Test("the page hears only whether a code is kept, never the code")
    func inviteKept() async {
        let (model, ran) = model(invites: FakeInvites("MADE-UP-CODE"))
        #expect(await ask(model, ran, "invite-kept")?["value"] as? String == "yes")
        #expect(!leaks(ran))
        let (none, ranNone) = self.model(invites: FakeInvites())
        #expect(await ask(none, ranNone, "invite-kept")?["value"] as? String == "no")
        let (noStore, ranNoStore) = self.model(invites: nil)
        #expect(await ask(noStore, ranNoStore, "invite-kept")?["value"] as? String == "no")
    }

    @Test("the tester can make the app forget the code")
    func forgetInvite() async {
        let invites = FakeInvites("MADE-UP-CODE")
        let (model, ran) = model(invites: invites)
        #expect(await ask(model, ran, "forget-invite")?["value"] as? String == "forgotten")
        #expect(invites.kept == nil)
        #expect(await ask(model, ran, "invite-kept")?["value"] as? String == "no")
    }
}
