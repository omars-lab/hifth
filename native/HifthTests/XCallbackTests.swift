import Foundation
import Testing
@testable import Hifth

/// The x-callback-url door: `hifth://x-callback-url/<action>?…&x-success=…&x-error=…`.
/// Another app (Shortcuts, Drafts, a script) asks for one action and says where
/// to send the answer. These pin the two actions, the parameters, the refusals,
/// and the exact URLs the caller gets back — the same URLs the OpenAPI file in
/// `docs/design/app-url-scheme.openapi.json` promises.
@Suite("XCallback")
struct XCallbackTests {
    private func url(_ s: String) throws -> URL { try #require(URL(string: s)) }

    @Test("a plain hifth:// link is not an x-callback request")
    func plainLinksPassThrough() throws {
        #expect(XCallback.parse(try url("hifth:///hafs-kfqc/2:255")) == nil)
        #expect(XCallback.parse(try url("hifth://hafs-kfqc/p45")) == nil)
        #expect(XCallback.parse(try url("https://x-callback-url/open")) == nil)
    }

    @Test("open: the route in the shape callers send, and where to answer")
    func open() throws {
        let parsed = XCallback.parse(
            try url("hifth://x-callback-url/open?route=/hafs-kfqc/2:255&x-success=shortcuts://done&x-error=shortcuts://failed")
        )
        guard case .request(let request)? = parsed else {
            Issue.record("expected a request, got \(String(describing: parsed))")
            return
        }
        #expect(request.action == .open(hash: "#/hafs-kfqc/2:255"))
        #expect(request.callbacks.success?.absoluteString == "shortcuts://done")
        #expect(request.callbacks.error?.absoluteString == "shortcuts://failed")
        #expect(request.callbacks.cancel == nil)
    }

    @Test("open: the route may be percent-encoded, and its query survives")
    func openEncoded() throws {
        let parsed = XCallback.parse(
            try url("hifth://x-callback-url/open?route=%2Fhafs-kfqc%2F2%3A255%3Fw%3D3-7%26skin%3Dtajweed")
        )
        guard case .request(let request)? = parsed else {
            Issue.record("expected a request")
            return
        }
        #expect(request.action == .open(hash: "#/hafs-kfqc/2:255?w=3-7&skin=tajweed"))
    }

    @Test("open, said plainly: a page, a verse, a run, words in a verse")
    func openPlain() throws {
        func hash(_ q: String) -> String? {
            guard case .request(let r)? = XCallback.parse(URL(string: "hifth://x-callback-url/open?" + q)!),
                  case .open(let hash) = r.action else { return nil }
            return hash
        }
        #expect(hash("page=45") == "#/hafs-kfqc/p45")
        #expect(hash("verse=2:255") == "#/hafs-kfqc/2:255")
        #expect(hash("verse=2:47-48") == "#/hafs-kfqc/2:47-48")
        #expect(hash("verse=2:47-2:48") == "#/hafs-kfqc/2:47-2:48")
        #expect(hash("verse=2:255&words=3-7") == "#/hafs-kfqc/2:255?w=3-7")
        #expect(hash("verse=2:255&words=5") == "#/hafs-kfqc/2:255?w=5")
        #expect(hash("edition=hafs-kfqc&page=1") == "#/hafs-kfqc/p1")
        // Other keys the web app's links take pass straight through, in order.
        #expect(hash("page=7&field=dark&tool=note") == "#/hafs-kfqc/p7?field=dark&tool=note")
        #expect(hash("verse=2:255&skin=tajweed&words=3-7&x-success=a://b") == "#/hafs-kfqc/2:255?w=3-7&skin=tajweed")
        // A route given outright wins over the plain keys.
        #expect(hash("route=/hafs-kfqc/p2&page=9") == "#/hafs-kfqc/p2")
        // A verse's commentary, and a surah's context: the panels the web app opens.
        #expect(hash("verse=2:255&open=commentary") == "#/hafs-kfqc/2:255?open=commentary")
        #expect(hash("verse=2:255&open=context") == "#/hafs-kfqc/2:255?open=context")
        // `surah=` is the short way to a surah's context: its first verse, introduction first.
        #expect(hash("surah=2") == "#/hafs-kfqc/2:1?open=context")
        #expect(hash("surah=36&field=dark") == "#/hafs-kfqc/36:1?field=dark&open=context")
        // The mode the app opens in: `mode=` is `tool=` by a plainer name.
        #expect(hash("page=7&mode=note") == "#/hafs-kfqc/p7?tool=note")
        #expect(hash("verse=2:255&mode=highlight&view=one") == "#/hafs-kfqc/2:255?tool=highlight&view=one")
    }

    @Test("the mode, panel and view names are checked, so a misspelt one is an error and not silence", arguments: [
        ("page=7&mode=notes", "bad-route"),
        ("page=7&tool=sign", "bad-route"),
        ("verse=2:255&open=tafsir", "bad-route"),
        ("page=7&view=three", "bad-route"),
        ("page=7&mode=note&tool=read", "bad-route"),
        ("surah=2&verse=2:255", "bad-route"),
        ("surah=115", "bad-route"),
        ("surah=0", "bad-route"),
    ])
    func openNamesChecked(_ q: String, _ code: String) throws {
        guard case .failure(let f, _)? = XCallback.parse(try url("hifth://x-callback-url/open?" + q)) else {
            Issue.record("expected a failure for \(q)")
            return
        }
        #expect(f.code == code, Comment(rawValue: q))
        #expect(!f.message.isEmpty)
    }

    /// The lists the shell checks `mode`/`tool`, `open` and `view` against are
    /// the web app's; the OpenAPI file carries a copy for readers, and a vitest
    /// on the web side holds that copy to the router. This holds the shell to
    /// the same copy, so all three agree or a test says which moved.
    @Test("the shell's lists of tools, panels and views match the OpenAPI file")
    func listsMatchSpec() throws {
        let root = try #require(try JSONSerialization.jsonObject(with: Data(contentsOf: Self.specURL)) as? [String: Any])
        let paths = try #require(root["paths"] as? [String: Any])
        let open = try #require(paths["/x-callback-url/open"] as? [String: Any])
        let get = try #require(open["get"] as? [String: Any])
        let params = try #require(get["parameters"] as? [[String: Any]])
        func enumOf(_ name: String) -> [String]? {
            guard let p = params.first(where: { $0["name"] as? String == name }),
                  let schema = p["schema"] as? [String: Any] else { return nil }
            return schema["enum"] as? [String]
        }
        #expect(enumOf("tool") == XCallback.tools)
        #expect(enumOf("mode") == XCallback.tools)
        #expect(enumOf("open") == XCallback.panels)
        #expect(enumOf("view") == XCallback.views)
    }

    static let specURL = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        .appendingPathComponent("docs/design/app-url-scheme.openapi.json")

    @Test("open, said wrongly", arguments: [
        ("page=45&verse=2:255", "bad-route"),
        ("words=3-7", "bad-route"),
        ("page=abc", "bad-route"),
        ("verse=2", "bad-route"),
        ("edition=Hafs&page=1", "bad-route"),
        ("page=1&edition=hafs/kfqc", "bad-route"),
        ("edition=hafs-kfqc", "missing-route"),
        ("mode=note", "missing-route"),
    ])
    func openPlainRefuses(_ q: String, _ code: String) throws {
        guard case .failure(let f, _)? = XCallback.parse(try url("hifth://x-callback-url/open?" + q)) else {
            Issue.record("expected a failure for \(q)")
            return
        }
        #expect(f.code == code, Comment(rawValue: q))
    }

    @Test("current: no parameters, just where to answer")
    func current() throws {
        let parsed = XCallback.parse(try url("hifth://x-callback-url/current?x-success=drafts://x-callback-url/create"))
        guard case .request(let request)? = parsed else {
            Issue.record("expected a request")
            return
        }
        #expect(request.action == .current)
        #expect(request.callbacks.success?.absoluteString == "drafts://x-callback-url/create")
    }

    @Test("the action name is case-insensitive; a trailing slash is fine")
    func lenientAction() throws {
        guard case .request(let a)? = XCallback.parse(try url("hifth://x-callback-url/Current/?x-success=a://b")) else {
            Issue.record("expected a request")
            return
        }
        #expect(a.action == .current)
    }

    @Test("refusals carry a code, a message, and the caller's error address", arguments: [
        ("hifth://x-callback-url/open?x-error=a://e", "missing-route"),
        ("hifth://x-callback-url/open?route=nonsense&x-error=a://e", "bad-route"),
        ("hifth://x-callback-url/open?route=/hafs-kfqc/p0&x-error=a://e", "bad-route"),
        ("hifth://x-callback-url/bookmark?route=/hafs-kfqc/p1&x-error=a://e", "unknown-action"),
        ("hifth://x-callback-url/?x-error=a://e", "unknown-action"),
        ("hifth://x-callback-url?x-error=a://e", "unknown-action"),
    ])
    func refuses(_ raw: String, _ code: String) throws {
        guard case .failure(let error, let callbacks)? = XCallback.parse(try url(raw)) else {
            Issue.record("expected a failure for \(raw)")
            return
        }
        #expect(error.code == code)
        #expect(!error.message.isEmpty)
        #expect(callbacks.error?.absoluteString == "a://e")
    }

    @Test("a callback address may not point back into this app, or at a file or script")
    func unsafeCallbacksAreDropped() throws {
        guard case .request(let r)? = XCallback.parse(
            try url("hifth://x-callback-url/current?x-success=hifth://x-callback-url/current&x-error=file:///etc/passwd&x-cancel=javascript:1")
        ) else {
            Issue.record("expected a request")
            return
        }
        #expect(r.callbacks.success == nil)
        #expect(r.callbacks.error == nil)
        #expect(r.callbacks.cancel == nil)
    }

    @Test("the success answer appends route and url to the caller's address")
    func successURL() throws {
        let callbacks = XCallback.Callbacks(
            success: try url("shortcuts://x-callback-url/run-shortcut?name=Log%20verse"),
            error: nil,
            cancel: nil
        )
        let answer = callbacks.successURL(route: "#/hafs-kfqc/2:255?w=3-7", publicBase: "https://blog.bytesofpurpose.com/hifth/")
        #expect(
            answer?.absoluteString
                == "shortcuts://x-callback-url/run-shortcut?name=Log%20verse&route=/hafs-kfqc/2:255?w%3D3-7&url=https://blog.bytesofpurpose.com/hifth/%23/hafs-kfqc/2:255?w%3D3-7"
        )
        // The caller's own parameters are kept exactly.
        #expect(answer?.query?.hasPrefix("name=Log%20verse&") == true)
    }

