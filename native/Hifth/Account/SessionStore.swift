import Foundation

/// Where the session is kept between launches (sign-in step 15). The real one is the Keychain
/// (KeychainSessionStore); the tests use one that is only a variable.
protocol SessionStore {
    /// The saved session, or nil when there is none or it cannot be read.
    func load() -> SignIn.Session?
    /// Keeps the session, replacing any older one. False when it could not be kept; the caller
    /// carries on with the session in memory.
    @discardableResult func save(_ session: SignIn.Session) -> Bool
    /// Forgets the saved session.
    func clear()
}
