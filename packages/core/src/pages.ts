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
  /** The leaf on the left — the next page. Null at the two ends of the book. */
  readonly left: number | null;
}

/**
 * The spread a page is printed on: which leaf sits right and which sits left.
 *
 * The mus'haf reads right to left, so within a spread the **lower** page number is
 * on the **right** and the next page is to its left. The print pairs them
 * (2,3), (4,5), (6,7)… — page 1 has nothing facing it, because it is the first
 * leaf after the cover, and in an even-length book (604 for the Madani print) the
 * last page has nothing facing it either.
 *
 * This is the same convention the rest of the app already encodes and must not
 * be re-derived per component: `appKeyAction` makes ArrowLeft **+1** page, and
 * `PageSlider` puts its next-page button on the left edge. A second, independent
 * statement of "which way is forward" is how two of them end up disagreeing.
 *
 * `left: null` is a third state, and it is not the same as "the left leaf is
 * missing from this build". Nothing is absent at the ends of the book — there is
 * no page 0 and no page 605 — so a caller renders that side as empty furniture,
 * not as a hole with a caption. Whether a leaf that *does* exist in the print is
 * vendored is a separate question, and `Resolver`/the manifest answer it.
 */
export function spreadOf(page: number, total: number): Spread {
  // A nonsense page gets no spread rather than a plausible-looking one: the
  // caller is about to draw two panels, and drawing "page 0 facing page 1" would
  // be a picture of a book that does not exist.
  if (!Number.isFinite(page) || page < 1 || page > total) return { right: null, left: null };
  // Page 1 is alone on the right. Every other odd page closes the spread its
  // even predecessor opened.
  if (page === 1) return { right: 1, left: null };
  const right = page % 2 === 0 ? page : page - 1;
  const left = right + 1;
  return { right, left: left > total ? null : left };
}
