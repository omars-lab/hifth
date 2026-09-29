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

    // MARK: - Grammar (mirrors parseHash in the web router)

    private static func isEdition(_ s: String) -> Bool {
        !s.isEmpty && s.allSatisfy { $0.isASCII && ($0.isLowercase || $0.isNumber || $0 == "-") }
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
