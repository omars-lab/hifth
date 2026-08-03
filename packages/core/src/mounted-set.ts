/**
 * The DOM budget: how many mus'haf pages may be mounted at once, and which ones
 * survive when more are wanted than fit.
 *
 * Until Loop 4b this file could not have existed usefully. `App.tsx` asks the
 * stage to mount the current page plus every *vendored* hop target of the
 * current selection, and with three pages vendored that set could never exceed
 * three. Loop 4b vendored all 604, so the same expression now returns the
 * selection's entire hop fan-out — for a densely connected ayah, dozens of
 * ~150 KB inline SVGs mounted for one tap (`docs/backlog.md` ③).
 *
 * Two jobs, one function:
 *
 *   - **A ceiling.** Never hold more than `cap` pages. The request arrives in
 *     priority order — the current page first, then hop targets in rail order,
 *     which is hifz order, which is the order the reader is most likely to tap.
 *     Past the cap the tail is simply not mounted; it is fetched if tapped.
 *   - **Recency.** Slots the request does not fill go to pages that are already
 *     mounted, most-recently-used first, instead of being freed. That is what
 *     makes turning back a page, or hopping and returning, free — the previous
 *     page is still in the DOM. Without it the stage has no cache at all, only
 *     a working set that is torn down and rebuilt on every selection.
 *
 * The cap is one number on purpose. `docs/validation/ledger.json` carries an
 * on-device perf check whose whole job is to say what a phone can hold; when it
 * reports, this is the constant it tunes, and nothing else has to move.
 */

/**
 * How many pages the stage may hold. Loop 4b's spec said "LRU ~6 pages" before
 * any of it was measured, and 6 is that guess: on a phone the reader sees one
 * page and can reach two by turning, leaving three slots for hop targets.
 * Pending the on-device verdict (`perf-verdict-on-device` in the ledger).
 */
export const MOUNTED_PAGE_CAP = 6;

/**
 * Split the cap between the two leaves of an open spread (`docs/backlog.md` ④).
 *
 * The desktop spread mounts both leaves as real stages, so an unsplit cap is a
 * cap per *leaf* and the book silently holds twice what a phone does. The split
 * is uneven on purpose: hop targets only ever arrive at the leaf the reader is
 * on, and the facing leaf is asked for exactly one page, so all it needs is its
 * own page plus one slot of recency — enough that turning back one spread is
 * free. Everything else stays where the hops land.
 *
 * @returns Budgets that sum to `cap`, each at least 1.
 */
export function spreadBudget(cap: number = MOUNTED_PAGE_CAP): {
  reading: number;
  facing: number;
} {
  const limit = Math.max(2, Math.floor(cap));
  // Never more than half, so the reading leaf keeps the larger share at any cap
  // small enough for "two slots for the facing leaf" to stop being generous.
  const facing = Math.min(2, Math.floor(limit / 2));
  return { reading: limit - facing, facing };
}

/**
 * Decide which pages the stage should hold.
 *
 * @param request Pages wanted now, most important first. `request[0]` is the
 *   page being read and is never dropped — if the request alone exceeds `cap`,
 *   the *tail* is dropped, not the head.
 * @param mounted Pages currently mounted, most-recently-used first.
 * @param cap The ceiling. A `cap` below 1 is treated as 1: a stage holding no
 *   pages shows blank paper where scripture should be.
 * @returns The pages to hold, most-recently-used first — feed it back as
 *   `mounted` on the next call. Anything mounted and absent from this list is
 *   the caller's to destroy.
 */
export function retainPages(
  request: readonly number[],
  mounted: readonly number[],
  cap: number = MOUNTED_PAGE_CAP,
): number[] {
  const limit = Math.max(1, Math.floor(cap));
  const keep: number[] = [];
  const seen = new Set<number>();

  // The request first, in the order it was asked for: these are the pages a
  // hop's tween needs both endpoints of.
  for (const page of request) {
    if (keep.length >= limit) break;
    if (seen.has(page)) continue;
    seen.add(page);
    keep.push(page);
  }
  // Then whatever is already in the DOM, newest first. Re-mounting a page costs
  // a fetch and a parse; keeping one costs the DOM it already occupies.
  for (const page of mounted) {
    if (keep.length >= limit) break;
    if (seen.has(page)) continue;
    seen.add(page);
    keep.push(page);
  }
  return keep;
}
