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
