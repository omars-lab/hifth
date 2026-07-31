/**
 * The field — the surface the mus'haf lies on — and the five it is allowed to be.
 *
 * ## Why this is a link parameter and not a setting
 *
 * `docs/design/page-transition.md` §7 ④ left the field colour open, and named the
 * instrument that would have to answer it: this repo measures contrast on real
 * surfaces (`e2e/contrast.spec.ts`), and the rule is **add the row before the
 * token**. A colour argued about in prose is a taste fight; a colour that has to
 * pass a measurement is a decision. So the options ship behind a parameter, each
 * one carries a row, and the field is chosen by looking at all five in a real
 * window rather than by picking a hex in a document.
 *
 * That makes this an *instrument*, not a preference. There is deliberately no
 * picker in the chrome: a reader has no reason to restyle the desk mid-session,
 * and adding a control would make an open question look like a feature. If a
 * winner is adopted it becomes the default and the rest of this table can go.
 *
 * ## The pairing rule, which is the whole finding
 *
 * **A field is a wash *and* the ink that survives it.** The reference mus'haf's
 * field (`#af8a68`) is two full steps darker than this app's paper, and the app's
 * own `--ink-soft` measures **2.39:1** on it — the stage's one piece of text, the
 * "could not load page N" hint, becomes unreadable the moment the desk gets
 * interesting. That is not a reason to refuse the colour; it is a reason to state
 * that a darker desk owes its own ink. Every row below is a pair, and every pair
 * clears 4.5:1 against **both** ends of its wash:
 *
 * | id      | wash (near → far)     | ink on it        | worst ratio |
 * |---------|-----------------------|------------------|-------------|
 * | `sunk`  | `#ece4d6` → `#f4efe6` | `--ink-soft`     | 5.98        |
 * | `linen` | `#ded3c0` → `#ece4d6` | `--ink-soft`     | 5.10        |
 * | `slate` | `#d0cdc7` → `#dedbd5` | `--ink-soft`     | 4.76        |
 * | `tan`   | `#af8a68` → `#c9ab8d` | `--ink`          | 5.11        |
 * | `dark`  | `#221e1a` → `#35302a` | `--paper`        | 11.41       |
 *
 * `slate` is the control, and it earns its place by being the only cool one: the
 * warm-field argument is a claim that warmth reads better, and a claim with no
 * counter-example in the set is not being tested. It was `#c9c6c0` until the
 * measurement came back at **4.43:1** — under the floor by seven hundredths, which
 * is exactly the kind of miss that survives a design review and not a gate.
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

/** The five fields. Ids are stable — they appear in shared links. */
export type FieldId = "sunk" | "linen" | "slate" | "tan" | "dark";

/**
 * Every field, in the order they are documented and tested.
 *
 * The list is the single source of truth for three things that would otherwise
 * drift: the CSS blocks in `apps/web/src/styles/field.css`, the contrast rows in
 * `e2e/contrast.spec.ts`, and the table in `docs/query-params.md`. Two of those
 * three are checked against it by a gate.
 */
export const FIELDS: readonly FieldId[] = ["sunk", "linen", "slate", "tan", "dark"];

/** What ships, and what an absent or unreadable `field=` resolves to. */
export const DEFAULT_FIELD: FieldId = "sunk";

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
