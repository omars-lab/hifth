import AuthenticationServices
import CryptoKit
import Foundation

/// Signing in from the app (sign-in step 8 in docs/design/sign-in.md). The page asks the app
/// "sign-in" (`askApp` in apps/web/src/native-bridge.ts); the app then:
///
/// 1. asks hifth.app for a fresh one-off word (`POST /api/sign-in/word`);
/// 2. shows Apple's sheet with a scrambled copy of the word, asking Apple for no name and no
///    email, because the server keeps neither;
/// 3. hands Apple's note and the plain word to hifth.app (`POST /api/sign-in`), which checks the
///    note was made for this word and answers with a session;
/// 4. tells the page only "signed-in". The session never reaches the page.
///
/// The word is asked for before the sheet, so a server with sign-in switched off answers before
/// Face ID is ever shown. The server side is apps/landing/lib/sign-in-api.mjs.
enum SignIn {
    /// Why a sign-in did not happen, in a word the page can act on.
    struct Failure: Error, Equatable, Sendable {
        let code: String
        init(_ code: String) { self.code = code }

        /// The reader closed Apple's sheet.
        static let cancelled = Failure("cancelled")
        /// hifth.app could not be reached.
        static let offline = Failure("offline")
        /// hifth.app or Apple answered with something that is not what was asked for.
        static let badReply = Failure("bad-reply")
        /// A sign-in is already open; the second ask is turned away, not queued.
        static let busy = Failure("busy")
        /// The app has no window to show Apple's sheet over.
        static let noWindow = Failure("no-window")
        /// Apple's sheet could not be shown or did not finish: no Apple account on the device,
        /// or a build without the Sign in with Apple permission.
        static let notAvailable = Failure("not-available")
        /// Sign-in is switched off on the server (it answers 404), or this build names no server.
        static let off = Failure("sign-in-off")

        /// hifth.app turned the note down. Its reason is kept, cut down to plain letters, digits
        /// and dashes, since it comes from outside the app.
        static func refused(_ reason: String?) -> Failure {
            let clean = String((reason ?? "").filter { $0.isASCII && ($0.isLowercase || $0.isNumber || $0 == "-") }.prefix(40))
            return Failure(clean.isEmpty ? "refused" : "refused:\(clean)")
        }
    }

    /// What hifth.app hands back: the session, and when it ends (seconds since 1970). With it
    /// goes Apple's lasting id for the reader, which the app needs at each launch to ask Apple
    /// whether the reader still allows Hifth. Kept in the Keychain (step 15, StaySignedIn.swift);
    /// none of it ever reaches the page.
    struct Session: Equatable, Sendable, Codable {
        let token: String
        let expiresAt: Int
        var appleUser = ""
    }

    /// What Apple's sheet hands back: its signed note, the one-time code the server will trade
    /// for the ticket that lets it cancel the sign-in later (step 13; not sent yet), and Apple's
    /// lasting id for the reader, which stays on the device.
    struct AppleAnswer: Sendable {
        let note: String
        let code: String?
        let user: String
    }

