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
        // A Mac app shows its page turns in a menu with the shortcut beside
        // each. ⌘← is the next page because the mus'haf reads to the left; the
        // plain arrows keep working inside the page as before.
        .commands {
            CommandMenu("Page") {
                Button("Next Page") { model.stepPage(1) }
                    .keyboardShortcut(.leftArrow, modifiers: .command)
                    .disabled(!model.ready)
                Button("Previous Page") { model.stepPage(-1) }
                    .keyboardShortcut(.rightArrow, modifiers: .command)
                    .disabled(!model.ready)
            }
        }
        #endif
    }
}
