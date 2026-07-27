/**
 * The app-level keyboard map (Loop 6a) — the *precedence rule*, as a pure
 * function so it can be tested without a browser and read without tracing
 * listeners across three files.
 *
 * PLAN §Loop 6a asks for "arrows = pages, `/` = jumper". Loop 3 had already
 * given the arrows to the highlighter: when an ayah polygon has focus, Arrow /
 * Home / End step the focus ayah-to-ayah down the page. Both are correct and
 * they cannot both own the same keystroke, so:
 *
 * **The rule: arrows belong to whatever has focus; the page turn is only the
 * fallback.** Concretely, in order —
 *
 *   1. A modifier (Ctrl/Cmd/Alt) is held → the browser's, never ours.
 *   2. Focus is in a text field → the field's. (The jumper's own input relies
 *      on this: `/` must type a slash there, not re-open the jumper.)
 *   3. A modal dialog is open → the dialog's. Sheets trap Tab and own Escape
 *      themselves; a page-turn under an open sheet would move the ground the
 *      user is standing on.
 *   4. The event is already `defaultPrevented` → someone nearer the target
 *      consumed it (this is exactly how the highlighter signals "I took this
 *      arrow"). The app never second-guesses a consumed key.
 *   5. Focus is on an ayah polygon → the ayah stepper's, even for keys the
 *      highlighter did not consume (Home/End). Belt and braces for (4).
 *   6. Otherwise the app takes it: ArrowLeft/ArrowRight turn pages, `/` opens
 *      the jumper.
 *
 * Two details worth keeping:
 * - **Only the horizontal arrows turn pages.** The ayah stepper uses Down/Left
 *   for "next" and Up/Right for "previous" (reading order, RTL-agnostic). If
 *   the page turn also claimed Up/Down, the two axes would overlap on three of
 *   four arrows and vertical scrolling would die with them. Horizontal-only
 *   also matches the physical book: in an RTL mushaf the *next* page lies to
 *   the **left**, so ArrowLeft = +1 page, ArrowRight = −1.
 * - **`/` survives ayah focus** (rule 5 guards arrows only): opening the jumper
 *   from a selected ayah is a normal thing to want, and `/` means nothing to
 *   the stepper.
 */

/** Everything the rule needs to know about a keydown, with no DOM types. */
export interface KeyContext {
  /** `KeyboardEvent.key`. */
  readonly key: string;
  /** Ctrl/Cmd/Alt held — the combination belongs to the browser or the OS. */
  readonly modified: boolean;
  /** Another handler already consumed this event. */
  readonly defaultPrevented: boolean;
  /** Focus is in an input, textarea, select or contenteditable. */
  readonly inTextField: boolean;
  /** A modal sheet (hop popover, root lens, jumper, …) is open. */
  readonly inDialog: boolean;
  /** Focus is on an ayah polygon, where Loop 3's stepper owns the arrows. */
  readonly onAyah: boolean;
}

/** What the shell should do with a keystroke. `null` = leave it alone. */
export type KeyAction =
  | { readonly kind: "page"; readonly step: 1 | -1 }
  | { readonly kind: "jumper" }
  | null;

/** The key that opens the jumper (spec-free convention, PLAN §Loop 6a). */
export const JUMPER_KEY = "/";

/** Apply the precedence rule above to one keydown. */
export function appKeyAction(ctx: KeyContext): KeyAction {
  if (ctx.modified) return null; // 1
  if (ctx.inTextField) return null; // 2
  if (ctx.inDialog) return null; // 3
  if (ctx.defaultPrevented) return null; // 4

  if (ctx.key === JUMPER_KEY) return { kind: "jumper" }; // 6 (survives 5)

  if (ctx.onAyah) return null; // 5 — the ayah stepper owns the arrows

  // 6 — RTL page turn: the next page of a mushaf is the one to the left.
  if (ctx.key === "ArrowLeft") return { kind: "page", step: 1 };
  if (ctx.key === "ArrowRight") return { kind: "page", step: -1 };
  return null;
}
