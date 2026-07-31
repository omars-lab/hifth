/**
 * Pagination: the book's page numbers, and which of them we actually hold.
 *
 * Two different quantities live here and they must not be confused, because
 * confusing them is exactly the bug this module exists to prevent:
 *
 *   - **The print's length.** A mus'haf edition has a fixed page count — 604 for
 *     the KFGQPC Madani print — and it is a property of the *paper*, not of this
 *     build. It belongs on `EditionMeta`, beside the riwayah.
 *   - **The vendored inventory.** How many of those pages are in `public/assets`
 *     today. Three, until Loop 4b lands.
 *
 * A control that scrubs pages has to show the first and honour the second: a
 * slider spanning only what is vendored tells a hafiz the mus'haf is three pages
 * long, and a slider that spans 604 and lets go on a page we do not have lands
 * on a blank. So the track is the print and the landing is the inventory —
 * `nearestPage` is the seam, and it answers with what it *did*, not with what
 * was asked, so the caller can say so out loud.
 */

/**
 * The vendored page closest to `wanted`, or null when nothing is vendored.
 *
 * `available` may be in any order and may contain the wanted page itself (in
 * which case it wins, since its distance is zero). Ties break **toward the
 * lower page number** — the earlier one in the book, which is the one a reader
 * moving forward reaches first. The rule matters less than its being fixed:
 * an unstable tie-break makes the same drag land in two different places.
 */
