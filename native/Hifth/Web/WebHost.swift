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
            #if DEBUG
            // The check card a `check` link opened, top corner, over the page.
            if let card = model.checkCard {
                CheckCardView(card: card, onDone: model.finishCheck, onClose: model.closeCheck)
                    .padding(.top, 56)
                    .padding(.trailing, 12)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .id(ObjectIdentifier(card))
            }
            // "Add a note" after a walk screenshot: bottom middle, clear of the
            // check card and of the page's own bars at the top.
            if let capture = model.captureNote {
                CaptureNoteBanner(model: model, capture: capture)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 24)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    .id(capture)
            }
            #endif
        }
        #if os(macOS)
        .navigationTitle(model.title)
        #endif
    }
}
