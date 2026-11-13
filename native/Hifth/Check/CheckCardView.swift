#if DEBUG
import SwiftUI

/// The check card on screen: a small panel in the top corner with the steps
/// to do, a ✓ and a ✗ for each, a note, and Done. Touches outside it reach the
/// page, so each step can be done with the card open. It folds to one small
/// button. Only in builds from the laptop.
struct CheckCardView: View {
    @Bindable var card: CheckCard
    let onDone: () -> Void
    let onClose: () -> Void

    private var answered: Int { card.answers.compactMap { $0 }.count }

    var body: some View {
        if card.folded {
            Button {
                card.folded = false
            } label: {
                Label("Check \(answered)/\(card.check.steps.count)", systemImage: "checklist")
                    .font(.callout.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.regularMaterial, in: Capsule())
                    .shadow(radius: 4, y: 2)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("hifth.check.unfold")
        } else {
            open
        }
    }

    private var open: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(card.check.title)
                    .font(.headline)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 8)
                Button { card.folded = true } label: { Image(systemName: "chevron.up") }
                    .accessibilityLabel("Fold the card")
                    .accessibilityIdentifier("hifth.check.fold")
                Button(action: onClose) { Image(systemName: "xmark") }
                    .accessibilityLabel("Close without finishing")
                    .accessibilityIdentifier("hifth.check.close")
            }
            .buttonStyle(.borderless)

            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(card.check.steps.enumerated()), id: \.offset) { index, step in
                        row(index, step)
                    }
                    TextField("Note (optional)", text: $card.note, axis: .vertical)
                        .lineLimit(1...4)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityIdentifier("hifth.check.note")
                }
            }
            .frame(maxHeight: 420)
            .fixedSize(horizontal: false, vertical: true)

            HStack {
                Text("\(answered) of \(card.check.steps.count) answered")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Done", action: onDone)
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier("hifth.check.done")
            }
        }
        .padding(14)
        .frame(width: 340)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
        .shadow(radius: 8, y: 3)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("hifth.check")
    }

    private func row(_ index: Int, _ step: XCallback.CheckStep) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(index + 1)")
                .font(.callout.monospacedDigit().weight(.semibold))
                // A plain grey, not `.secondary`: both the faded style and
                // `Color.secondary` drew nothing inside the scroll view over
                // the frosted card (iPad simulator, iOS 26.5).
                .foregroundStyle(Color.gray)
                .frame(width: 18, alignment: .trailing)
            VStack(alignment: .leading, spacing: 3) {
                Text(step.action)
                    .font(.callout)
                    .fixedSize(horizontal: false, vertical: true)
                if let see = step.see {
                    Text("You should see: \(see)")
                        .font(.caption)
                        .foregroundStyle(Color.gray)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 4)
            answerButton(index, .pass, symbol: "checkmark", tint: .green, label: "Step \(index + 1) worked")
            answerButton(index, .fail, symbol: "xmark", tint: .red, label: "Step \(index + 1) did not work")
        }
    }

    /// Tapping the chosen answer again clears it.
    private func answerButton(_ index: Int, _ answer: CheckCard.Answer, symbol: String, tint: Color, label: String) -> some View {
        let chosen = card.answers[index] == answer
        return Button {
            card.answers[index] = chosen ? nil : answer
        } label: {
            Image(systemName: symbol)
                .font(.callout.weight(.bold))
                .frame(width: 34, height: 34)
                .foregroundStyle(chosen ? Color.white : tint)
                .background(chosen ? tint : tint.opacity(0.12), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(chosen ? .isSelected : [])
        .accessibilityIdentifier("hifth.check.\(index + 1).\(answer.rawValue)")
    }
}
#endif
