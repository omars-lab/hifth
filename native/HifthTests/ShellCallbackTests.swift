import Foundation
import Testing
@testable import Hifth

/// What the shell does with an x-callback request once it is parsed: when it
/// answers, with what, and what happens when the page never shows the route.
/// The page is played by hand through `receive`; the answers are collected by
/// a fake opener instead of the system's.
@Suite("Shell answers x-callback requests")
@MainActor
struct ShellCallbackTests {
    private func model() -> (ShellModel, Opened) {
        let opened = Opened()
        let model = ShellModel(launchRoute: nil, callbackTimeout: .milliseconds(200))
        model.openCallback = { opened.urls.append($0) }
        return (model, opened)
    }

    final class Opened { var urls: [URL] = [] }

    private func url(_ s: String) throws -> URL { try #require(URL(string: s)) }

    @Test("open answers once the page shows the route")
    func openAnswersOnRoute() throws {
        let (model, opened) = model()
        model.receive(.ready)
        model.open(try url("hifth://x-callback-url/open?route=/hafs-kfqc/2:255&x-success=a://ok&x-error=a://no"))
        #expect(opened.urls.isEmpty)
        model.receive(.route("#/hafs-kfqc/2:255"))
        #expect(opened.urls.map(\.absoluteString) == [
            "a://ok?route=/hafs-kfqc/2:255&url=https://blog.bytesofpurpose.com/hifth/%23/hafs-kfqc/2:255"
        ])
        // Only once: the page reporting the same route again is not a second answer.
        model.receive(.route("#/hafs-kfqc/2:255"))
        #expect(opened.urls.count == 1)
    }

    @Test("open before the page is ready waits, then answers")
    func openWaitsForReady() throws {
        let (model, opened) = model()
        model.open(try url("hifth://x-callback-url/open?route=/hafs-kfqc/p45&x-success=a://ok"))
        model.receive(.ready)
        model.receive(.route("#/hafs-kfqc/p45"))
        #expect(opened.urls.first?.absoluteString.hasPrefix("a://ok?route=/hafs-kfqc/p45") == true)
    }

    @Test("a bad request is answered on the error address, and the page is left alone")
    func badRequest() throws {
        let (model, opened) = model()
        model.receive(.ready)
        model.open(try url("hifth://x-callback-url/open?route=nope&x-success=a://ok&x-error=a://no"))
        #expect(opened.urls.count == 1)
        #expect(opened.urls.first?.absoluteString.hasPrefix("a://no?errorCode=bad-route&errorMessage=") == true)
        model.open(try url("hifth://x-callback-url/nothing?x-error=a://no"))
        #expect(opened.urls.last?.absoluteString.hasPrefix("a://no?errorCode=unknown-action") == true)
    }

    @Test("a route the page never shows is reported as an error, not silence")
    func routeNeverShown() async throws {
        let (model, opened) = model()
        model.receive(.ready)
        model.open(try url("hifth://x-callback-url/open?route=/hafs-kfqc/p600&x-success=a://ok&x-error=a://no"))
        try await Task.sleep(for: .milliseconds(600))
        #expect(opened.urls.map(\.absoluteString) == ["a://no?errorCode=route-not-shown&errorMessage=the%20page%20did%20not%20open%20/hafs-kfqc/p600"])
        // Late is not an answer either.
        model.receive(.route("#/hafs-kfqc/p600"))
        #expect(opened.urls.count == 1)
    }

    @Test("current answers at once when a route is on screen")
    func currentNow() throws {
        let (model, opened) = model()
        model.receive(.ready)
        model.receive(.route("#/hafs-kfqc/2:47-48"))
        model.open(try url("hifth://x-callback-url/current?x-success=a://ok"))
        #expect(opened.urls.map(\.absoluteString) == [
            "a://ok?route=/hafs-kfqc/2:47-48&url=https://blog.bytesofpurpose.com/hifth/%23/hafs-kfqc/2:47-48"
        ])
    }

    @Test("current before anything is on screen waits for the first route")
    func currentWaits() throws {
        let (model, opened) = model()
        model.open(try url("hifth://x-callback-url/current?x-success=a://ok"))
        #expect(opened.urls.isEmpty)
        model.receive(.ready)
        #expect(opened.urls.isEmpty)
        model.receive(.route("#/hafs-kfqc/p1"))
        #expect(opened.urls.map(\.absoluteString) == [
            "a://ok?route=/hafs-kfqc/p1&url=https://blog.bytesofpurpose.com/hifth/%23/hafs-kfqc/p1"
        ])
    }

    @Test("a request with no addresses still does the action, quietly")
    func noAddresses() throws {
        let (model, opened) = model()
        model.receive(.ready)
        model.open(try url("hifth://x-callback-url/open?route=/hafs-kfqc/p2"))
        model.receive(.route("#/hafs-kfqc/p2"))
        model.open(try url("hifth://x-callback-url/current"))
        #expect(opened.urls.isEmpty)
    }

    @Test("a plain link still turns the page, with no answer to anyone")
    func plainLink() throws {
        let (model, opened) = model()
        model.receive(.ready)
        model.open(try url("hifth:///hafs-kfqc/p3"))
        model.receive(.route("#/hafs-kfqc/p3"))
        #expect(opened.urls.isEmpty)
        #expect(model.currentHash == "#/hafs-kfqc/p3")
    }
}
