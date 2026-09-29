import Foundation
import WebKit

/// Serves `hifth-app://app/…` from the copied web build. The reading happens
/// off the main thread; the answer is delivered on it, and only if WebKit has
/// not stopped the task in the meantime. Answering a stopped task is an
/// uncatchable exception, and a fast page turn stops tasks all the time.
final class LocalSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root: URL
    /// Tasks WebKit still wants an answer for, keyed by identity. Holding the
    /// task itself (not only its identifier) means an identifier can never be
    /// reused by a new task before the old one is forgotten.
    private var live: [ObjectIdentifier: WKURLSchemeTask] = [:]

    init(root: URL) {
        self.root = root
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else {
            task.didFailWithError(URLError(.badURL))
            return
        }
        let id = ObjectIdentifier(task)
        live[id] = task
        let root = self.root
        Task.detached(priority: .userInitiated) {
            let reply = BundleFiles.reply(for: url, root: root)
            await MainActor.run {
                self.deliver(reply, to: id, url: url)
            }
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        live.removeValue(forKey: ObjectIdentifier(task))
    }

    private func deliver(_ reply: BundleFiles.Reply, to id: ObjectIdentifier, url: URL) {
        guard let task = live.removeValue(forKey: id) else { return }
        let headers = [
            "Content-Type": reply.contentType,
            "Content-Length": String(reply.data.count),
            "Cache-Control": "no-cache",
        ]
        guard let response = HTTPURLResponse(url: url, statusCode: reply.status, httpVersion: "HTTP/1.1", headerFields: headers) else {
            task.didFailWithError(URLError(.cannotCreateFile))
            return
        }
        task.didReceive(response)
        task.didReceive(reply.data)
        task.didFinish()
    }
}
