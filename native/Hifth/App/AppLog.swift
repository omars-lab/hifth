import Foundation
import os

/// The shell's own log (launch item 19). Lines go to the system log, which
/// Apple keeps on the device, shows in Console on a Mac, and attaches to the
/// diagnostics a reader can choose to share; a bare `print` goes nowhere once
/// the app is not run from Xcode.
///
/// Every line has one shape, `ev=<event> version=… commit=… name=value …
/// msg="…"`, so it can be searched the same way as the laptop's own scripts'
/// logs, and so a line read off a reader's device names the version and the
/// build that wrote it.
///
/// What a line may carry: the event, the app's version and build, and facts
/// about the app itself (a sound setting, an error's own words). Never which
/// page or verse is open, a note, a mark or anything the reader typed. Lines
/// are written public so they can be read off a device at all; that is why the
/// rule above matters.
///
/// The walk capture, probe and snapshot tools still print, on purpose: they
/// are in debug builds only, and the laptop's scripts read their output.
nonisolated enum AppLog {
    /// The version and build every line carries.
    struct Build: Sendable, Equatable {
        let version: String
        let commit: String

        /// From the app's Info.plist and the stamp the copy step writes beside
        /// the web files (`.hifth-web-commit`). Missing parts read "unknown".
        static func read(info: [String: Any], webRoot: URL?) -> Build {
            let version = Bridge.versionLine(info: info)
            let stamp = webRoot
                .flatMap { try? String(contentsOf: $0.appendingPathComponent(".hifth-web-commit"), encoding: .utf8) }?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return Build(version: version.isEmpty ? "unknown" : version, commit: stamp.isEmpty ? "unknown" : stamp)
        }

        static let current = read(info: Bundle.main.infoDictionary ?? [:], webRoot: BundleFiles.root)
    }

    private static let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "hifth", category: "shell")

    /// One line, in the shape above. Field values lose their spaces and the
    /// message its line breaks and double quotes, so a line is always one line.
    static func line(_ event: String, _ fields: [String: String] = [:], message: String? = nil, build: Build) -> String {
        var parts = ["ev=\(event)", "version=\(word(build.version))", "commit=\(word(build.commit))"]
        for key in fields.keys.sorted() {
            parts.append("\(key)=\(word(fields[key] ?? ""))")
        }
        if let message {
            let flat = message
                .replacingOccurrences(of: "\"", with: "'")
                .components(separatedBy: .newlines)
                .joined(separator: " ")
            parts.append("msg=\"\(flat)\"")
        }
        return parts.joined(separator: " ")
    }

    private static func word(_ value: String) -> String {
        value.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: "_")
    }

    /// Something worth knowing happened.
    static func note(_ event: String, _ fields: [String: String] = [:], message: String? = nil) {
        let text = line(event, fields, message: message, build: .current)
        logger.notice("\(text, privacy: .public)")
    }

    /// Something went wrong, and the app carried on.
    static func problem(_ event: String, _ fields: [String: String] = [:], message: String? = nil) {
        let text = line(event, fields, message: message, build: .current)
        logger.error("\(text, privacy: .public)")
    }
}