    /// The scrambled copy of the word Apple signs into its note: the lowercase hex SHA-256, the
    /// same as `hashWord` in apps/landing/lib/apple-signin.mjs.
    static func scramble(_ word: String) -> String {
        SHA256.hash(data: Data(word.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    /// Apple's request: the scrambled word, and no name or email asked for.
    static func appleRequest(nonce: String) -> ASAuthorizationAppleIDRequest {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = []
        request.nonce = nonce
        return request
    }

    /// Apple's error, as a reason: closing the sheet is "cancelled", anything else means the
    /// sheet could not do its work here.
    static func failure(for error: Error) -> Failure {
        if let failure = error as? Failure { return failure }
        if let apple = error as? ASAuthorizationError, apple.code == .canceled { return .cancelled }
        return .notAvailable
    }

    /// The whole sign-in, with Apple's sheet passed in so the tests can play it.
    static func run(
        server: Server,
        askApple: (_ nonce: String) async throws -> AppleAnswer
    ) async -> Result<Session, Failure> {
        do {
            let word = try await server.word()
            let apple: AppleAnswer
            do { apple = try await askApple(scramble(word)) } catch { throw failure(for: error) }
            var session = try await server.signIn(note: apple.note, word: word)
            session.appleUser = apple.user
            return .success(session)
        } catch let failure as Failure {
            return .failure(failure)
        } catch {
            return .failure(.badReply)
        }
    }

    // MARK: - hifth.app

    /// hifth.app's two sign-in addresses.
    struct Server {
        let base: URL
        /// How a request leaves; the tests replace it with a stand-in server.
        var send: (URLRequest) async throws -> (Data, URLResponse) = Server.ephemeral

        /// A fresh one-off word, good for ten minutes.
        func word() async throws -> String {
            let reply = try await call("api/sign-in/word", body: nil)
            guard let word = reply["word"] as? String, (1...256).contains(word.count) else { throw Failure.badReply }
            return word
        }

        /// Apple's note and the plain word, traded for a session.
        func signIn(note: String, word: String) async throws -> Session {
            let reply = try await call("api/sign-in", body: ["note": note, "word": word])
            guard let token = reply["session"] as? String, !token.isEmpty,
                  let expiresAt = (reply["expiresAt"] as? NSNumber)?.intValue
            else { throw Failure.badReply }
            return Session(token: token, expiresAt: expiresAt)
        }

        private func call(_ path: String, body: [String: String]?) async throws -> [String: Any] {
            var request = URLRequest(url: base.appending(path: path))
            request.httpMethod = "POST"
            request.httpShouldHandleCookies = false
            if let body {
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
            }
            let data: Data
            let response: URLResponse
            do { (data, response) = try await send(request) } catch { throw Failure.offline }
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let json = data.count <= 64 * 1024
                ? (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
                : nil
            switch status {
            case 200:
                guard let json else { throw Failure.badReply }
                return json
            case 404: throw Failure.off
            case 503: throw Failure("not-set-up")
            case 400: throw Failure("bad-request")
            case 413: throw Failure("too-big")
            case 401: throw Failure.refused(json?["reason"] as? String)
            default: throw Failure("server-error")
            }
        }

        /// No cookies, no cache, nothing kept on disk: a session is in the reply.
        static func ephemeral(_ request: URLRequest) async throws -> (Data, URLResponse) {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            configuration.httpCookieAcceptPolicy = .never
            configuration.httpShouldSetCookies = false
            configuration.urlCache = nil
            configuration.timeoutIntervalForRequest = 20
            configuration.timeoutIntervalForResource = 20
            let session = URLSession(configuration: configuration)
            defer { session.finishTasksAndInvalidate() }
            return try await session.data(for: request)
        }
    }

    /// Where this build signs in. The build for the store uses hifth.app. Every other build signs
    /// in only when `HIFTH_SIGN_IN_URL` names a server (the laptop's stand-in), so the laptop's
    /// tests and walks never ask hifth.app anything; the store build has no way in from a launch
    /// setting at all, the same as the launch file (AppStatus.launchAddress).
    #if STORE
    static func address() -> URL? { URL(string: "https://hifth.app") }
    #else
    static func address(
        _ environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> URL? {
        environment["HIFTH_SIGN_IN_URL"].flatMap(URL.init(string:))
    }
    #endif
}

/// Apple's sheet, shown over the app's window. Kept alive by the sign-in that awaits it, and it
/// keeps Apple's controller alive in turn: a controller let go before Apple answers never calls
/// back, and the page would wait forever.
final class AppleSheet: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private let anchor: ASPresentationAnchor
    private var controller: ASAuthorizationController?
    private var waiting: CheckedContinuation<SignIn.AppleAnswer, Error>?

    init(anchor: ASPresentationAnchor) {
        self.anchor = anchor
    }

    func ask(nonce: String) async throws -> SignIn.AppleAnswer {
        try await withCheckedThrowingContinuation { continuation in
            waiting = continuation
            let controller = ASAuthorizationController(authorizationRequests: [SignIn.appleRequest(nonce: nonce)])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.controller = controller
            controller.performRequests()
        }
    }

    /// Answers once: a second call from Apple finds nothing waiting.
    private func finish(_ result: Result<SignIn.AppleAnswer, Error>) {
        guard let waiting else { return }
        self.waiting = nil
        controller = nil
        waiting.resume(with: result)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let data = credential.identityToken,
              let note = String(data: data, encoding: .utf8), !note.isEmpty
        else { return finish(.failure(SignIn.Failure.badReply)) }
        let code = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        finish(.success(SignIn.AppleAnswer(note: note, code: code, user: credential.user)))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        finish(.failure(SignIn.failure(for: error)))
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        anchor
    }
}
