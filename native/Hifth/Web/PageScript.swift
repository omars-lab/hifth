import WebKit

/// Running a script in the page, through WebKit's own call.
///
/// WebKit also offers a Swift-only form of this call, but that form lives in a
/// separate library (libswiftWebKit) that iPadOS 18 does not have. Calling it
/// even once made the app need that library, so the app would not start on an
/// iPadOS 18.5 simulator ("Library missing"). Every script the app runs goes
/// through these two helpers instead; scripts/native-no-swift-only-webkit.test.mjs
/// keeps the Swift-only form out (docs/issues/ipad-crash-on-verse-touch.md).
extension WKWebView {
    /// Runs `body` as the body of an async function in the page, with
    /// `arguments` as its named values, and hands back what it returned.
    @MainActor
    func runPageScript(
        _ body: String,
        arguments: [String: Any] = [:],
        done: @escaping @MainActor (Result<Any, Error>) -> Void
    ) {
        __callAsyncJavaScript(body, arguments: arguments, inFrame: nil, in: .page) { value, error in
            if let error {
                done(.failure(error))
            } else {
                done(.success(value ?? NSNull()))
            }
        }
    }

    /// The same, waited for.
    @MainActor
    func runPageScript(_ body: String, arguments: [String: Any] = [:]) async throws -> Any {
        let answer: PageAnswer = try await withCheckedThrowingContinuation { continuation in
            runPageScript(body, arguments: arguments) { result in
                switch result {
                case .success(let value): continuation.resume(returning: PageAnswer(value: value))
                case .failure(let error): continuation.resume(throwing: error)
                }
            }
        }
        return answer.value
    }
}

/// What a page script returned, carried back across the wait. It is only
/// ever read on the main thread, where it was made.
private struct PageAnswer: @unchecked Sendable {
    let value: Any
}
