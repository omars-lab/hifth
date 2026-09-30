import Foundation

/// A route is the web app's own hash — `#/<edition>/<target>[?query]` — carried
/// unchanged from wherever it came in. The shell adds no grammar of its own:
/// the web router (`packages/core/src/router.ts`) is the one source of truth,
/// and this only checks the *shape* so a bad link is refused here, with the
/// caller told, rather than parsed into nothing on the far side.
///
/// Three doors:
///  - `hifth://…` links (`parse`), while the app runs or to launch it;
///  - the `HIFTH_ROUTE` launch variable (`fromEnvironment`), which is how the
///    Makefile and the screenshot targets open a state without a link dialog;
///  - a `--route=` argument (`fromArguments`), the same thing for XCUITest.
nonisolated enum Route {
    static let scheme = "hifth"
    static let environmentKey = "HIFTH_ROUTE"
    static let argumentPrefix = "--route="

    /// One mus'haf the app knows by id. `shipped` is whether its pages are in
    /// the build; an unshipped one carries the reason, in plain words.
    struct Edition: Equatable {
        let id: String
        let shipped: Bool
        let reason: String?
    }

    /// The mus'hafs the app knows, in the app's own order — the web app's list,
    /// copied here so a link naming another is refused with a reason. The
    /// OpenAPI file carries the same copy for readers; the tests hold this one
    /// to it, and a core test holds that one to the web app.
    static let editions: [Edition] = [
        Edition(id: "hafs-kfqc", shipped: true, reason: nil),
        Edition(id: "warsh-libya", shipped: false, reason: "licensed for non-commercial use only; needs permission before it can be added"),
        Edition(id: "qalun-libya", shipped: false, reason: "licensed for non-commercial use only; needs permission before it can be added"),
        Edition(id: "hafs-indopak", shipped: false, reason: "no licensed page source yet"),
    ]

    /// The ids a link may actually name today.
    static var shippedEditions: [String] { editions.filter(\.shipped).map(\.id) }

    /// Why this edition id cannot open, in a sentence that names what can; `nil`
    /// when it is one the app ships.
    static func editionProblem(_ id: String) -> String? {
        let shipped = "the app ships " + shippedEditions.joined(separator: ", ")
        guard let edition = editions.first(where: { $0.id == id }) else {
            return "no mus'haf named \"\(id)\"; \(shipped)"
        }
        if edition.shipped { return nil }
        let why = edition.reason.map { " (\($0))" } ?? ""
        return "\(id) is not in the app yet\(why); \(shipped)"
    }

    /// The edition segment of a raw route (`/hafs-kfqc/2:255?…` → `hafs-kfqc`),
    /// before any grammar check, so a caller can say which part was wrong.
    static func editionSegment(of raw: String) -> String? {
        var route = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if route.hasPrefix("#") { route.removeFirst() }
        guard route.hasPrefix("/") else { return nil }
        let segment = route.dropFirst().split(separator: "/", maxSplits: 1, omittingEmptySubsequences: false).first ?? ""
        return segment.isEmpty ? nil : String(segment.split(separator: "?", maxSplits: 1)[0])
    }

    /// `/hafs-kfqc/2:255?w=3-7` (with or without a leading `#`) → the hash the
    /// web app shows, or `nil` when it is not something the web app would open.
    static func hash(from raw: String) -> String? {
        var route = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if route.hasPrefix("#") { route.removeFirst() }
        guard route.hasPrefix("/"), !route.contains("#") else { return nil }

        let halves = route.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)
        let path = halves[0]
        let query = halves.count > 1 ? String(halves[1]) : nil

        let segments = path.dropFirst().split(separator: "/", omittingEmptySubsequences: false)
        guard segments.count == 2,
              isEdition(String(segments[0])),
              isTarget(String(segments[1]))
        else { return nil }
        if let query, !isQuery(query) { return nil }
        return "#" + route
    }

    /// A `hifth://` link in any of the shapes people paste:
    /// `hifth:///hafs-kfqc/2:255`, `hifth://hafs-kfqc/2:255`,
    /// `hifth://open/#/hafs-kfqc/2:255` (a site link's tail, fragment and all).
    static func parse(_ url: URL) -> String? {
        guard url.scheme?.lowercased() == scheme else { return nil }
        if let fragment = url.fragment, fragment.hasPrefix("/") {
            return hash(from: fragment)
        }
        var route = url.path
        if let host = url.host, !host.isEmpty, host != "open" {
            route = "/" + host + route
        }
        if let query = url.query, !query.isEmpty {
            route += "?" + query
        }
        return hash(from: route)
    }

    static func fromEnvironment(
        _ environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> String? {
        environment[environmentKey].flatMap(hash(from:))
    }

    static func fromArguments(_ arguments: [String] = CommandLine.arguments) -> String? {
        arguments
            .first { $0.hasPrefix(argumentPrefix) }
            .map { String($0.dropFirst(argumentPrefix.count)) }
            .flatMap(hash(from:))
    }

    // MARK: - Grammar (mirrors parseHash in the web router, then narrows the
    // edition to what the app ships — the web router takes any name, and would
    // show the Hafs pages under a lying address)

    private static func isEdition(_ s: String) -> Bool {
        shippedEditions.contains(s)
    }

    /// `p<N>`, `s:a`, `s:a-s:a` or `s:a-a`, every number ≥ 1.
    private static func isTarget(_ s: String) -> Bool {
        if s.hasPrefix("p") { return isPositive(s.dropFirst()) }
        let ends = s.split(separator: "-", omittingEmptySubsequences: false)
        guard ends.count == 1 || ends.count == 2, isAyahRef(ends[0]) else { return false }
        if ends.count == 2 {
            return isAyahRef(ends[1]) || isPositive(ends[1])
        }
        return true
    }

    private static func isAyahRef(_ s: Substring) -> Bool {
        let parts = s.split(separator: ":", omittingEmptySubsequences: false)
        return parts.count == 2 && isPositive(parts[0]) && isPositive(parts[1])
    }

    private static func isPositive(_ s: Substring) -> Bool {
        !s.isEmpty && s.allSatisfy(\.isNumber) && s.first != "0"
    }

    /// Only what a serialized query can hold. The keys are the web app's
    /// business; this refuses whitespace, quotes and anything that could not be
    /// part of a hash.
    private static func isQuery(_ s: String) -> Bool {
        s.allSatisfy { c in
            c.isASCII && (c.isLetter || c.isNumber || "-_.~%:,=&+".contains(c))
        }
    }
}
