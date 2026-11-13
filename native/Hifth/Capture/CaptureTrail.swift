#if DEBUG
import Foundation

/// The last few seconds of what the reader did: touches, Pencil strokes and
/// page moves, kept in memory and written beside a capture as `trail.jsonl`.
/// It costs nothing to keep and needs no permission, so a capture has it even
/// when the screen recording is refused.
///
/// Only in a build from the laptop (`DEBUG`). Read it at the moment the
/// screenshot is heard, before any waiting, or it would hold what came after.
nonisolated struct CaptureTrail {
    enum Happening: Equatable {
        case touch(phase: String, x: Double, y: Double)
        case pencil(phase: String, x: Double, y: Double, force: Double)
        /// The page's address changed (the bridge's `route` message).
        case route(String)
    }

    struct Event: Equatable {
        let at: Date
        let kind: String
        let phase: String?
        let x: Double?
        let y: Double?
        let force: Double?
        let route: String?
    }

    let window: TimeInterval
    private var kept: [Event] = []

    init(window: TimeInterval = 10) {
        self.window = window
    }

    var count: Int { kept.count }

    mutating func add(_ happening: Happening, at date: Date) {
        let event: Event
        switch happening {
        case .touch(let phase, let x, let y):
            event = Event(at: date, kind: "touch", phase: phase, x: x, y: y, force: nil, route: nil)
        case .pencil(let phase, let x, let y, let force):
            event = Event(at: date, kind: "pencil", phase: phase, x: x, y: y, force: force, route: nil)
        case .route(let hash):
            event = Event(
                at: date, kind: "route", phase: nil, x: nil, y: nil, force: nil,
                route: hash.hasPrefix("#") ? String(hash.dropFirst()) : hash
            )
        }
        kept.append(event)
        // Forget what has fallen out of the window, so the list never grows
        // past it however long the walk.
        let oldest = date.addingTimeInterval(-window)
        if let first = kept.firstIndex(where: { $0.at >= oldest }), first > 0 {
            kept.removeFirst(first)
        }
    }

    /// What happened in the window before `date`, and nothing after it.
    func events(before date: Date) -> [Event] {
        let oldest = date.addingTimeInterval(-window)
        return kept.filter { $0.at >= oldest && $0.at <= date }
    }

    /// One JSON object per line: what, when, and how many seconds before the
    /// capture. A field that does not apply is left out.
    func jsonl(before date: Date) -> Data {
        let time = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
        var out = Data()
        for event in events(before: date) {
            var object: [String: Any] = [
                "kind": event.kind,
                "at": event.at.formatted(time),
                "before": (date.timeIntervalSince(event.at) * 1000).rounded() / 1000,
            ]
            if let phase = event.phase { object["phase"] = phase }
            if let x = event.x { object["x"] = x }
            if let y = event.y { object["y"] = y }
            if let force = event.force { object["force"] = force }
            if let route = event.route { object["route"] = route }
            guard let line = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys, .withoutEscapingSlashes]) else { continue }
            out.append(line)
            out.append(0x0A)
        }
        return out
    }
}
#endif
