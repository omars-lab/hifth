import AuthenticationServices
import Foundation

/// Staying signed in (sign-in step 15 in docs/design/sign-in.md). The session is kept in the
/// Keychain so an iPad stays signed in for months, and each launch asks Apple whether the reader
/// has cut Hifth off in their Apple settings. The page is only ever told "signed-in" or
/// "signed-out" (ShellModel); the session and the Apple user id stay in the app.
extension SignIn {
    /// Where the reader stands with Apple.
    enum Standing: Equatable, Sendable {
        /// The reader still allows Hifth.
        case allowed
        /// The reader stopped Hifth using their Apple account.
        case revoked
        /// Apple knows no such reader on this device (signed out of iCloud, or another account).
        case notFound
        /// Apple could not say: no connection, an error, or an answer that is not the reader's
        /// doing. Nothing is dropped on this, or a launch offline would sign the reader out.
        case unknown
    }

    /// Apple's words for it, as ours.
    nonisolated static func standing(for state: ASAuthorizationAppleIDProvider.CredentialState) -> Standing {
        switch state {
        case .authorized: return .allowed
        case .revoked: return .revoked
        case .notFound: return .notFound
        // "transferred" means the app moved to another developer team: not the reader's doing.
        default: return .unknown
        }
    }

    /// Whether a session can still be used at this moment: it has not run out, and it names the
    /// Apple user it belongs to, without which Apple cannot be asked about it.
    static func usable(_ session: Session, now: Date) -> Bool {
        !session.appleUser.isEmpty && !session.token.isEmpty
            && TimeInterval(session.expiresAt) > now.timeIntervalSince1970
    }

    /// The check at launch. Hands back the saved session when it may still be used, and drops it
    /// from the store when it has run out, cannot be checked, or the reader has cut Hifth off.
    static func restore(from store: SessionStore, check: CredentialCheck?, now: Date) async -> Session? {
        guard let saved = store.load() else { return nil }
        guard usable(saved, now: now) else {
            store.clear()
            return nil
        }
        switch await check?.standing(of: saved.appleUser) ?? .unknown {
        case .allowed, .unknown:
            return saved
        case .revoked, .notFound:
            store.clear()
            return nil
        }
    }

    /// The real Keychain and the real question to Apple, only for a build that signs in at all.
    /// A build that names no sign-in server (the laptop's tests and walks) keeps nothing and
    /// asks Apple nothing, so it never touches the Keychain.
    static func realStore(at address: URL?) -> SessionStore? {
        address == nil ? nil : KeychainSessionStore()
    }

    static func realCheck(at address: URL?) -> CredentialCheck? {
        address == nil ? nil : AppleCredentialCheck()
    }
}
