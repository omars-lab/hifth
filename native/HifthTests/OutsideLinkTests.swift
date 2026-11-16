import Foundation
import Testing
@testable import Hifth

/// Apple's age questions ask whether an app can reach any page on the web.
/// Hifth must not: only its own bundled pages load inside it, and anything
/// else either goes to the system browser or goes nowhere
/// (docs/design/app-store-launch.md, item 14).
@Suite("Links that leave the app")
@MainActor
struct OutsideLinkTests {
    private func decision(_ address: String) -> NavigationPolicy.Decision {
        NavigationPolicy.decision(for: URL(string: address)!, shouldPerformDownload: false)
    }

    @Test("only the app's own pages, and a blank page, load inside it")
    func onlyOwnPagesStayInside() {
        #expect(decision("hifth-app://app/index.html") == .allow)
        #expect(decision("hifth-app://app/#/page/3") == .allow)
        #expect(decision("about:blank") == .allow)
    }

    @Test("every other address is kept out of the app's own view")
    func everythingElseLeaves() {
        for address in [
            "https://example.com/", "http://example.com/", "https://hifth.app/support",
            "mailto:someone@example.com", "file:///etc/hosts", "data:text/html,hello",
            "javascript:alert(1)", "tel:123", "sms:123", "ftp://example.com/",
            "hifth://open?page=3", "x-safari-https://example.com/",
        ] {
            #expect(decision(address) == .external, "\(address) would load inside the app")
        }
    }

    @Test("of those, only web pages and mail go on to another app; the rest are dropped")
    func onlyWebAndMailOpenElsewhere() {
        for address in ["https://example.com/", "http://example.com/", "mailto:someone@example.com"] {
            #expect(Sharing.opensInAnotherApp(URL(string: address)!), "\(address) should open in the browser or mail")
        }
        for address in [
            "file:///etc/hosts", "data:text/html,hello", "javascript:alert(1)", "tel:123", "sms:123",
            "ftp://example.com/", "hifth://open?page=3", "x-safari-https://example.com/", "hifth-app://app/",
        ] {
            #expect(!Sharing.opensInAnotherApp(URL(string: address)!), "\(address) should be dropped")
        }
    }
}
