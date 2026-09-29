import SwiftUI

@main
struct HifthApp: App {
    @State private var model = ShellModel()

    var body: some Scene {
        WindowGroup {
            ShellView(model: model)
                .onOpenURL { url in model.open(url) }
        }
        #if os(macOS)
        // Wide enough for the two-page spread on first launch: the web app's
        // desktop layout begins at 1024×740.
        .defaultSize(width: 1280, height: 860)
        .windowResizability(.contentSize)
        #endif
    }
}
