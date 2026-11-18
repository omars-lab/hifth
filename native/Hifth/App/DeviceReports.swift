import CryptoKit
import Foundation
import MetricKit

/// Apple's own crash and freeze reports, kept on the device (launch item 17).
///
/// After the app crashes, freezes, or uses too much of the device, Apple's
/// system hands it a short report the next time it opens (MetricKit). The app saves the last
/// few in its own folder, and the reader's problem report lists them, so a
/// crash on a reader's iPad can reach us at all: Apple's server gives
/// developers freezes and slow launches for store builds, but not crashes.
/// No outside company is involved, and nothing leaves the device unless the
/// reader sends a problem report and sees these lines in it first.
///
/// What the summary may carry: when, what kind, the system's numbers for a
/// crash (exception type and signal), how long a freeze lasted, the app's
/// version and build, and for the newest crash the places in the code it
/// stopped (a binary's name and an offset, which our symbol files turn back
/// into function names). Never the words the system wrote about a crash,
/// which can quote anything the app was holding. Each value is cut to the
/// characters its field may hold, so an odd value cannot carry more.
///
/// A crash of the page's own process (the web content) is not in these
/// reports; the shell loads the page again and its own log notes it
/// (`page_process_ended`, in ShellModel).
nonisolated enum DeviceReports {
    struct Report: Equatable, Sendable {
        /// One line for the problem report, `- <when> <what>, app <version>`.
        let line: String
        /// Where a crash stopped, innermost first; empty for anything else.
        let frames: [String]
    }

    /// How many reports the device keeps, and how many places in the code the
    /// newest crash names.
    static let keep = 5
    static let frameLimit = 3

    /// What each kind of report is called, in the order the summary lists a
    /// payload's kinds.
    private static let kinds: [(key: String, name: String)] = [
        ("crashDiagnostics", "crash"),
        ("hangDiagnostics", "froze"),
        ("appLaunchDiagnostics", "slow to open"),
        ("cpuExceptionDiagnostics", "used too much processor time"),
        ("diskWriteExceptionDiagnostics", "wrote too much to storage"),
    ]

    /// The reports in one of Apple's payloads, as it hands them over in JSON.
    static func reports(from data: Data) -> [Report] {
        guard let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return [] }
        let when = kept(body["timeStampEnd"] as? String, allowed: "0123456789-: ", limit: 16)
        var out: [Report] = []
        for kind in kinds {
            for item in body[kind.key] as? [[String: Any]] ?? [] {
                let meta = item["diagnosticMetaData"] as? [String: Any] ?? [:]
                var what = kind.name
                if kind.key == "crashDiagnostics" {
                    let numbers = [("exception", meta["exceptionType"]), ("signal", meta["signal"])]
                        .compactMap { name, value in (value as? NSNumber).map { "\(name) \($0.intValue)" } }
                    if !numbers.isEmpty { what += " (\(numbers.joined(separator: ", ")))" }
                } else if kind.key == "hangDiagnostics" {
                    let length = kept(meta["hangDuration"] as? String, allowed: "0123456789. abcdefghijklmnopqrstuvwxyz", limit: 16)
                    if !length.isEmpty { what += " for \(length)" }
                }
                let line = "- \(when.isEmpty ? "a day not given" : when) \(what), app \(version(meta))"
                let frames = kind.key == "crashDiagnostics" ? Self.frames(item["callStackTree"]) : []
                out.append(Report(line: line, frames: frames))
            }
        }
        return out
    }

    /// Saves one payload in `folder`, named by when it ends and what it holds,
    /// so the same payload handed over twice is one file; then removes all but
    /// the newest `keep`. False when the data holds no report.
    @discardableResult
    static func save(_ data: Data, in folder: URL, keep: Int = keep) -> Bool {
        guard !reports(from: data).isEmpty else { return false }
        let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        let stamp = kept(body["timeStampEnd"] as? String, allowed: "0123456789", limit: 14)
        let digest = SHA256.hash(data: data).prefix(4).map { String(format: "%02x", $0) }.joined()
        let name = "\(stamp.isEmpty ? "0" : stamp)-\(digest).json"
        lock.lock()
        defer { lock.unlock() }
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try data.write(to: folder.appendingPathComponent(name), options: .atomic)
            for old in files(in: folder).dropFirst(keep) {
                try? FileManager.default.removeItem(at: old)
            }
            return true
        } catch {
            AppLog.problem("device_report_not_saved", message: error.localizedDescription)
            return false
        }
    }

    /// The lines the reader's problem report shows, newest first, at most
    /// `limit`; the newest crash also says where it stopped. Empty when the
    /// device keeps none.
    static func summary(in folder: URL, limit: Int = keep) -> String {
        let newest = files(in: folder)
            .compactMap { try? Data(contentsOf: $0) }
            .flatMap { reports(from: $0) }
            .prefix(limit)
        var lines: [String] = []
        var framed = false
        for report in newest {
            lines.append(report.line)
            if !framed, !report.frames.isEmpty {
                lines.append("  at " + report.frames.joined(separator: " < "))
                framed = true
            }
        }
        return lines.joined(separator: "\n")
    }

    // MARK: The app's own folder and Apple's hand-over

    /// `Application Support/Hifth/Diagnostics`, inside the app's own container
    /// on a device; `walk-captures.mjs pull` copies it off a test device.
    static var folder: URL? {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("Hifth", isDirectory: true)
            .appendingPathComponent("Diagnostics", isDirectory: true)
    }

    /// Listens for Apple's reports, and saves the ones handed over since the
    /// app last ran. Called once at launch, before the page is built, so the
    /// summary the page hears includes them.
    static func start() {
        guard let folder else { return }
        MXMetricManager.shared.add(subscriber)
        let past = MXMetricManager.shared.pastDiagnosticPayloads
        let saved = past.filter { save($0.jsonRepresentation(), in: folder) }.count
        if saved > 0 { AppLog.note("device_reports_kept", ["count": "\(saved)"]) }
    }

    private static let subscriber = Subscriber()
    private static let lock = NSLock()

    /// MetricKit calls this on a queue of its own, not the main thread.
    private final class Subscriber: NSObject, MXMetricManagerSubscriber, @unchecked Sendable {
        func didReceive(_ payloads: [MXDiagnosticPayload]) {
            guard let folder = DeviceReports.folder else { return }
            let saved = payloads.filter { DeviceReports.save($0.jsonRepresentation(), in: folder) }.count
            if saved > 0 { AppLog.note("device_reports_kept", ["count": "\(saved)"]) }
        }
    }

    // MARK: Reading Apple's JSON

    /// The saved files, newest first (their names start with when they end).
    private static func files(in folder: URL) -> [URL] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? []
        return names.filter { $0.hasSuffix(".json") }.sorted(by: >).map { folder.appendingPathComponent($0) }
    }

    private static func version(_ meta: [String: Any]) -> String {
        let allowed = "0123456789."
        let version = kept(meta["appVersion"] as? String, allowed: allowed, limit: 16)
        let build = kept(meta["appBuildVersion"] as? String, allowed: allowed, limit: 12)
        if version.isEmpty { return "version not given" }
        return build.isEmpty ? version : "\(version) (\(build))"
    }

    /// The crashed thread's innermost few places. Apple's tree starts at the
    /// innermost place and each `subFrames` is the one that called it.
    private static func frames(_ tree: Any?) -> [String] {
        let stacks = (tree as? [String: Any])?["callStacks"] as? [[String: Any]] ?? []
        let crashed = stacks.first { ($0["threadAttributed"] as? Bool) == true } ?? stacks.first
        var frame = (crashed?["callStackRootFrames"] as? [[String: Any]])?.first
        var out: [String] = []
        while let current = frame, out.count < frameLimit {
            let binary = kept(current["binaryName"] as? String, allowed: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-", limit: 40)
            let offset = (current["offsetIntoBinaryTextSegment"] as? NSNumber)?.uint64Value
            if !binary.isEmpty, let offset { out.append("\(binary) +0x\(String(offset, radix: 16))") }
            frame = (current["subFrames"] as? [[String: Any]])?.first
        }
        return out
    }

    /// `value` with every character outside `allowed` removed, trimmed, and cut
    /// to `limit`.
    private static func kept(_ value: String?, allowed: String, limit: Int) -> String {
        guard let value else { return "" }
        let set = Set(allowed)
        return String(String(value.filter { set.contains($0) }).trimmingCharacters(in: .whitespaces).prefix(limit))
    }
}
