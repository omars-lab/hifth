import Foundation

/// The copied web build, served from inside the app bundle.
///
/// The page's origin is `hifth-app://app` — frozen, because it is also the
/// storage origin: change the scheme or host and every reader's bookmarks and
/// notes are left behind under the old one. `file://` is not an option: WebKit
/// refuses `fetch()` of file URLs, and every page of the mus'haf is fetched.
///
/// This type is the pure part — path canonicalisation, content types, the
/// reply for a request — so it can be tested without a web view.
nonisolated enum BundleFiles {
    static let scheme = "hifth-app"
    static let host = "app"
    static let origin = "hifth-app://app"
    static let indexURL = URL(string: "hifth-app://app/index.html")!
    /// The folder name the Makefile copies the web build into.
    static let folderName = "WebBundle"

    struct Reply: Sendable {
        let status: Int
        let contentType: String
        let data: Data
    }

    /// Where the web build sits in this app, or `nil` when `make app-web` has
    /// not been run before the build.
    static var root: URL? {
        Bundle.main.url(forResource: folderName, withExtension: nil)
    }

    /// The path inside the folder a request maps to, canonical, with `/` and a
    /// trailing slash meaning the folder's index. `nil` when the request tries
    /// to climb out of the folder.
    static func relativePath(forRequestPath requestPath: String) -> String? {
        let decoded = requestPath.removingPercentEncoding ?? requestPath
        var parts: [String] = []
        for segment in decoded.split(separator: "/", omittingEmptySubsequences: true) {
            switch segment {
            case ".":
                continue
            case "..":
                guard parts.popLast() != nil else { return nil }
            default:
                parts.append(String(segment))
            }
        }
        if parts.isEmpty || decoded.hasSuffix("/") {
            parts.append("index.html")
        }
        return parts.joined(separator: "/")
    }

    /// `Content-Type` per extension. A module script served as anything but
    /// JavaScript is refused by the browser, silently, and the app never boots.
    static func contentType(forExtension ext: String) -> String {
        let key = ext.lowercased()
        if let text = textTypes[key] { return text + "; charset=utf-8" }
        return binaryTypes[key] ?? "application/octet-stream"
    }

    private static let textTypes: [String: String] = [
        "html": "text/html",
        "htm": "text/html",
        "js": "text/javascript",
        "mjs": "text/javascript",
        "css": "text/css",
        "json": "application/json",
        "map": "application/json",
        "svg": "image/svg+xml",
        "txt": "text/plain",
        "md": "text/markdown",
        "xml": "application/xml",
        "csv": "text/csv",
    ]

    private static let binaryTypes: [String: String] = [
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "gif": "image/gif",
        "ico": "image/x-icon",
        "avif": "image/avif",
        "woff": "font/woff",
        "woff2": "font/woff2",
        "ttf": "font/ttf",
        "otf": "font/otf",
        "webmanifest": "application/manifest+json",
        "wasm": "application/wasm",
        "mp3": "audio/mpeg",
        "m4a": "audio/mp4",
        "ogg": "audio/ogg",
        "wav": "audio/wav",
        "mp4": "video/mp4",
        "webm": "video/webm",
        "pdf": "application/pdf",
    ]

    /// The whole answer for one request. Raw bytes, no compression: the
    /// handler cannot say `Content-Encoding` and have WebKit inflate it.
    static func reply(for url: URL, root: URL) -> Reply {
        guard let relative = relativePath(forRequestPath: url.path) else {
            return Reply(status: 403, contentType: "text/plain; charset=utf-8", data: Data("forbidden".utf8))
        }
        let file = root.appendingPathComponent(relative)
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: file.path, isDirectory: &isDirectory),
              !isDirectory.boolValue,
              let data = try? Data(contentsOf: file, options: .mappedIfSafe)
        else {
            return Reply(status: 404, contentType: "text/plain; charset=utf-8", data: Data("not found: \(relative)".utf8))
        }
        return Reply(status: 200, contentType: contentType(forExtension: file.pathExtension), data: data)
    }
}
