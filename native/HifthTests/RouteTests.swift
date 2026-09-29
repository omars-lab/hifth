import Foundation
import Testing
@testable import Hifth

/// The route is the web app's own hash, `#/<edition>/<target>[?query]`, carried
/// unchanged. These pin the three doors it comes in through — a `hifth://` link,
/// the `HIFTH_ROUTE` launch variable, a `--route=` argument — and that anything
/// off-grammar is refused here rather than parsed into nothing on the far side.
@Suite("Route")
struct RouteTests {
    @Test("a bare path becomes the hash the web app shows")
    func hashFromPath() {
        #expect(Route.hash(from: "/hafs-kfqc/2:255") == "#/hafs-kfqc/2:255")
        #expect(Route.hash(from: "#/hafs-kfqc/2:255") == "#/hafs-kfqc/2:255")
        #expect(Route.hash(from: "/hafs-kfqc/p45") == "#/hafs-kfqc/p45")
        #expect(Route.hash(from: "/hafs-kfqc/2:47-2:48") == "#/hafs-kfqc/2:47-2:48")
        #expect(Route.hash(from: "/hafs-kfqc/2:47-48") == "#/hafs-kfqc/2:47-48")
        #expect(Route.hash(from: "/hafs-kfqc/2:255?w=3-7&skin=tajweed") == "#/hafs-kfqc/2:255?w=3-7&skin=tajweed")
        #expect(Route.hash(from: "  /hafs-kfqc/p1\n") == "#/hafs-kfqc/p1")
    }

    @Test("off-grammar input is refused", arguments: [
        "", "/", "hafs-kfqc/2:255", "/hafs-kfqc", "/hafs-kfqc/", "/hafs-kfqc/2:255/extra",
        "/hafs-kfqc/p0", "/hafs-kfqc/0:1", "/hafs-kfqc/2:", "/hafs-kfqc/x", "/HAFS/2:1",
        "/hafs-kfqc/2:1?w=3 7", "/hafs-kfqc/2:1?q=\"x\"", "/hafs-kfqc/2:1#x",
        "javascript:alert(1)", "/../index.html",
    ])
    func refuses(_ raw: String) {
        #expect(Route.hash(from: raw) == nil)
    }

    @Test("a hifth:// link in each shape people will paste")
    func parseURL() throws {
        // Three slashes: the route is the path.
        #expect(Route.parse(try #require(URL(string: "hifth:///hafs-kfqc/2:255"))) == "#/hafs-kfqc/2:255")
        // Two slashes: the edition landed in the host.
        #expect(Route.parse(try #require(URL(string: "hifth://hafs-kfqc/p45"))) == "#/hafs-kfqc/p45")
        // A site link's tail, fragment and all.
        #expect(Route.parse(try #require(URL(string: "hifth://open/#/hafs-kfqc/2:255?w=1-2"))) == "#/hafs-kfqc/2:255?w=1-2")
        // Query survives.
        #expect(Route.parse(try #require(URL(string: "hifth:///hafs-kfqc/2:255?skin=tajweed"))) == "#/hafs-kfqc/2:255?skin=tajweed")
        // Case of the scheme does not matter.
        #expect(Route.parse(try #require(URL(string: "HIFTH:///hafs-kfqc/p2"))) == "#/hafs-kfqc/p2")
    }

    @Test("other schemes and empty links are not routes")
    func parseRefuses() throws {
        #expect(Route.parse(try #require(URL(string: "https://blog.bytesofpurpose.com/hifth/#/hafs-kfqc/2:255"))) == nil)
        #expect(Route.parse(try #require(URL(string: "hifth://"))) == nil)
        #expect(Route.parse(try #require(URL(string: "hifth:///"))) == nil)
        #expect(Route.parse(try #require(URL(string: "hifth-app://app/index.html"))) == nil)
    }

    @Test("the launch variable and argument")
    func launch() {
        #expect(Route.fromEnvironment(["HIFTH_ROUTE": "/hafs-kfqc/2:255"]) == "#/hafs-kfqc/2:255")
        #expect(Route.fromEnvironment(["HIFTH_ROUTE": "nonsense"]) == nil)
        #expect(Route.fromEnvironment([:]) == nil)
        #expect(Route.fromArguments(["Hifth", "--route=/hafs-kfqc/p3"]) == "#/hafs-kfqc/p3")
        #expect(Route.fromArguments(["Hifth"]) == nil)
    }
}
