import Foundation

/// The x-callback-url door: `hifth://x-callback-url/<action>?…`.
///
/// A plain `hifth://` link only turns the page. This is for another app —
/// Shortcuts, Drafts, a script — that wants to *ask* the shell for something
/// and hear back: it names one action, its parameters, and up to three
/// addresses of its own (`x-success`, `x-error`, `x-cancel`) that the shell
/// opens when it is done. That is the whole x-callback-url convention
/// (http://x-callback-url.com/specifications/), and nothing here goes beyond it.
///
/// Two actions today:
///  - `open`     — a place, said plainly: `page=45`, `verse=2:255`
///                 (`verse=2:47-48` for a run) with optional `words=3-7`, or
///                 `surah=2` (its first verse, the surah's context open); an
///                 optional `edition` (default below); `mode=note` for the tool
///                 to open in, `open=commentary` for a verse's note (or
///                 `open=context` for the note led by the surah's context),
///                 `view=one|two` for the layout; and any other key the web
///                 app's links take (`skin`, `field`, …) passed through as-is.
///                 `route=/<edition>/<target>[?query]` is the same thing in one
///                 percent-encoded string, for callers that already hold a
///                 link. Answers once the page shows it, with `route` and the
///                 public `url` of the place.
///  - `current`  — no parameters. Answers with the `route` and `url` on screen.
///
/// Errors follow the convention too: `x-error` is opened with `errorCode` and
/// `errorMessage`. No action here can be cancelled, so `x-cancel` is accepted
/// and never opened. The full contract, with examples the tests check against
/// this parser, is `docs/design/app-url-scheme.openapi.json`.
nonisolated enum XCallback {
    static let host = "x-callback-url"
    /// The mus'haf an `open` request means when it names none; the only one
    /// shipped today. The others `Route.editions` knows are refused by name.
    static let defaultEdition = "hafs-kfqc"
    /// The keys `open` reads itself; every other non-`x-` key passes through
    /// to the web app's link query untouched (`mode` as `tool`).
    private static let ownKeys: Set<String> = ["route", "page", "verse", "surah", "words", "edition", "mode"]

    /// The names a link may give for the tool in hand, the panel open on
    /// arrival, and the page layout — the web app's own lists, copied here so
    /// a misspelt one is refused with a reason instead of being dropped by the
    /// page in silence. The tests hold this copy to the OpenAPI file, and the
    /// web side holds that file to the router.
    static let tools = ["read", "select", "highlight", "bookmark", "note", "harakat", "word", "mistake", "crop"]
    static let panels = ["jump", "about", "record", "shelf", "key", "editions", "tips", "lookalikes", "roots", "commentary", "context"]
    static let views = ["one", "two"]
    private static let namedKeys: [String: [String]] = ["tool": tools, "mode": tools, "open": panels, "view": views]
    private static let surahCount = 114

    enum Action: Equatable {
        /// The hash to show, already in the web app's shape (`#/…`).
        case open(hash: String)
        case current
    }

    struct Failure: Error, Equatable {
        let code: String
        let message: String

        static let missingRoute = Failure(code: "missing-route", message: "open needs a page (page=45), a verse (verse=2:255), a surah (surah=2), or a route (route=/hafs-kfqc/2:255)")
        static func badRoute(_ raw: String) -> Failure {
            Failure(code: "bad-route", message: "not a route: \(raw)")
        }
        /// A route whose only fault is its mus'haf: say which one, and what the app ships.
        static func badEdition(_ id: String) -> Failure? {
            Route.editionProblem(id).map { Failure(code: "bad-route", message: $0) }
        }
        static func unknownAction(_ raw: String) -> Failure {
            Failure(code: "unknown-action", message: "no action named \"\(raw)\"; try open or current")
        }
        static func routeNotShown(_ hash: String) -> Failure {
            Failure(code: "route-not-shown", message: "the page did not open \(hash.dropFirst())")
        }
    }

    /// Where the caller wants to hear back. Each is kept only if it is
    /// somewhere the shell may safely open: never back into this app (a loop),
    /// never a file or a script.
    struct Callbacks: Equatable {
        let success: URL?
        let error: URL?
        let cancel: URL?

        static let none = Callbacks(success: nil, error: nil, cancel: nil)

        var wantsAnswer: Bool { success != nil || error != nil }

        /// `x-success` with `route` (the shape callers send, no `#`) and `url`
        /// (the same place on the public site) added to its query.
        func successURL(route hash: String, publicBase: String) -> URL? {
            guard let success else { return nil }
            return Self.appending(
                [("route", String(hash.dropFirst())), ("url", publicBase + hash)],
                to: success
            )
        }

        /// `x-error` with `errorCode` and `errorMessage`, as the convention names them.
        func errorURL(_ failure: Failure) -> URL? {
            guard let error else { return nil }
            return Self.appending([("errorCode", failure.code), ("errorMessage", failure.message)], to: error)
        }

        /// Adds query parameters to a caller's address, keeping the caller's
        /// own query byte for byte. Values are encoded by hand because
        /// Foundation leaves `=` and `&` alone inside a value, which would let a
        /// route's own query be read as parameters of the answer.
        private static func appending(_ items: [(String, String)], to url: URL) -> URL? {
            guard var parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
            let encoded = items.map { key, value in
                key + "=" + (value.addingPercentEncoding(withAllowedCharacters: valueAllowed) ?? "")
            }.joined(separator: "&")
            let existing = parts.percentEncodedQuery.flatMap { $0.isEmpty ? nil : $0 }
            parts.percentEncodedQuery = existing.map { $0 + "&" + encoded } ?? encoded
            return parts.url
        }

        private static let valueAllowed: CharacterSet = {
            var set = CharacterSet.urlQueryAllowed
            set.remove(charactersIn: "=&+;")
            return set
        }()
    }

    struct Request: Equatable {
        let action: Action
        let callbacks: Callbacks
    }

    enum Parsed: Equatable {
        case request(Request)
        /// The caller asked for something the shell cannot do, and where to say so.
        case failure(Failure, Callbacks)
    }

    /// `nil` when this is not an x-callback-url request at all (a plain link,
    /// or another scheme), so the caller can try `Route.parse` next.
    static func parse(_ url: URL) -> Parsed? {
        guard url.scheme?.lowercased() == Route.scheme,
              url.host?.lowercased() == host,
              let parts = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else { return nil }

        var query: [String: String] = [:]
        var order: [String] = []
        for item in parts.queryItems ?? [] where query[item.name] == nil {
            query[item.name] = item.value ?? ""
            order.append(item.name)
        }
        let callbacks = Callbacks(
            success: safe(query["x-success"]),
            error: safe(query["x-error"]),
            cancel: safe(query["x-cancel"])
        )

        let action = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")).lowercased()
        switch action {
        case "open":
            switch route(from: query, order: order) {
            case .success(let hash):
                return .request(Request(action: .open(hash: hash), callbacks: callbacks))
            case .failure(let failure):
                return .failure(failure, callbacks)
            }
        case "current":
            return .request(Request(action: .current, callbacks: callbacks))
        default:
            return .failure(.unknownAction(action), callbacks)
        }
    }

    /// The place an `open` request names, as the web app's hash. `route` is
    /// taken as given; otherwise it is composed from one of `page`, `verse` or
    /// `surah`, then `words`, `edition`, and whatever other keys the caller
    /// passed for the web app — `mode` spelt as the web app's `tool`, and the
    /// three named keys (`tool`, `open`, `view`) checked against their lists.
    private static func route(from query: [String: String], order: [String]) -> Result<String, Failure> {
        if let raw = query["route"], !raw.isEmpty {
            if let id = Route.editionSegment(of: raw), let failure = Failure.badEdition(id) { return .failure(failure) }
            guard let hash = Route.hash(from: raw) else { return .failure(.badRoute(raw)) }
            return .success(hash)
        }
        let given = { (key: String) -> String? in query[key].flatMap { $0.isEmpty ? nil : $0 } }
        let page = given("page"), verse = given("verse"), surah = given("surah"), words = given("words")
        if words != nil, verse == nil {
            return .failure(Failure(code: "bad-route", message: "words need a verse: verse=2:255&words=3-7"))
        }
        let places = [page, verse, surah].compactMap { $0 }
        guard !places.isEmpty else { return .failure(.missingRoute) }
        if places.count > 1 {
            return .failure(Failure(code: "bad-route", message: "give one of page, verse or surah, not two"))
        }
        if given("mode") != nil, given("tool") != nil {
            return .failure(Failure(code: "bad-route", message: "mode and tool are the same thing; give one"))
        }
        for key in order {
            guard let allowed = namedKeys[key] else { continue }
            let value = query[key] ?? ""
            if !allowed.contains(value) {
                return .failure(Failure(code: "bad-route", message: "\(key)=\(value) is not one of \(allowed.joined(separator: ", "))"))
            }
        }
        var target: String
        if let page {
            target = "p" + page
        } else if let verse {
            target = verse
        } else {
            guard let n = Int(surah ?? ""), (1...surahCount).contains(n) else {
                return .failure(Failure(code: "bad-route", message: "surah must be 1 to \(surahCount): surah=\(surah ?? "")"))
            }
            target = "\(n):1"
        }
        let edition = given("edition") ?? defaultEdition
        if let failure = Failure.badEdition(edition) { return .failure(failure) }
        var route = "/" + edition + "/" + target
        var pairs: [String] = []
        if let words { pairs.append("w=" + encode(words)) }
        for key in order where !ownKeys.contains(key) && !key.hasPrefix("x-") || key == "mode" {
            let name = key == "mode" ? "tool" : key
            pairs.append(encode(name) + "=" + encode(query[key] ?? ""))
        }
        // A surah opens on its context unless the caller chose another panel.
        if surah != nil, given("open") == nil { pairs.append("open=context") }
        if !pairs.isEmpty { route += "?" + pairs.joined(separator: "&") }
        guard let hash = Route.hash(from: route) else { return .failure(.badRoute(route)) }
        return .success(hash)
    }

    /// What the route grammar lets through unencoded; the rest is percent-encoded.
    private static let routeValueAllowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.~:,+")

    private static func encode(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: routeValueAllowed) ?? ""
    }

    /// Schemes a callback may never use: this app's own (a request that
    /// answers itself for ever), the bundle's, and anything that is not an
    /// app at all.
    private static let refusedSchemes: Set<String> = [Route.scheme, "hifth-app", "file", "javascript", "data", "blob"]

    private static func safe(_ raw: String?) -> URL? {
        guard let raw, let url = URL(string: raw), let scheme = url.scheme?.lowercased(),
              !refusedSchemes.contains(scheme)
        else { return nil }
        return url
    }
}
