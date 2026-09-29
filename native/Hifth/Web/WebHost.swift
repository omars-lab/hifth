import SwiftUI
import WebKit

/// The web view, as a SwiftUI view. It is made once by the model and only
/// handed over here; nothing is loaded from an update, which would reload
/// the page under the reader on every state change.
#if os(iOS)
struct WebHost: UIViewRepresentable {
    let model: ShellModel

    func makeUIView(context: Context) -> WKWebView {
        model.webView
    }

    func updateUIView(_ view: WKWebView, context: Context) {}
}
#else
struct WebHost: NSViewRepresentable {
    let model: ShellModel

    func makeNSView(context: Context) -> WKWebView {
        model.webView
    }

    func updateNSView(_ view: WKWebView, context: Context) {}
}
#endif

/// The page, edge to edge, plus the one native element the tests can read: a
/// 1×1 label carrying the route. It is clipped rather than hidden, because an
/// element with no opacity is also absent from the accessibility tree.
struct ShellView: View {
    let model: ShellModel

    var body: some View {
        ZStack(alignment: .topLeading) {
            WebHost(model: model)
                .ignoresSafeArea()
            Text(model.currentHash)
                .font(.system(size: 1))
                .frame(width: 1, height: 1)
                .clipped()
                .accessibilityIdentifier("hifth.route")
                .accessibilityLabel(model.currentHash)
            if model.ready {
                Color.clear
                    .frame(width: 1, height: 1)
                    .accessibilityIdentifier("hifth.ready")
            }
        }
        #if os(macOS)
        .navigationTitle(model.title)
        #endif
    }
}
