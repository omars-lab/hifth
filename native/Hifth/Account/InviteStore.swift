import Foundation
import Security

/// Where a tester's invite code is kept between launches (sign-in step 18), so it is typed
/// once. The real one is the Keychain (KeychainInviteStore); the tests use one that is only a
/// variable. It is apart from the session's store on purpose: signing out, or a session Apple
/// or the clock ends, never loses the code.
protocol InviteStore {
    /// The kept code as it was typed, or nil when there is none or it cannot be read.
    func load() -> String?
    /// Keeps the code, replacing any older one. False when it could not be kept; the tester
    /// then types it again next time.
    @discardableResult func save(_ invite: String) -> Bool
    /// Forgets the kept code.
    func clear()
}

/// The invite code, kept in the Keychain as its own item. Like the session it stays on this
/// device: not synced through iCloud, not restored onto another device. hifth.app never keeps
/// the code, only a scrambled copy of each one it accepts; this is the only place it is kept.
struct KeychainInviteStore: InviteStore {
    static let service = "app.hifth.invite"
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

    func load() -> String? {
        var query = Self.item()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var found: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &found) == errSecSuccess,
              let data = found as? Data, let invite = String(data: data, encoding: .utf8), !invite.isEmpty
        else { return nil }
        return invite
    }

    @discardableResult
    func save(_ invite: String) -> Bool {
        SecItemDelete(Self.item() as CFDictionary)
        return SecItemAdd(Self.item(holding: Data(invite.utf8)) as CFDictionary, nil) == errSecSuccess
    }

    func clear() {
        SecItemDelete(Self.item() as CFDictionary)
    }
}

extension SignIn {
    /// The Keychain in a build that names a sign-in server, nothing otherwise, so the laptop's
    /// tests and walks never touch the Keychain.
    static func realInviteStore(at address: URL?) -> InviteStore? {
        address == nil ? nil : KeychainInviteStore()
    }
}
