import SwiftUI

@main
struct HifthApp: App {
    @State private var model = ShellModel()

    init() {
        // The first line of every run, so the lines after it can be matched to
        // the version and build that wrote them.
        #if os(macOS)
        AppLog.note("launch", ["platform": "macos"])
        #else
        AppLog.note("launch", ["platform": "ios"])
        #endif
        Sound.setUp()
    }

    var body: some Scene {
        WindowGroup {
            ShellView(model: model)
                .onOpenURL { url in model.open(url) }
        }
        #if os(macOS)
        // Wide enough for the two-page spread on first launch, or the size the
        // store screenshots ask for (WindowSize says which).
        .defaultSize(WindowSize.atLaunch)
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
