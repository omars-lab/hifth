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
 * **The keys that survive rule 5, and why there have to be some** (§7 ⑤). Rule
 * 5 is right and is not being reopened: while an ayah has focus the stepper owns
 * the arrows. What it lacked was a complement. Tapping an ayah is this app's
 * central gesture, so a hafiz is in that state most of the time, and from inside
 * it *no unmodified key turned a page and no key got you out* — the reader was
 * left with a keyboard that had quietly stopped working and nothing on screen
 * saying so. Two exits, above rule 5:
 *
 *   - **PageDown = +1, PageUp = −1.** Literally the page keys. The ayah stepper
 *     does not claim them, so nothing is taken from anyone, and — unlike the
 *     arrows — they name no direction, so the RTL question the arrows had to
 *     settle below does not arise for them at all. They work at *every* focus,
 *     not only on an ayah, which is what makes them teachable as "the page keys"
 *     rather than as an escape hatch from one state.
 *   - **Escape lets go of the ayah**, restoring the arrows through rule 6. It is
 *     under rule 3, not over it: with a sheet open Escape is the sheet's, always,
 *     because closing what is in front of you is the more urgent meaning and a
 *     reader who pressed it twice would expect to close then unfocus.
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
 *
 * **A step is one page, at every width** (`docs/design/desktop.md` §8 ①, settled
 * at Loop 4b). A desktop window shows an open mus'haf — two leaves — and the
 * obvious question is whether an arrow should then turn the *opening*, ±2, the
 * way a hand turns a leaf. It should not, and none of the reasons is about how
 * many pages this build vendors:
 *
 *   - `stepPage` names a landing out loud whenever it is not the page next door,
 *     because a reader who arrives somewhere they did not ask for has to be told
 *     (`page-turning.md` §7 ④). A ±2 step is *never* the page next door, so the
 *     rule would either speak on every turn or grow an exception for the
 *     commonest case in the app.
 *   - The page number is what the URL carries and what the announcer says. Under
 *     ±2 the arrows reach only one parity from wherever they start, and the
 *     reader asked to leave them for the jumper is the one with the fewest ways
 *     back.
 *   - A keyed turn, a wheel turn and a dragged fold all end in one `stepPage`.
 *     ±2 on the arrows alone makes one input mean twice what the other two mean
 *     on the same device.
 *   - This function would have to know the window's width. `KeyContext` carries
 *     nothing about layout and must not: a key that moves a different distance
 *     after a resize is the reader's keyboard changing under them.
 *
 * Hence `step: 1 | -1` rather than a number — ±2 does not typecheck, which is
 * the cheapest possible guard on a decision whose behaviour is *unchanged* and
 * therefore invisible to anyone who reverses it. What a spread does with the
 * step is the spread's: turning inside one opening moves the reader and not the
 * paper, and `PageStage` draws no fold for it, because both leaves are already
 * on screen (`docs/design/page-transition.md` §3.5).
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
  | { readonly kind: "release" }
  | null;

/** The key that opens the jumper (spec-free convention, PLAN §Loop 6a). */
export const JUMPER_KEY = "/";

/** The page keys, which turn a leaf at any focus (§7 ⑤). */
export const PAGE_KEYS: Readonly<Record<string, 1 | -1>> = {
  PageDown: 1,
  PageUp: -1,
};

/** Apply the precedence rule above to one keydown. */
export function appKeyAction(ctx: KeyContext): KeyAction {
  if (ctx.modified) return null; // 1
  if (ctx.inTextField) return null; // 2
  if (ctx.inDialog) return null; // 3
  if (ctx.defaultPrevented) return null; // 4

  if (ctx.key === JUMPER_KEY) return { kind: "jumper" }; // 6 (survives 5)

  // The page keys, at any focus — the way out of ayah focus that costs the ayah
  // stepper nothing, because it never wanted them.
  const paged = PAGE_KEYS[ctx.key];
  if (paged) return { kind: "page", step: paged };

  // The other way out. Only meaningful when something has focus to let go of;
  // returning `release` from bare paper would have the shell blur `BODY`, which
  // is a no-op that still calls `preventDefault` and would eat an Escape the
  // page might want later.
  if (ctx.key === "Escape" && ctx.onAyah) return { kind: "release" };

  if (ctx.onAyah) return null; // 5 — the ayah stepper owns the arrows

  // 6 — RTL page turn: the next page of a mushaf is the one to the left.
  if (ctx.key === "ArrowLeft") return { kind: "page", step: 1 };
  if (ctx.key === "ArrowRight") return { kind: "page", step: -1 };
  return null;
}
