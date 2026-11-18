import Foundation
import Testing
@testable import Hifth

/// Launch item 17: Apple's system hands the app a short report the day after
/// it crashed, froze, or used too much of the device. The app keeps the last
/// few on the device, so a reader's own problem report can carry them; nothing
/// else ever sees them.
///
/// The report data here is made up, in the shape Apple documents. The real
/// shape is checked on a device (the manual-testing list), so the reader is
/// written to cope with any key being missing.
@Suite("Apple's crash and freeze reports, kept on the device")
struct DeviceReportsTests {
    /// A made-up route a reader might have been on. It sits in the free-text
    /// fields Apple fills in, and must never reach the summary.
    static let route = "made-up-route-2-255"

    static func payload(end: String = "2026-11-17 08:30:00", crashes: [[String: Any]] = [crash()], hangs: [[String: Any]] = []) -> Data {
        var body: [String: Any] = ["timeStampBegin": "2026-11-16 08:30:00", "timeStampEnd": end]
        if !crashes.isEmpty { body["crashDiagnostics"] = crashes }
        if !hangs.isEmpty { body["hangDiagnostics"] = hangs }
        return try! JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
    }

    static func crash(exception: Int = 1, signal: Int = 11, version: String = "0.1.0", build: String = "7") -> [String: Any] {
        let frame3: [String: Any] = ["binaryName": "UIKitCore", "offsetIntoBinaryTextSegment": 16]
        let frame2: [String: Any] = ["binaryName": "Hifth", "offsetIntoBinaryTextSegment": 15437, "subFrames": [frame3]]
        let frame1: [String: Any] = ["binaryName": "Hifth", "offsetIntoBinaryTextSegment": 6699, "subFrames": [frame2]]
        return [
            "diagnosticMetaData": [
                "appVersion": version,
                "appBuildVersion": build,
                "exceptionType": exception,
                "signal": signal,
                "terminationReason": "Namespace SIGNAL \(route)",
                "objectiveCexceptionReason": ["composedMessage": "no page \(route)"],
            ],
            "callStackTree": [
                "callStacks": [
                    ["threadAttributed": false, "callStackRootFrames": [["binaryName": "libsystem_kernel.dylib", "offsetIntoBinaryTextSegment": 1]]],
                    ["threadAttributed": true, "callStackRootFrames": [frame1]],
                ],
            ],
        ]
    }