    @Test("the error answer follows the x-callback-url convention: errorCode and errorMessage")
    func errorURL() throws {
        let callbacks = XCallback.Callbacks(success: nil, error: try url("a://e"), cancel: nil)
        let answer = callbacks.errorURL(XCallback.Failure(code: "bad-route", message: "not a route: x y"))
        #expect(answer?.absoluteString == "a://e?errorCode=bad-route&errorMessage=not%20a%20route:%20x%20y")
    }

    @Test("no address given means no answer, not a crash")
    func noCallbacks() {
        let none = XCallback.Callbacks(success: nil, error: nil, cancel: nil)
        #expect(none.successURL(route: "#/hafs-kfqc/p1", publicBase: "https://x/") == nil)
        #expect(none.errorURL(XCallback.Failure(code: "c", message: "m")) == nil)
    }

    /// The OpenAPI file lists example links under `x-examples`, each marked as
    /// one the shell accepts or refuses. This keeps that file honest: an example
    /// the parser disagrees with fails here.
    @Test("every example in the OpenAPI file behaves as the file says")
    func openAPIExamples() throws {
        let data = try Data(contentsOf: Self.specURL)
        let root = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        let examples = try #require(root["x-examples"] as? [[String: Any]])
        #expect(examples.count >= 8)
        for example in examples {
            let raw = try #require(example["url"] as? String)
            let expected = try #require(example["result"] as? String)
            let link = try #require(URL(string: raw), "not even a URL: \(raw)")
            let actual: String
            switch XCallback.parse(link) {
            case .request(let r)?:
                switch r.action {
                case .open(let hash): actual = "open " + hash
                case .current: actual = "current"
                }
            case .failure(let f, _)?:
                actual = "error " + f.code
            case nil:
                actual = Route.parse(link).map { "open " + $0 } ?? "refused"
            }
            #expect(actual == expected, "\(raw)")
        }
    }
}
