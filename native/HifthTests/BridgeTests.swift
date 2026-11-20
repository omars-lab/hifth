import Foundation
import Testing
@testable import Hifth

/// The message shapes are shared with `apps/web/src/native-bridge.ts`; a
/// change on one side without the other shows up here or there.
@Suite("Bridge")
struct BridgeTests {
    @Test("decodes the four messages the page sends")
    func decode() {
        #expect(BridgeMessage(body: ["type": "ready"]) == .ready)
        #expect(BridgeMessage(body: ["type": "route", "hash": "#/hafs-kfqc/2:255"]) == .route("#/hafs-kfqc/2:255"))
        #expect(
            BridgeMessage(body: ["type": "share", "url": "https://x/#/a", "title": "t", "text": "b"])
                == .share(url: "https://x/#/a", title: "t", text: "b")
        )
        #expect(BridgeMessage(body: ["type": "ask", "id": "q1", "name": "ping"]) == .ask(id: "q1", name: "ping"))
        #expect(BridgeMessage(body: ["type": "ask", "id": "q1", "name": "sign-in", "text": "made-up"]) == .ask(id: "q1", name: "sign-in", text: "made-up"))
        #expect(BridgeMessage(body: ["type": "ask", "id": "q1", "name": "sign-in", "text": 7]) == .ask(id: "q1", name: "sign-in"))
        #expect(BridgeMessage(body: ["type": "ask", "id": "q1", "name": "sign-in", "text": String(repeating: "z", count: 5000)]) == .ask(id: "q1", name: "sign-in", text: String(repeating: "z", count: 200)))
    }

    @Test("ignores anything else")
    func refuses() {
        #expect(BridgeMessage(body: "ready") == nil)
        #expect(BridgeMessage(body: ["type": "route"]) == nil)
        #expect(BridgeMessage(body: ["type": "share"]) == nil)
        #expect(BridgeMessage(body: ["type": "eval", "code": "1"]) == nil)
        #expect(BridgeMessage(body: ["type": "ask", "name": "ping"]) == nil)
        #expect(BridgeMessage(body: ["type": "ask", "id": "q1"]) == nil)
        #expect(BridgeMessage(body: ["type": "ask", "id": "", "name": "ping"]) == nil)
    }

    @Test("the boot script hands the page its platform and the public site")
    func boot() {
        let script = Bridge.bootScript(platform: "ios", publicBase: "https://blog.bytesofpurpose.com/hifth/")
        #expect(script.source.contains("\"platform\":\"ios\""))
        #expect(script.source.contains("\"publicBase\":\"https:\\/\\/blog.bytesofpurpose.com\\/hifth\\/\"") || script.source.contains("\"publicBase\":\"https://blog.bytesofpurpose.com/hifth/\""))
        #expect(script.injectionTime == .atDocumentStart)
        #expect(script.isForMainFrameOnly)
    }

    @Test("the boot script hands the page the app's version, for the reader's problem report")
    func bootVersion() {
        let script = Bridge.bootScript(platform: "macos", publicBase: "https://example.invalid/", appVersion: "0.2.0 (3)")
        #expect(script.source.contains("\"appVersion\":\"0.2.0 (3)\""))
    }

    @Test("the app's version reads as the version, then the build in brackets")
    func versionLine() {
        #expect(Bridge.versionLine(info: ["CFBundleShortVersionString": "0.1.0", "CFBundleVersion": "7"]) == "0.1.0 (7)")
        #expect(Bridge.versionLine(info: ["CFBundleShortVersionString": "0.1.0"]) == "0.1.0")
        #expect(Bridge.versionLine(info: [:]) == "")
    }
}
