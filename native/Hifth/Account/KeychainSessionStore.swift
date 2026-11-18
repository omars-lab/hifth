import Foundation
import Security

/// The session, kept in the Keychain: Apple's locked store for secrets on each device (sign-in
/// step 15). One item, written whole and read whole.
///
/// - It stays on this device: not synced through iCloud, and not restored onto another device
///   from a backup.
/// - It can be read once the device has been unlocked after a restart, so the app is still
///   signed in when it is opened from a link or woken behind the lock screen.
/// - It uses the same kind of Keychain on the Mac as on the iPad. A Mac build that is not
///   signed with a developer team (the everyday laptop build) is refused by it; then nothing is
///   kept and nothing is asked of the reader, and the session lasts until the app closes.
struct KeychainSessionStore: SessionStore {
    static let service = "app.hifth.session"
    static let account = "hifth.app"

    /// What names the item, for finding and deleting it.
    static func item() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: false,
            kSecUseDataProtectionKeychain as String: true,
        ]
    }

    /// The item as it is written.
    static func item(holding data: Data) -> [String: Any] {
        var item = item()
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return item
    }

    static func encode(_ session: SignIn.Session) -> Data? {
        try? JSONEncoder().encode(session)
    }

    static func decode(_ data: Data) -> SignIn.Session? {
        try? JSONDecoder().decode(SignIn.Session.self, from: data)
    }

    func load() -> SignIn.Session? {
        var query = Self.item()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var found: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &found) == errSecSuccess,
              let data = found as? Data
        else { return nil }
        return Self.decode(data)
    }

    @discardableResult
    func save(_ session: SignIn.Session) -> Bool {
        guard let data = Self.encode(session) else { return false }
        SecItemDelete(Self.item() as CFDictionary)
        return SecItemAdd(Self.item(holding: data) as CFDictionary, nil) == errSecSuccess
    }

    func clear() {
        SecItemDelete(Self.item() as CFDictionary)
    }
}
