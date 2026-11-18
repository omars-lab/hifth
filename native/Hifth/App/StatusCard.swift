import SwiftUI

/// The card the launch file can put over the page (launch item ㉑): "please update" for a
/// version below the lowest still allowed, or the file's own notice. It sits at the bottom,
/// clear of the page's bars, never covers the whole page, and always has a close button:
/// reading is never blocked. "Please update" comes back at the next launch; a closed notice
/// does not.
struct StatusCard: View {
    let words: String
    let arabic: Bool
    let onClose: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(words)
                .font(.callout)
                // Leading follows the layout direction set below, so Arabic sits on the right.
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("hifth.status.words")
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.callout.weight(.semibold))
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(arabic ? "إغلاق" : "Close")
            .accessibilityIdentifier("hifth.status.close")
        }
        .environment(\.layoutDirection, arabic ? .rightToLeft : .leftToRight)
        .padding(14)
        .frame(maxWidth: 520)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
        .shadow(radius: 4, y: 1)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("hifth.status")
    }
}
