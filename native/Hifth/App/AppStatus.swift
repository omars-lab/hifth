import Foundation

/// The small public file at hifth.app the app reads once each launch (launch item ㉑ in
/// docs/design/app-store-launch.md): the lowest version still allowed on each platform, a
/// notice to show, and parts of the shell to switch off. It is how a bad version is answered
/// without a new build through Apple's review.
///
/// A build's reaction to the file is fixed the day it ships, so the file carries a format
/// number and this build reads only format 1. Anything it does not understand is ignored, and
/// every failure (no connection, a timeout, a page that is not this file, a version it cannot
/// read) means carry on as before. Nothing about the reader goes in the request: it is a plain
/// GET of a fixed address, with no cookies and no cache, and versions are compared here.
struct AppStatus: Equatable {
    static let format = 1
    static let address = URL(string: "https://hifth.app/app-status.json")!

    /// The parts of the shell the file may switch off, by the names it uses. A name this build
    /// does not know is ignored.
    enum Part: String, CaseIterable {
        /// The Apple Pencil's double tap and squeeze.
        case pencil
        /// hifth:// and hifth.app links from other apps opening a page.
        case links
    }

    struct Notice: Equatable {
        let id: String
        let english: String
        let arabic: String
        /// Shown only to versions at or below this one; nil means every version.
        let upTo: String?
    }

    /// What the file may switch on: something a build carries but does not offer until
    /// hifth.app is ready for it. Off unless named, so a launch with no connection offers none
    /// of them. A name this build does not know is ignored.
    enum Offer: String, CaseIterable {
        /// Sign in with Apple (sign-in step 16).
        case signIn = "sign-in"
    }

    /// The lowest version still allowed, by platform ("ios", "macos").
    var lowest: [String: String] = [:]
    var notice: Notice?
    var off: Set<Part> = []
    var on: Set<Offer> = []

    /// The file, or nil when it is not a format-1 status file.
    static func parse(_ data: Data) -> AppStatus? {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              (root["format"] as? Int) == format else { return nil }
        var status = AppStatus()
        if let lowest = root["lowest"] as? [String: Any] {
            for (platform, value) in lowest {
                if let version = value as? String, Version(version) != nil { status.lowest[platform] = version }
            }
        }
        if let notice = root["notice"] as? [String: Any],
           let id = notice["id"] as? String, !id.isEmpty,
           let english = notice["en"] as? String, !english.isEmpty,
           let arabic = notice["ar"] as? String, !arabic.isEmpty {
            let upTo = notice["upTo"] as? String
            if upTo == nil || Version(upTo!) != nil {
                status.notice = Notice(id: id, english: english, arabic: arabic, upTo: upTo)
            }
        }
        if let off = root["off"] as? [Any] {
            status.off = Set(off.compactMap { ($0 as? String).flatMap(Part.init(rawValue:)) })
        }
        if let on = root["on"] as? [Any] {
            status.on = Set(on.compactMap { ($0 as? String).flatMap(Offer.init(rawValue:)) })
        }
        return status
    }

    /// What this build does with the file.
    struct Verdict: Equatable {
        /// The version is below the lowest still allowed: ask the reader to update.
        var tooOld = false
        var notice: Notice?
        var off: Set<Part> = []
        var on: Set<Offer> = []
    }

    func verdict(platform: String, version: String, dismissed: Set<String>) -> Verdict {
        var verdict = Verdict(off: off, on: on)
        guard let mine = Version(version) else { return verdict }
        if let floor = lowest[platform].flatMap(Version.init), mine < floor { verdict.tooOld = true }
        if let notice, !dismissed.contains(notice.id) {
            let reaches = notice.upTo.flatMap(Version.init).map { mine <= $0 } ?? true
            if reaches { verdict.notice = notice }
        }
        return verdict
    }

    /// A version like 0.1.0, compared part by part as numbers; a missing part counts as 0.
    struct Version: Comparable {
        let parts: [Int]

        init?(_ text: String) {
            let pieces = text.split(separator: ".", omittingEmptySubsequences: false)
            guard !pieces.isEmpty, pieces.count <= 4 else { return nil }
            var parts: [Int] = []
            for piece in pieces {
                guard !piece.isEmpty, piece.allSatisfy(\.isASCII), let n = Int(piece), n >= 0 else { return nil }
                parts.append(n)
            }
            self.parts = parts
        }

        static func < (a: Version, b: Version) -> Bool {
            for i in 0..<max(a.parts.count, b.parts.count) {
                let x = i < a.parts.count ? a.parts[i] : 0
                let y = i < b.parts.count ? b.parts[i] : 0
                if x != y { return x < y }
            }
            return false
        }

        static func == (a: Version, b: Version) -> Bool { !(a < b) && !(b < a) }
    }

    // MARK: - Fetching

    /// How long the launch waits for the file before carrying on without it.
    static let timeout: TimeInterval = 6

    /// The file's bytes, or nil on any failure. A plain GET: no cookies, no cache, nothing
    /// about the reader or the device in the address or the headers.
    static func fetch(from address: URL = address) async -> Data? {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        configuration.httpCookieAcceptPolicy = .never
        configuration.httpShouldSetCookies = false
        configuration.urlCache = nil
        configuration.timeoutIntervalForRequest = timeout
        configuration.timeoutIntervalForResource = timeout
        let session = URLSession(configuration: configuration)
        defer { session.finishTasksAndInvalidate() }
        guard let (data, response) = try? await session.data(from: address) else { return nil }
        if let http = response as? HTTPURLResponse, http.statusCode != 200 { return nil }
        return data.count <= 64 * 1024 ? data : nil
    }

    /// Where this build reads the file from. The build for the store reads hifth.app. Every
    /// other build reads it only when `HIFTH_STATUS_URL` names one (a file the tests write),
    /// so the laptop's tests and walks never ask hifth.app anything. The store build has no
    /// way in from a launch setting at all: even the default reading of the settings sits in
    /// the part it leaves out (launch item 36).
    #if STORE
    static func launchAddress() -> URL? { address }
    #else
    static func launchAddress(
        _ environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> URL? {
        environment["HIFTH_STATUS_URL"].flatMap(URL.init(string:))
    }
    #endif

    // MARK: - The reader's closed notices

    static let dismissedKey = "hifth.status.dismissed"

    static func dismissed(in defaults: UserDefaults = .standard) -> Set<String> {
        Set(defaults.stringArray(forKey: dismissedKey) ?? [])
    }

    static func dismiss(_ id: String, in defaults: UserDefaults = .standard) {
        var ids = dismissed(in: defaults)
        ids.insert(id)
        // Only the newest few matter; the file shows one notice at a time.
        defaults.set(Array(ids.sorted().suffix(20)), forKey: dismissedKey)
    }

    // MARK: - Words

    /// The card for a version below the lowest allowed, in the reader's language.
    static func updateWords(arabic: Bool) -> String {
        arabic
            ? "في هذه النسخة من حفظ خلل أصلحته نسخة أحدث. يرجى تحديث التطبيق من متجر التطبيقات."
            : "This version of Hifth has a problem that a newer version fixes. Please update it from the App Store."
    }

    /// Whether the reader's first language is Arabic.
    static var readsArabic: Bool {
        (Locale.preferredLanguages.first ?? "").hasPrefix("ar")
    }
}
