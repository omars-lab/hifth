import AuthenticationServices
import Foundation

/// Apple's own answer to "does this reader still allow Hifth?", asked of the device. It shows
/// nothing to the reader and sends nothing to hifth.app.
struct AppleCredentialCheck: CredentialCheck {
    func standing(of appleUser: String) async -> SignIn.Standing {
        await withCheckedContinuation { continuation in
            ASAuthorizationAppleIDProvider().getCredentialState(forUserID: appleUser) { state, error in
                continuation.resume(returning: error == nil ? SignIn.standing(for: state) : .unknown)
            }
        }
    }
}
