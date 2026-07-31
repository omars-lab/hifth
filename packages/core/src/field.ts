/**
 * The field — the surface the mus'haf lies on — and the two it is allowed to be.
 *
 * ## The question, and how it was settled
 *
 * `docs/design/page-transition.md` §7 ④ carried the field colour as an open
 * question for six loops. It stayed open because it was being *argued*: prose
 * against prose, with no way to see the thing. Five candidates shipped behind
 * `?field=` so that all five could be looked at in one window, each carrying its
 * own contrast row so that none of them could be adopted on charm alone.
 *
 * Looking at them produced a measurement nobody had thought to take. The rule
 * §2.2 ④ actually asked for was **a field the page is not** — and the field this
 * app had been shipping (`--paper-sunk` → `--paper`) ends its wash on the paper's
 * own colour. Separation at the far stop: **1.00:1**. At the foot of every page
 * the desk *was* the leaf. That is not a contrast failure — no standard requires
 * a page edge to clear a ratio — it is a drawing failure, and it had shipped
 * unnoticed because nothing measured the distance from the desk to the paper:
 *
 * | id      | vs. paper @near | vs. paper @far |
 * |---------|-----------------|----------------|
 * | `sunk`  | 1.10            | **1.00**       |
 * | `linen` | 1.29            | 1.10           |
 * | `slate` | 1.38            | 1.21           |
 * | `tan`   | **2.75**        | **1.89**       |
 * | `dark`  | 14.45           | 11.41          |
 *
 * `tan` won, and it is the reference mus'haf's own field. It is the only warm
 * option where the book reads as an object lying on a desk rather than as a
 * lighter patch of the same surface. `slate` was the counter-example the set
 * needed — the warm-field argument is a claim, and a claim with no cool option
 * against it is not being tested — and it lost honestly: a cool desk makes the
 * paper read as yellowed rather than as lit. `linen` was real but timid; its
 * worst separation (1.10) is exactly `sunk`'s best.
 *
 * ## Why `dark` survives and the other three do not
 *
 * `dark` is not a losing answer to the same question. It answers a different one
 * — *reading at night* — and it is the only field that does. Keeping it costs two
 * contrast rows and one CSS block; dropping it would mean the app has nothing to
 * offer a reader in a dim room. `sunk`, `linen` and `slate` were candidates for
 * «what colour is the desk», and that is decided.
 *
 * ## The pairing rule, which is the finding this produced
 *
 * **A field is a wash *and* the ink that survives it.** `#af8a68` is two full
 * steps darker than this app's paper, and `--ink-soft` measures **2.39:1** on it
 * — the stage's one piece of text, the "could not load page N" hint, would have
 * become unreadable the moment the desk got interesting. That is not a reason to
 * refuse the colour; it is a reason to say that a darker desk owes its own ink.
 * Both rows below are pairs, and both clear 4.5:1 against **each end** of the
 * wash:
 *
 * | id     | wash (near → far)     | ink on it | worst ratio |
 * |--------|-----------------------|-----------|-------------|
 * | `tan`  | `#af8a68` → `#c9ab8d` | `--ink`   | 5.11        |
 * | `dark` | `#221e1a` → `#35302a` | `--paper` | 11.41       |
 *
 * There is still no picker. `dark` is reachable by link and by nothing else,
 * because it is one desk for one occasion and not a preference the chrome should
 * grow a control for. If it ever earns one, that is a decision about the chrome,
 * made on its own evidence.
 *
 * ## Why parsing is tolerant, when the rest of the grammar is not
 *
 * `parseHash` rejects a whole link when a *known* key is malformed, because a
 * half-restored view is a lie about where the reader is. The field is not the
 * view. A link written by hand or edited by a chat client that mangles `field=`
 * should still open the ayah — losing the scripture to protect a background
 * colour has the trade exactly backwards. So an unreadable value falls back to
 * the default and the rest of the link stands, and `docs/query-params.md` states
 * which side of that line every parameter sits on.
 */

/** The two fields. Ids are stable — they appear in shared links. */
export type FieldId = "tan" | "dark";

/**
 * Every field, in the order they are documented and tested.
 *
 * The list is the single source of truth for three things that would otherwise
 * drift: the CSS blocks in `apps/web/src/styles/field.css`, the contrast rows in
 * `e2e/contrast.spec.ts`, and the table in `docs/query-params.md`. Two of those
 * three are checked against it by a gate.
 */
export const FIELDS: readonly FieldId[] = ["tan", "dark"];

/**
 * What ships, and what an absent or unreadable `field=` resolves to.
 *
 * `gate:params` checks that the token layer's own default wash is this field's
 * block — otherwise the document would paint one desk before `field.css` is
 * parsed and a different one after.
 */
export const DEFAULT_FIELD: FieldId = "tan";

/** Whether a string names a field. Narrow, so callers can keep the literal type. */
export function isFieldId(raw: string): raw is FieldId {
  return (FIELDS as readonly string[]).includes(raw);
}

/**
 * Read a `field=` value. Never throws and never refuses — an unknown value is a
 * cosmetic mistake, and the link still names an ayah.
 */
export function parseField(raw: string | null | undefined): FieldId {
  if (raw == null) return DEFAULT_FIELD;
  return isFieldId(raw) ? raw : DEFAULT_FIELD;
}
