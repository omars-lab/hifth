#if DEBUG
import Foundation

/// Where walk captures are kept: one folder per screenshot, inside the app's
/// own `Documents/walk-captures/`, named by the time it was taken in UTC
/// (`20270115-080000`, then `-2`, `-3` within the same second). The laptop
/// copies them off with `make walk-pull`; the Files app shows them on the iPad.
///
/// Only in a build from the laptop (`DEBUG`); a release build has none of this.
/// Pure file work, so it runs and is tested on the Mac too.
nonisolated struct CaptureStore {
    static var defaultFolder: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("walk-captures", isDirectory: true)
    }

    let folder: URL
    /// Past either limit the oldest captures are dropped, so a long walk can
    /// never fill the iPad.
    var mostCaptures = 300
    var mostBytes: Int64 = 1_000_000_000

    /// A new, empty folder for one capture.
    func newCapture(at date: Date) throws -> URL {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let stamp = Self.stamp(date)
        var n = 1
        while true {
            let name = n == 1 ? stamp : "\(stamp)-\(n)"
            let capture = folder.appendingPathComponent(name, isDirectory: true)
            do {
                // Without intermediates this fails if the folder is already
                // there, so two captures can never share one.
                try FileManager.default.createDirectory(at: capture, withIntermediateDirectories: false)
                return capture
            } catch CocoaError.fileWriteFileExists {
                n += 1
            }
        }
    }

    func write(_ data: Data, named name: String, in capture: URL) throws {
        try data.write(to: capture.appendingPathComponent(name), options: .atomic)
    }

    /// The first thing done when a screenshot is heard, before anything is
    /// waited on: the folder, the trail, and where the reader was as far as the
    /// app knows without asking the page. A page that never answers is the one
    /// worth keeping most, so nothing here depends on it. The oldest captures
    /// past the limits go, never this one.
    func begin(place: CaptureWhere, trail: Data) throws -> URL {
        let capture = try newCapture(at: place.at)
        try write(trail, named: "trail.jsonl", in: capture)
        try write(place.json(), named: "where.json", in: capture)
        try trim(keeping: [capture.lastPathComponent])
        return capture
    }

    /// The app's own picture of the screen. An empty one (the snapshot failed)
    /// is not kept: a file that opens as nothing would look like a fault.
    @discardableResult
    func keepPicture(_ png: Data, in capture: URL) throws -> Bool {
        guard !png.isEmpty else { return false }
        try write(png, named: "picture.png", in: capture)
        return true
    }

    /// The reader's note. A blank one is not kept, and a capture that has
    /// already been dropped is not made again just to hold it.
    @discardableResult
    func keepNote(_ text: String, in capture: URL) throws -> Bool {
        let note = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !note.isEmpty, FileManager.default.fileExists(atPath: capture.path) else { return false }
        try write(Data((note + "\n").utf8), named: "note.txt", in: capture)
        return true
    }

    /// Drops the oldest captures until both limits hold, never one named in
    /// `keeping` (the one being written). Oldest means the earliest time in the
    /// folder's name: a file's own date changes when it is copied or touched.
    /// Returns the names dropped.
    @discardableResult
    func trim(keeping: Set<String> = []) throws -> [String] {
        let fm = FileManager.default
        guard fm.fileExists(atPath: folder.path) else { return [] }
        var captures = try fm.contentsOfDirectory(atPath: folder.path)
            .compactMap { name in Self.order(name).map { (name: name, order: $0) } }
            .sorted { $0.order < $1.order }
            .map { (name: $0.name, bytes: Self.bytes(in: folder.appendingPathComponent($0.name))) }
        var total = captures.reduce(Int64(0)) { $0 + $1.bytes }
        var dropped: [String] = []
        var i = 0
        while (captures.count > mostCaptures || total > mostBytes), i < captures.count {
            let capture = captures[i]
            if keeping.contains(capture.name) {
                i += 1
                continue
            }
            try fm.removeItem(at: folder.appendingPathComponent(capture.name))
            total -= capture.bytes
            dropped.append(capture.name)
            captures.remove(at: i)
        }
        return dropped
    }

    /// `20270115-080000`, in UTC.
    static func stamp(_ date: Date) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let c = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        return String(
            format: "%04d%02d%02d-%02d%02d%02d",
            c.year ?? 0, c.month ?? 0, c.day ?? 0, c.hour ?? 0, c.minute ?? 0, c.second ?? 0
        )
    }

    /// Where a capture's folder sorts, from its name: the time, then the count
    /// within that second, as a number, so `-10` comes after `-9`. `nil` for
    /// anything that is not a capture, which is then left alone.
    static func order(_ name: String) -> (String, Int)? {
        let parts = name.split(separator: "-", omittingEmptySubsequences: false).map(String.init)
        guard parts.count == 2 || parts.count == 3,
              parts[0].count == 8, parts[0].allSatisfy(\.isASCII), parts[0].allSatisfy(\.isNumber),
              parts[1].count == 6, parts[1].allSatisfy(\.isASCII), parts[1].allSatisfy(\.isNumber)
        else { return nil }
        if parts.count == 2 { return ("\(parts[0])-\(parts[1])", 1) }
        guard let n = Int(parts[2]), n >= 2 else { return nil }
        return ("\(parts[0])-\(parts[1])", n)
    }

    private static func bytes(in capture: URL) -> Int64 {
        guard let files = FileManager.default.enumerator(at: capture, includingPropertiesForKeys: [.fileSizeKey]) else { return 0 }
        var total: Int64 = 0
        for case let file as URL in files {
            total += Int64((try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
        }
        return total
    }
}

/// `where.json`: where the reader was when they took the screenshot. Page and
/// verse numbers, what was open and the settings, by name only: no verse, note
/// or commentary text is ever asked of the page, so a capture's record carries
/// none even from the pitch build (its picture can, which is why captures stay
/// off the repository).
nonisolated struct CaptureWhere: Equatable {
    struct Screen: Codable, Equatable {
        let width: Double
        let height: Double
        let scale: Double
        /// `upright` or `sideways`.
        let orientation: String
    }

    struct Build: Codable, Equatable {
        let commit: String
        /// `pitch` or `public`, as `make app-web` built it.
        let flavour: String

        /// The two files `make app-web` writes beside the web build.
        static func read(from webBundle: URL) -> Build {
            func line(_ name: String) -> String {
                let text = (try? String(contentsOf: webBundle.appendingPathComponent(name), encoding: .utf8)) ?? ""
                let first = text.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
                return first.trimmingCharacters(in: .whitespaces).isEmpty ? "unknown" : first.trimmingCharacters(in: .whitespaces)
            }
            return Build(commit: line(".hifth-web-commit"), flavour: line(".hifth-web-flavour"))
        }
    }

    /// What the page said about itself, from `CapturePage.script`.
    struct PageAnswer: Equatable {
        var page: Int?
        var verse: String?
        var open: [String]
        var settings: [String: String]

        init(page: Int?, verse: String?, open: [String], settings: [String: String]) {
            self.page = page
            self.verse = verse
            self.open = open
            self.settings = settings
        }

        init?(json: String) {
            guard let object = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any] else { return nil }
            page = (object["page"] as? NSNumber)?.intValue
            verse = object["verse"] as? String
            open = (object["open"] as? [Any])?.compactMap { $0 as? String } ?? []
            settings = ((object["settings"] as? [String: Any]) ?? [:]).compactMapValues { $0 as? String }
        }
    }

    let at: Date
    /// `screenshot`, or `launch` when a test asked for one at start.
    let trigger: String
    let route: String
    let page: Int?
    let verse: String?
    let open: [String]
    let settings: [String: String]
    let screen: Screen
    let build: Build
    /// False when the page did not answer in time; the picture and trail are
    /// still kept.
    let pageAnswered: Bool

    init(
        at: Date, trigger: String, route: String, page: Int?, verse: String?, open: [String],
        settings: [String: String], screen: Screen, build: Build, pageAnswered: Bool
    ) {
        self.at = at
        self.trigger = trigger
        self.route = route
        self.page = page
        self.verse = verse
        self.open = open
        self.settings = settings
        self.screen = screen
        self.build = build
        self.pageAnswered = pageAnswered
    }

    init(at: Date, trigger: String, route: String, answer: PageAnswer?, screen: Screen, build: Build) {
        self.init(
            at: at, trigger: trigger, route: route, page: answer?.page, verse: answer?.verse,
            open: answer?.open ?? [], settings: answer?.settings ?? [:], screen: screen, build: build,
            pageAnswered: answer != nil
        )
    }

    /// Every field, a missing one as `null`, so a reader of the file can tell
    /// "the page did not say" from "this build never wrote that".
    func json() throws -> Data {
        var object: [String: Any] = [
            "at": CheckRecord.time(at),
            "trigger": trigger,
            "route": route.hasPrefix("#") ? String(route.dropFirst()) : route,
            "page": page.map { $0 as Any } ?? NSNull(),
            "verse": verse.map { $0 as Any } ?? NSNull(),
            "open": open,
            "settings": settings,
            "pageAnswered": pageAnswered,
        ]
        object["screen"] = [
            "width": screen.width, "height": screen.height, "scale": screen.scale, "orientation": screen.orientation,
        ]
        object["build"] = ["commit": build.commit, "flavour": build.flavour]
        return try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
    }
}
#endif