export function nearestPage(available: readonly number[], wanted: number): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const page of available) {
    const distance = Math.abs(page - wanted);
    // Strictly less than, walking ascending order, would already prefer the
    // lower page — but `available` is not promised sorted, so the tie is broken
    // explicitly rather than by luck of iteration order.
    if (distance < bestDistance || (distance === bestDistance && page < (best ?? Infinity))) {
      best = page;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Where a page sits along the book, as a fraction in [0, 1].
 *
 * Page 1 is 0 and the last page is 1, so a tick drawn at this fraction lines up
 * with the slider thumb when the thumb is on that page. A one-page book (or a
 * nonsense `total`) is 0 rather than a division by zero.
 */
export function pageFraction(page: number, total: number): number {
  if (total <= 1) return 0;
  const clamped = Math.min(total, Math.max(1, page));
  return (clamped - 1) / (total - 1);
}

/** The two leaves of one open spread. `null` means there is no leaf on that side. */
export interface Spread {
  /** The leaf on the right — the **lower** page number. Never null for a valid page. */
  readonly right: number | null;
  /**
   * The leaf on the left — the next page. Null only when the print has an odd
   * page count and this is its last leaf, which the Madani print's 604 never is.
   */
  readonly left: number | null;
}

/**
 * The spread a page is printed on: which leaf sits right and which sits left.
 *
 * The mus'haf reads right to left, so within a spread the **lower** page number is
 * on the **right** and the next page is to its left. The print pairs them
 * (1,2), (3,4), (5,6)… — **odd on the right, even on the left** — so the 604-page
 * Madani print divides into exactly 302 complete openings with no orphan leaf at
 * either end.
 *
 * That parity is an observation, not a derivation, and it is worth saying where it
 * comes from because this function had it backwards for six loops. Open a physical
 * KFGQPC Madani mushaf at the beginning: **Al-Fatiha is page 1 and it sits on the
 * right, facing the first page of Al-Baqarah — page 2 — on the left.** Every
 * opening after it follows.
 *
 * The pairing this function used to implement was (2,3), (4,5)…, with page 1 alone
 * on the right and page 604 alone on the left. It was inferred rather than seen —
 * from "every juz' begins on a right-hand page" plus the fact that juz' 2, 3, 4…
 * begin on pages 22, 42, 62, all even — and the inference was recorded as though
 * it had been verified. The two orphan leaves it produced should have been the
 * tell: a codex whose leaves each carry two pages cannot orphan exactly one page at
 * each end of an even-length book. Under the corrected phase nothing is orphaned,
 * which is what a bound book looks like.
 *
 * Two things did **not** change with the correction, and both are pinned elsewhere:
 * the lower page number is still on the right (1 faces 2, 21 faces 22), and the
 * turn direction is still RTL. `PLAN.md`'s desktop rule and `loop-1.md`'s
 * convention are untouched — only parity moved.
 *
 * This is the same convention the rest of the app already encodes and must not
 * be re-derived per component: `appKeyAction` makes ArrowLeft **+1** page, and
 * `PageSlider` puts its next-page button on the left edge. A second, independent
 * statement of "which way is forward" is how two of them end up disagreeing.
 *
 * `left: null` is a third state, and it is not the same as "the left leaf is
 * missing from this build". Nothing is absent at the end of the book — there is no
 * page 605 — so a caller renders that side as empty furniture, not as a hole with a
 * caption. It can only arise in a print with an odd page count, which the Madani
 * print is not; it is kept because `total` is a parameter and a caller may pass
 * another edition. Whether a leaf that *does* exist in the print is vendored is a
 * separate question, and `Resolver`/the manifest answer it.
 */
export function spreadOf(page: number, total: number): Spread {
  // A nonsense page gets no spread rather than a plausible-looking one: the
  // caller is about to draw two panels, and drawing "page 0 facing page 1" would
  // be a picture of a book that does not exist.
  if (!Number.isFinite(page) || page < 1 || page > total) return { right: null, left: null };
  // The odd page opens the spread; the even page closes it on the left. No
  // special case for page 1 — it is an ordinary right-hand leaf, and the special
  // case it used to need was the artefact of the wrong phase, not a fact about
  // the book.
  const right = page % 2 === 0 ? page - 1 : page;
  const left = right + 1;
  return { right, left: left > total ? null : left };
}

/** Which half of its opening a leaf is, or `null` for a page outside the print. */
export type LeafSide = "right" | "left";

/**
 * Which side of a leaf is **free** — the fore-edge, the side you put a thumb on.
 *
 * A right-hand leaf is bound on its left and free on its right; a left-hand leaf
 * is the mirror. That is the whole function, and it exists rather than being
 * inlined at its two call sites for the reason decision row 9 gives about the
 * spread itself: the phase of the print is stated **once**. `spreadOf` was wrong
 * for six loops (see above) and correcting one line here fixed every spread; a
 * stylesheet that re-derived "odd means right" would have kept the old phase
 * alive in CSS where no unit test can reach it.
 *
 * It is emphatically **not** an inline-direction question, which is why nothing
 * downstream may reach for `inline-start`/`inline-end` or a `:nth-child` parity
 * check. The free side flips with *page parity*; logical properties flip with
 * *reading direction*, and the UI language can change while the book cannot. A
 * fore-edge that moved when a reader switched to English would be drawing a
 * different book.
 *
 * `null` for a page the print does not have, for the same reason `spreadOf`
 * returns two nulls: the caller is about to draw an edge, and an edge on a page
 * that does not exist is furniture around nothing.
 */
export function leafSideOf(page: number, total: number): LeafSide | null {
  const spread = spreadOf(page, total);
  if (spread.right === null) return null;
  return spread.right === page ? "right" : "left";
}

/** What lies between two pages of the print. See `foldBetween`. */
export type Fold = "crease" | "gap" | "hole" | "none";

/**
 * What lies between two pages, told truthfully.
 *
 *   crease — the two pages face each other in the print: one opening, one gutter.
 *   gap    — consecutive in the print, but different openings: a leaf turned.
 *   hole   — the print has pages between these two and this build does not.
 *   none   — not a turn at all (the same page, or a page outside the print).
 *
 * This is the rule an animated page turn draws, and it lives here rather than as
 * a parity check in a stylesheet for the reason `spreadOf` gives about itself:
 * the print's phase was wrong for six loops, and correcting one line here
 * corrects every crease in the application at once. A stylesheet that re-derived
 * "odd means facing" would have kept the old phase alive where no unit test can
 * reach it.
 *
 * The whole of it defers to `spreadOf` and to integer arithmetic, and that is
 * deliberate — **adjacency is a fact about the paper, not about this build.** An
 * interface that drew a bound-book crease between page 7 and page 9 would be
 * asserting they are consecutive leaves; they are not, and `PLAN.md`'s standing
 * rule is that a gap the interface papers over is a lie. Which pages are
 * *vendored* is therefore not an input: it cannot change the answer for any pair
 * a reader can actually turn between (a step lands on the next page we hold, so
 * everything skipped is by construction unheld), and taking it would invite the
 * one defect this function exists to prevent — treating "consecutive in the
 * inventory" as adjacency in the book. `docs/design/page-transition.md` §4.1
 * sketched a fourth `vendored` parameter and then used none of it; the omission
 * is recorded there.
 *
 * `"none"` for a **jump** is the caller's to pass, not this function's to infer.
 * It cannot see whether the reader pressed an arrow or tapped a hop chip, and
 * that is exactly the distinction `page-turning.md` §4.5 draws — a turn is
 * continuous reading, a jump is a relocation. A fold drawn across a hop from
 * page 19 to page 7 would claim they are neighbours.
 *
 * Page 1 needs no special case, and the reason is a good check on the phase: it
 * shares its opening with page 2, so 1 | 2 is a **crease**. Under the pairing
 * `spreadOf` used to implement — page 1 alone on the right — it would have been a
 * gap. One correction, both call sites.
 */
export function foldBetween(from: number, to: number, total: number): Fold {
  // The same page is not a turn. Checked before the spread comparison, which
  // would otherwise answer "crease" for a re-render that moved nothing.
  if (from === to) return "none";
  if (!Number.isInteger(from) || !Number.isInteger(to)) return "none";
  const a = spreadOf(from, total);
  const b = spreadOf(to, total);
  // Either page outside the print — page 605 of a 604-page mus'haf, page 0 —
  // and there is no fold, because one end of it is not in the book.
  if (a.right === null || b.right === null) return "none";
  if (a.right === b.right) return "crease";
  // Adjacent in the print but in different openings: exactly one leaf turned.
  if (Math.abs(from - to) === 1) return "gap";
  return "hole";
}
