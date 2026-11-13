import Foundation
import Observation

/// The card a `check` link opens: its steps, the reader's answer to each, a
/// note, and where to say it is done. Shown only in a build from the laptop
/// (`ShellModel.open`); the view is `CheckCardView`.
@Observable
final class CheckCard {
    enum Answer: String, Codable { case pass, fail }

    let check: XCallback.Check
    let callbacks: XCallback.Callbacks
    /// One per step, `nil` until the reader taps ✓ or ✗.
    var answers: [Answer?]
    var note = ""
    /// Folded down to one small button, so the card is out of the way.
    var folded = false

    init(check: XCallback.Check, callbacks: XCallback.Callbacks) {
        self.check = check
        self.callbacks = callbacks
        answers = Array(repeating: nil, count: check.steps.count)
    }

    /// `pass` only when every step got a ✓.
    var result: String {
        answers.allSatisfy { $0 == .pass } ? "pass" : "fail"
    }

    /// Whether the reader has given anything worth keeping.
    var touched: Bool {
        answers.contains { $0 != nil } || !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// What gets saved: the steps with their answers, the note, the page that
    /// was showing (`#` dropped, as callers write it) and the time.
    func record(route hash: String, at date: Date) -> CheckRecord {
        CheckRecord(
            id: check.id,
            title: check.title,
            result: result,
            route: hash.hasPrefix("#") ? String(hash.dropFirst()) : hash,
            note: note,
            at: CheckRecord.time(date),
            steps: zip(check.steps, answers).map { step, answer in
                CheckRecord.Step(action: step.action, see: step.see, answer: answer?.rawValue ?? "not answered")
            }
        )
    }
}

/// One card's answers, as the laptop reads them off the device.
nonisolated struct CheckRecord: Codable, Equatable {
    struct Step: Codable, Equatable {
        let action: String
        let see: String?
        /// `pass`, `fail` or `not answered`.
        let answer: String
    }

    let id: String
    let title: String
    let result: String
    let route: String
    let note: String
    /// UTC, to the second: `2027-01-15T08:00:00Z`.
    let at: String
    let steps: [Step]

    /// `2027-01-15T08:00:00Z`: the ISO style is UTC unless told otherwise.
    static func time(_ date: Date) -> String {
        date.formatted(Date.ISO8601FormatStyle())
    }
}

/// Writes each card's answers as one JSON file, `<id>-<yyyyMMdd-HHmmss>.json`,
/// in the app's `Documents/checks/`, which `make check-answers` copies off.
nonisolated enum CheckStore {
    static var defaultFolder: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("checks", isDirectory: true)
    }

    @discardableResult
    static func save(_ record: CheckRecord, in folder: URL) throws -> URL {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        // 2027-01-15T08:00:00Z → 20270115-080000
        let digits = record.at.filter(\.isNumber)
        let stamp = digits.count >= 14 ? "\(digits.prefix(8))-\(digits.dropFirst(8).prefix(6))" : digits
        var file = folder.appendingPathComponent("\(record.id)-\(stamp).json")
        var n = 2
        while FileManager.default.fileExists(atPath: file.path) {
            file = folder.appendingPathComponent("\(record.id)-\(stamp)-\(n).json")
            n += 1
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        try encoder.encode(record).write(to: file, options: .atomic)
        return file
    }
}
