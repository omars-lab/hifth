#if DEBUG
import SwiftUI

/// "Add a note", shown for a few seconds after a screenshot. Typing or
/// dictating keeps it up; left alone, it goes and the capture is kept without
/// a note. Whatever was typed is kept when it closes, however it closes.
struct CaptureNoteBanner: View {
    @Bindable var model: ShellModel
    let capture: URL
    @FocusState private var typing: Bool

    /// How long the banner waits for the reader before going by itself.
    static let staysFor: Duration = .seconds(6)

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "camera.viewfinder")
                .foregroundStyle(.secondary)
            TextField("Add a note to this screenshot", text: $model.captureNoteText, axis: .vertical)
                .lineLimit(1...4)
                .focused($typing)
                .submitLabel(.done)
                .onSubmit(model.closeNote)
                .accessibilityIdentifier("hifth.capture.note")
            Button("Done", action: model.closeNote)
                .accessibilityIdentifier("hifth.capture.done")
        }
        .padding(12)
        .frame(maxWidth: 440)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
        .shadow(radius: 6, y: 2)
        .task(id: capture) {
            try? await Task.sleep(for: Self.staysFor)
            if !typing && model.captureNoteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                model.closeNote()
            }
        }
    }
}
#endif