    static func folder() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("device-reports-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    @Test("a crash says when, what kind, the system's two numbers for it, and which version")
    func crashLine() {
        let reports = DeviceReports.reports(from: Self.payload())
        #expect(reports.count == 1)
        #expect(reports[0].line == "- 2026-11-17 08:30 crash (exception 1, signal 11), app 0.1.0 (7)")
    }

    @Test("a crash names where in the code it stopped, as places a symbol file can turn back into names")
    func crashFrames() {
        let reports = DeviceReports.reports(from: Self.payload())
        #expect(reports[0].frames == ["Hifth +0x1a2b", "Hifth +0x3c4d", "UIKitCore +0x10"])
    }

    @Test("a freeze says how long the app froze")
    func hangLine() {
        let hang: [String: Any] = ["diagnosticMetaData": ["appVersion": "0.1.0", "appBuildVersion": "7", "hangDuration": "20 sec"]]
        let reports = DeviceReports.reports(from: Self.payload(crashes: [], hangs: [hang]))
        #expect(reports.map(\.line) == ["- 2026-11-17 08:30 froze for 20 sec, app 0.1.0 (7)"])
    }

    @Test("the words Apple's system wrote about a crash never reach the summary, only its numbers")
    func noFreeText() throws {
        let folder = try Self.folder()
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(DeviceReports.save(Self.payload(), in: folder))
        let text = DeviceReports.summary(in: folder)
        #expect(!text.isEmpty)
        #expect(!text.contains(Self.route))
        #expect(!text.contains("Namespace"))
        #expect(!text.contains("no page"))
    }

    @Test("an odd value in a field is cut to the characters that field may hold")
    func oddValues() {
        let crash = Self.crash(version: "0.1.0 \(Self.route) \"quoted\"\nnext", build: "7; x")
        let line = DeviceReports.reports(from: Self.payload(crashes: [crash]))[0].line
        #expect(!line.contains("\""))
        #expect(!line.contains("\n"))
        #expect(!line.contains(";"))
        #expect(line.count < 120)
    }

    @Test("a report with keys missing still says when and what kind")
    func missingKeys() {
        let data = try! JSONSerialization.data(withJSONObject: ["crashDiagnostics": [[String: Any]()]])
        let reports = DeviceReports.reports(from: data)
        #expect(reports.map(\.line) == ["- a day not given crash, app version not given"])
        #expect(reports[0].frames.isEmpty)
    }

    @Test("data that is not a report is not kept")
    func notAReport() throws {
        let folder = try Self.folder()
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(!DeviceReports.save(Data("not json".utf8), in: folder))
        #expect(!DeviceReports.save(Data("{}".utf8), in: folder))
        #expect(try FileManager.default.contentsOfDirectory(atPath: folder.path).isEmpty)
    }

    @Test("the same report handed over twice is kept once")
    func sameTwice() throws {
        let folder = try Self.folder()
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(DeviceReports.save(Self.payload(), in: folder))
        #expect(DeviceReports.save(Self.payload(), in: folder))
        #expect(try FileManager.default.contentsOfDirectory(atPath: folder.path).count == 1)
    }

    @Test("only the newest few are kept, and the summary lists them newest first")
    func keepsNewest() throws {
        let folder = try Self.folder()
        defer { try? FileManager.default.removeItem(at: folder) }
        for day in 10...17 {
            #expect(DeviceReports.save(Self.payload(end: "2026-11-\(day) 08:30:00", crashes: [Self.crash(build: "\(day)")]), in: folder, keep: 5))
        }
        #expect(try FileManager.default.contentsOfDirectory(atPath: folder.path).count == 5)
        let lines = DeviceReports.summary(in: folder).split(separator: "\n").filter { $0.hasPrefix("- ") }
        #expect(lines.count == 5)
        #expect(lines.first?.hasPrefix("- 2026-11-17") == true)
        #expect(lines.last?.hasPrefix("- 2026-11-13") == true)
    }

    @Test("only the newest crash carries where it stopped, to keep the mail short")
    func framesOnNewestOnly() throws {
        let folder = try Self.folder()
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(DeviceReports.save(Self.payload(end: "2026-11-16 08:30:00"), in: folder))
        #expect(DeviceReports.save(Self.payload(end: "2026-11-17 08:30:00"), in: folder))
        let text = DeviceReports.summary(in: folder)
        #expect(text.components(separatedBy: "  at ").count == 2)
        #expect(text.hasPrefix("- 2026-11-17 08:30 crash (exception 1, signal 11), app 0.1.0 (7)\n  at Hifth +0x1a2b < Hifth +0x3c4d < UIKitCore +0x10\n- 2026-11-16"))
    }

    @Test("with nothing kept, the summary is empty, and so is a folder that is not there")
    func emptySummary() throws {
        let folder = try Self.folder()
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(DeviceReports.summary(in: folder) == "")
        #expect(DeviceReports.summary(in: folder.appendingPathComponent("missing")) == "")
    }

    @Test("the page hears the summary at start, and an empty one is left out")
    func bootScript() {
        let with = Bridge.bootScript(platform: "ios", publicBase: "https://example.invalid/", deviceReports: "- a line").source
        #expect(with.contains("\"deviceReports\":\"- a line\""))
        let without = Bridge.bootScript(platform: "ios", publicBase: "https://example.invalid/").source
        #expect(!without.contains("deviceReports"))
    }
}
