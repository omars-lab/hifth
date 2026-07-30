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
