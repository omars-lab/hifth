import Foundation

/// Asks whether the reader still lets Hifth use their Apple account (sign-in step 15). A reader
/// can cut an app off in their Apple settings at any time, and the app is told nothing; it has
/// to ask at launch. The real one asks Apple (AppleCredentialCheck); the tests play the answer.
protocol CredentialCheck {
    /// Where the reader with this Apple user id stands. Never throws: an answer that could not
    /// be had is `.unknown`.
    func standing(of appleUser: String) async -> SignIn.Standing
}
