import CoreGraphics
import Foundation
#if os(iOS)
import UIKit
#endif

/// The Apple Pencil's double-tap and squeeze (docs/PLAN.md, 96;
/// docs/design/pencil-gestures.md, ①, option B). A web page never hears
/// either; the app does, and hands each one to the page with the reader's own
/// pencil setting and, when the pencil hovers, where its tip is. What the
/// setting means in Hifth is the page's to decide (`apps/web/src/pencil.ts`),
/// so the shell only names it.
enum PencilGesture: String {
    case doubleTap
    case squeeze
}

extension ShellModel {
    /// The one line a gesture runs: the page's own handler, exposed under
    /// `window.__HIFTH_PAGE__` by `apps/web/src/native-bridge.ts`.
    static let pencilScript = "window.__HIFTH_PAGE__?.pencil(e);"

    /// Hand a gesture to the page. `tip` is where the pencil hovered, in the
    /// web view's points, which are the page's own pixels here (it never
    /// scrolls or zooms); `nil` when it was not near. Before the page is ready
    /// the gesture is dropped, as a menu press is: one acted on later would be
    /// a tool change nobody asked for.
    func pencil(_ gesture: PencilGesture, preference: String, tip: CGPoint?) {
        guard ready else { return }
        var e: [String: Any] = ["kind": gesture.rawValue, "pref": preference]
        if let tip {
            e["x"] = Double(tip.x)
            e["y"] = Double(tip.y)
        }
        runScript(Self.pencilScript, ["e": e])
    }
}

#if os(iOS)
/// Hears the pencil on the web view and passes each gesture to the model.
/// The interaction holds its delegate weakly, so the model keeps this alive.
final class PencilListener: NSObject, UIPencilInteractionDelegate {
    weak var model: ShellModel?

    /// The reader's setting, by the name the page reads.
    static func name(of action: UIPencilPreferredAction) -> String {
        switch action {
        case .ignore: "ignore"
        case .switchEraser: "eraser"
        case .switchPrevious: "previous"
        case .showColorPalette: "colours"
        case .showInkAttributes: "ink"
        case .showContextualPalette: "palette"
        case .runSystemShortcut: "shortcut"
        @unknown default: "unknown"
        }
    }

    @available(iOS 17.5, *)
    func pencilInteraction(_ interaction: UIPencilInteraction, didReceiveTap tap: UIPencilInteraction.Tap) {
        model?.pencil(
            .doubleTap,
            preference: Self.name(of: UIPencilInteraction.preferredTapAction),
            tip: tap.hoverPose?.location
        )
    }

    /// A squeeze is a hold: it counts once, when the reader lets go, and not
    /// at all if it is cancelled.
    @available(iOS 17.5, *)
    func pencilInteraction(_ interaction: UIPencilInteraction, didReceiveSqueeze squeeze: UIPencilInteraction.Squeeze) {
        guard squeeze.phase == .ended else { return }
        model?.pencil(
            .squeeze,
            preference: Self.name(of: UIPencilInteraction.preferredSqueezeAction),
            tip: squeeze.hoverPose?.location
        )
    }

    /// Before iOS 17.5 the double-tap came with no tip.
    @available(iOS, deprecated: 17.5)
    func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
        model?.pencil(.doubleTap, preference: Self.name(of: UIPencilInteraction.preferredTapAction), tip: nil)
    }
}
#endif
